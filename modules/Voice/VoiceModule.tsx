
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Modality, Blob } from '@google/genai';
import { useApp } from '../../context/AppContext';

const VoiceModule: React.FC = () => {
  // Fix: Replaced non-existent checklist property with agenda from AppContextType
  const { clients, transactions, agenda, config } = useApp();
  const [isActive, setIsActive] = useState(false);
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const [transcription, setTranscription] = useState<string[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);
  const frameIntervalRef = useRef<number | null>(null);

  const postJarvisLog = async (level: 'info' | 'warn' | 'error', message: string, data?: any) => {
    try {
      await fetch('/api/support/frontend-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'jarvis', level, message, data }),
      });
    } catch {
      // ignore
    }
  };

  function decode(base64: string) {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
    return bytes;
  }

  function encode(bytes: Uint8Array) {
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }

  async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
    for (let channel = 0; channel < numChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < frameCount; i++) channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
    return buffer;
  }

  const startVoiceSession = async () => {
    if (isActive) return;
    setIsConnecting(true);
    setErrorMessage(null);
    
    try {
      const apiKey = (import.meta as any).env.VITE_GEMINI_API_KEY;
      if (!apiKey) {
        setErrorMessage('VITE_GEMINI_API_KEY não encontrado. Edite .env.local e REINICIE o npm run dev.');
        setIsConnecting(false);
        postJarvisLog('warn', 'Tentativa de iniciar sem VITE_GEMINI_API_KEY');
        return;
      }

      // Chave do Jarvis (Gemini) vem do .env.local via Vite
      const ai = new GoogleGenAI({ apiKey });
      const outCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      audioContextRef.current = outCtx;
      
      let nextStartTime = 0;
      const sources = new Set<AudioBufferSourceNode>();

      // Fix: Use agenda.length instead of checklist.length in the system prompt
      const contextPrompt = `
        VOCÊ É O KLAUS, UM ASSISTENTE EXECUTIVO DE ALTO NÍVEL.
        DADOS DO SISTEMA: Clientes: ${clients.length}, Transações: ${transactions.length}, Tarefas: ${agenda.length}.
        Instrução Base: ${config.klausPrompt}.
        Sua voz é profissional. Se vir a tela do usuário, ajude com o que está sendo exibido.
      `;

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Charon' } } },
          systemInstruction: contextPrompt,
          inputAudioTranscription: {},
          outputAudioTranscription: {}
        },
        callbacks: {
          onopen: () => {
            setIsActive(true);
            setIsConnecting(false);
            setTranscription(prev => ["Conexão estabelecida. Klaus online.", ...prev]);
            postJarvisLog('info', 'Live session aberta');
            startMicStream(sessionPromise);
          },
          onmessage: async (message) => {
            if (message.serverContent?.outputTranscription) {
              const text = message.serverContent.outputTranscription.text;
              if (text) setTranscription(prev => [text, ...prev.slice(0, 15)]);
            }

            const audioData = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (audioData) {
              nextStartTime = Math.max(nextStartTime, outCtx.currentTime);
              const buffer = await decodeAudioData(decode(audioData), outCtx, 24000, 1);
              const source = outCtx.createBufferSource();
              source.buffer = buffer;
              source.connect(outCtx.destination);
              source.start(nextStartTime);
              nextStartTime += buffer.duration;
              sources.add(source);
            }

            if (message.serverContent?.interrupted) {
              sources.forEach(s => { try { s.stop(); } catch(e) {} });
              sources.clear();
              nextStartTime = 0;
            }
          },
          onclose: (evt: any) => {
            postJarvisLog('warn', 'Live session fechada', evt);
            setErrorMessage('Sessão Gemini fechou imediatamente. Veja jarvis.log e Console do navegador.');
            stopSession();
          },
          onerror: (e) => {
            console.error("Erro Live API:", e);
            setErrorMessage("Erro de conexão com o Gemini. Verifique sua chave API.");
            setIsConnecting(false);
            postJarvisLog('error', 'Erro Live API', e);
            stopSession();
          }
        }
      });

      sessionPromiseRef.current = sessionPromise;

    } catch (e: any) {
      setErrorMessage(e.message);
      setIsConnecting(false);
      postJarvisLog('error', 'Falha ao iniciar sessão', { message: e?.message, stack: e?.stack });
    }
  };

  const startMicStream = async (sessionPromise: Promise<any>) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const inCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const source = inCtx.createMediaStreamSource(stream);
      const processor = inCtx.createScriptProcessor(4096, 1, 1);
      
      processor.onaudioprocess = (e) => {
        const input = e.inputBuffer.getChannelData(0);
        const int16 = new Int16Array(input.length);
        for (let i = 0; i < input.length; i++) int16[i] = input[i] * 32768;
        
        sessionPromise.then(session => {
          session.sendRealtimeInput({ media: {
            data: encode(new Uint8Array(int16.buffer)),
            mimeType: 'audio/pcm;rate=16000'
          }});
        });
      };

      source.connect(processor);
      processor.connect(inCtx.destination);
    } catch (err) {
      setErrorMessage("Erro ao acessar microfone. Verifique as permissões.");
      postJarvisLog('error', 'Erro microfone', err);
    }
  };

  const toggleScreenShare = async () => {
    if (isSharingScreen) { stopScreenShare(); return; }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 5 }, audio: false });
      setIsSharingScreen(true);
      const video = document.createElement('video');
      video.srcObject = stream;
      video.play();
      screenVideoRef.current = video;

      frameIntervalRef.current = window.setInterval(() => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx || !video) return;
        canvas.width = 640; canvas.height = 360;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          if (blob) {
            const reader = new FileReader();
            reader.onloadend = () => {
              const base64 = (reader.result as string).split(',')[1];
              sessionPromiseRef.current?.then(session => {
                session.sendRealtimeInput({ media: { data: base64, mimeType: 'image/jpeg' } });
              });
            };
            reader.readAsDataURL(blob);
          }
        }, 'image/jpeg', 0.5);
      }, 2000);

      stream.getVideoTracks()[0].onended = () => stopScreenShare();
    } catch (err) { setIsSharingScreen(false); }
  };

  const stopScreenShare = () => {
    if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
    if (screenVideoRef.current?.srcObject) {
      (screenVideoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
    }
    setIsSharingScreen(false);
  };

  const stopSession = () => {
    stopScreenShare();
    sessionPromiseRef.current?.then(session => { try { session.close(); } catch(e) {} });
    sessionPromiseRef.current = null;
    setIsActive(false);
    setIsConnecting(false);
    postJarvisLog('info', 'Sessão encerrada');
  };

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const time = Date.now() * 0.003;
      ctx.beginPath();
      ctx.lineWidth = 3;
      ctx.strokeStyle = isActive ? '#22d3ee' : '#334155';
      for (let x = 0; x < canvas.width; x++) {
        const amp = isActive ? 25 : 2;
        const y = canvas.height / 2 + Math.sin(x * 0.04 + time) * amp;
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      animationRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => { if (animationRef.current) cancelAnimationFrame(animationRef.current); };
  }, [isActive]);

  return (
    <div className="space-y-8 animate-fadeIn">
      <header className="flex justify-between items-center">
        <div>
          <h2 className="text-4xl font-black tracking-tighter text-white">KLAUS <span className="text-cyan-500 font-light">VISION</span></h2>
          <p className="text-slate-400 text-sm font-bold uppercase tracking-widest">Controle de Voz e Contexto Visual</p>
        </div>
        <div className="flex gap-4">
           {errorMessage && (
             <div className="bg-rose-600/20 border border-rose-500 text-rose-500 px-4 py-2 rounded-xl text-[10px] font-bold animate-pulse">
               {errorMessage}
             </div>
           )}
           <button 
             onClick={toggleScreenShare}
             disabled={!isActive}
             className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
               isSharingScreen ? 'bg-rose-600/20 border-rose-500 text-rose-400' : 'bg-slate-800 border-slate-700 text-slate-400'
             } disabled:opacity-20`}
           >
             {isSharingScreen ? '🔴 Parar Visão' : '👁️ Compartilhar Tela'}
           </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 min-h-[500px]">
        <div className="lg:col-span-8 flex flex-col items-center justify-center space-y-12">
          <div className="relative">
            <div className={`w-64 h-64 rounded-full border-2 flex items-center justify-center transition-all duration-700 ${
              isActive ? 'border-cyan-500 shadow-[0_0_80px_rgba(6,182,212,0.3)] bg-cyan-950/10' : 'border-slate-800 bg-slate-900'
            }`}>
              <button 
                onClick={isActive ? stopSession : startVoiceSession}
                disabled={isConnecting}
                className={`w-48 h-48 rounded-full flex flex-col items-center justify-center transition-all active:scale-95 ${
                  isActive ? 'bg-cyan-500 text-white shadow-2xl' : 'bg-slate-800 text-slate-500 hover:bg-slate-750'
                }`}
              >
                {isConnecting ? <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin"></div> : (
                  <>
                    <span className="text-6xl mb-3">{isActive ? '🎙️' : '🧠'}</span>
                    <span className="text-[11px] font-black uppercase tracking-tighter">
                      {isActive ? 'Klaus Ouvindo...' : 'Ativar Interface'}
                    </span>
                  </>
                )}
              </button>
            </div>
            {isActive && <div className="absolute -inset-10 border border-cyan-500/10 rounded-full animate-ping pointer-events-none"></div>}
          </div>
          <canvas ref={canvasRef} width={800} height={100} className="w-full h-24 opacity-60" />
        </div>

        <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col shadow-2xl">
          <h3 className="text-[10px] font-black uppercase text-slate-500 mb-6 flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-cyan-500 animate-pulse' : 'bg-slate-700'}`}></span>
            Logs de Transcrição (Voz)
          </h3>
          <div className="flex-1 bg-slate-950 rounded-2xl p-5 overflow-y-auto space-y-4 font-mono text-[11px] border border-slate-900">
            {transcription.length === 0 ? (
              <p className="text-slate-800 italic text-center mt-20">Aguardando início de sessão...</p>
            ) : transcription.map((text, i) => (
              <p key={i} className="text-cyan-400/90 leading-relaxed border-l-2 border-cyan-500/20 pl-4 py-1">{text}</p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VoiceModule;
