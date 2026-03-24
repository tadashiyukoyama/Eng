import { useState, useRef, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Mic, MicOff, Eye, EyeOff, Volume2, VolumeX,
  Loader2, Zap, Activity, AlertCircle
} from "lucide-react";

// ─── Gemini Live Audio types ──────────────────────────────────────────────────
declare global {
  interface Window {
    __JARVIS_SESSION__?: any;
  }
}

type JarvisStatus = "idle" | "connecting" | "connected" | "error";

// ─── Audio helpers ────────────────────────────────────────────────────────────
function base64ToFloat32(base64: string): Float32Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const int16 = new Int16Array(bytes.buffer);
  const float32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768.0;
  return float32;
}

async function float32ToBase64PCM(float32: Float32Array): Promise<string> {
  const int16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    int16[i] = Math.max(-32768, Math.min(32767, Math.round(float32[i] * 32767)));
  }
  const bytes = new Uint8Array(int16.buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function imageDataToBase64(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL("image/jpeg", 0.5).split(",")[1];
}

export default function Jarvis() {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem("jarvis_gemini_key") ?? "");
  const [status, setStatus] = useState<JarvisStatus>("idle");
  const [listening, setListening] = useState(false);
  const [visionActive, setVisionActive] = useState(false);
  const [transcript, setTranscript] = useState<string[]>([]);
  const [error, setError] = useState("");

  const sessionRef = useRef<any>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const visionIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const playbackQueueRef = useRef<Float32Array[]>([]);
  const isPlayingRef = useRef(false);
  const transcriptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => { stopSession(); };
  }, []);

  useEffect(() => {
    transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight, behavior: "smooth" });
  }, [transcript]);

  const addTranscript = (role: "user" | "jarvis", text: string) => {
    setTranscript((t) => [...t.slice(-40), `[${role === "user" ? "Você" : "Jarvis"}] ${text}`]);
  };

  // ─── Playback de áudio recebido ────────────────────────────────────────────
  const playAudioChunk = useCallback(async (float32: Float32Array) => {
    playbackQueueRef.current.push(float32);
    if (isPlayingRef.current) return;
    isPlayingRef.current = true;
    const ctx = audioCtxRef.current;
    if (!ctx) { isPlayingRef.current = false; return; }

    while (playbackQueueRef.current.length > 0) {
      const chunk = playbackQueueRef.current.shift()!;
      const buffer = ctx.createBuffer(1, chunk.length, 24000);
      buffer.getChannelData(0).set(chunk);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      await new Promise<void>((resolve) => {
        source.onended = () => resolve();
        source.start();
      });
    }
    isPlayingRef.current = false;
  }, []);

  // ─── Iniciar sessão Gemini Live ────────────────────────────────────────────
  const startSession = async () => {
    if (!apiKey.trim()) { toast.error("Insira sua chave de API do Gemini"); return; }
    setError("");
    setStatus("connecting");
    localStorage.setItem("jarvis_gemini_key", apiKey);

    try {
      // Importar SDK Gemini Live dinamicamente via Function (evita análise estática do TS)
      // eslint-disable-next-line @typescript-eslint/no-implied-eval
      const importFn = new Function("url", "return import(url)");
      const geminiModule: any = await importFn("https://esm.sh/@google/genai@0.7.0");
      const { GoogleGenAI, Modality } = geminiModule;

      const ai = new GoogleGenAI({ apiKey });
      audioCtxRef.current = new AudioContext({ sampleRate: 16000 });

      const session = await ai.live.connect({
        model: "gemini-2.5-flash-preview-native-audio-dialog",
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: {
            parts: [{
              text: `Você é o Jarvis, assistente pessoal executivo do Klaus OS. 
Seja proativo, inteligente e natural. Responda em português brasileiro.
Você pode ver a tela do usuário e ouvir sua voz em tempo real.
Ajude com tarefas de gestão empresarial, CRM, financeiro e agenda.`
            }]
          }
        },
        callbacks: {
          onopen: () => {
            setStatus("connected");
            addTranscript("jarvis", "Jarvis conectado. Como posso ajudar?");
          },
          onmessage: async (msg: any) => {
            // Áudio de resposta
            const audio = msg?.serverContent?.modelTurn?.parts?.find((p: any) => p.inlineData?.mimeType?.includes("audio"));
            if (audio?.inlineData?.data) {
              const float32 = base64ToFloat32(audio.inlineData.data);
              playAudioChunk(float32);
            }
            // Texto de resposta
            const text = msg?.serverContent?.modelTurn?.parts?.find((p: any) => p.text);
            if (text?.text) addTranscript("jarvis", text.text);
            // Transcrição do usuário
            const userText = msg?.serverContent?.inputTranscription?.text;
            if (userText) addTranscript("user", userText);
          },
          onerror: (e: any) => {
            setError(String(e?.message ?? "Erro na conexão"));
            setStatus("error");
          },
          onclose: () => {
            if (status === "connected") {
              setStatus("idle");
              addTranscript("jarvis", "Sessão encerrada.");
            }
          },
        },
      });

      sessionRef.current = session;
      window.__JARVIS_SESSION__ = session;

      // Iniciar captura de microfone
      await startMicrophone(session);
      setListening(true);

    } catch (e: any) {
      setError(e?.message ?? "Erro ao conectar com Gemini Live");
      setStatus("error");
    }
  };

  // ─── Microfone ────────────────────────────────────────────────────────────
  const startMicrophone = async (session: any) => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { sampleRate: 16000, channelCount: 1 } });
    mediaStreamRef.current = stream;
    const ctx = audioCtxRef.current!;
    const source = ctx.createMediaStreamSource(stream);
    const processor = ctx.createScriptProcessor(4096, 1, 1);
    processorRef.current = processor;

    processor.onaudioprocess = async (e) => {
      if (!sessionRef.current) return;
      const float32 = e.inputBuffer.getChannelData(0);
      const b64 = await float32ToBase64PCM(float32);
      try {
        sessionRef.current.sendRealtimeInput({
          audio: { data: b64, mimeType: "audio/pcm;rate=16000" }
        });
      } catch { /* ignore send errors */ }
    };

    source.connect(processor);
    processor.connect(ctx.destination);
  };

  // ─── Visão (compartilhamento de tela) ─────────────────────────────────────
  const toggleVision = async () => {
    if (visionActive) {
      // Parar visão
      if (visionIntervalRef.current) clearInterval(visionIntervalRef.current);
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
      setVisionActive(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 5 } });
      screenStreamRef.current = stream;
      setVisionActive(true);
      addTranscript("jarvis", "Visão ativada. Posso ver sua tela agora.");

      const video = document.createElement("video");
      video.srcObject = stream;
      await video.play();

      const canvas = document.createElement("canvas");
      visionIntervalRef.current = setInterval(() => {
        if (!sessionRef.current || !video.videoWidth) return;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(video, 0, 0);
        const b64 = imageDataToBase64(canvas);
        try {
          sessionRef.current.sendRealtimeInput({
            video: { data: b64, mimeType: "image/jpeg" }
          });
        } catch { /* ignore */ }
      }, 2000);

      stream.getVideoTracks()[0].onended = () => {
        if (visionIntervalRef.current) clearInterval(visionIntervalRef.current);
        setVisionActive(false);
      };
    } catch (e: any) {
      toast.error("Erro ao compartilhar tela: " + e.message);
    }
  };

  // ─── Parar sessão ─────────────────────────────────────────────────────────
  const stopSession = () => {
    if (visionIntervalRef.current) clearInterval(visionIntervalRef.current);
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    processorRef.current?.disconnect();
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    audioCtxRef.current?.close();
    try { sessionRef.current?.close(); } catch { /* ignore */ }
    sessionRef.current = null;
    audioCtxRef.current = null;
    mediaStreamRef.current = null;
    screenStreamRef.current = null;
    processorRef.current = null;
    setStatus("idle");
    setListening(false);
    setVisionActive(false);
  };

  const isConnected = status === "connected";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold gradient-text">Jarvis</h1>
          <p className="text-muted-foreground text-sm mt-1">Assistente com voz, visão e escuta em tempo real</p>
        </div>
        <div className="flex items-center gap-2">
          {status === "connected" && <div className="pulse-dot" />}
          <Badge
            variant="outline"
            className={
              status === "connected" ? "border-green-500/50 text-green-400" :
              status === "connecting" ? "border-yellow-500/50 text-yellow-400" :
              status === "error" ? "border-red-500/50 text-red-400" :
              "border-border text-muted-foreground"
            }
          >
            {status === "connected" ? "Online" :
             status === "connecting" ? "Conectando..." :
             status === "error" ? "Erro" : "Offline"}
          </Badge>
        </div>
      </div>

      {/* Config API Key */}
      {!isConnected && (
        <Card className="glass-card border-primary/20">
          <CardContent className="p-4">
            <p className="text-sm font-medium mb-2 flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              Chave API Gemini
            </p>
            <div className="flex gap-2">
              <Input
                type="password"
                placeholder="AIza..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="bg-background border-border font-mono text-sm"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Obtenha sua chave em{" "}
              <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer"
                className="text-primary hover:underline">
                aistudio.google.com/apikey
              </a>
              {" "}— requer acesso ao Gemini 2.5 Flash Preview Native Audio
            </p>
          </CardContent>
        </Card>
      )}

      {/* Erro */}
      {error && (
        <Card className="border-destructive/50 bg-destructive/10">
          <CardContent className="p-3 flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </CardContent>
        </Card>
      )}

      {/* Controles */}
      <div className="flex gap-3 flex-wrap">
        {!isConnected ? (
          <Button
            onClick={startSession}
            disabled={status === "connecting"}
            className="gap-2 bg-primary hover:bg-primary/90"
            size="lg"
          >
            {status === "connecting"
              ? <Loader2 className="h-5 w-5 animate-spin" />
              : <Mic className="h-5 w-5" />
            }
            {status === "connecting" ? "Conectando..." : "Iniciar Jarvis"}
          </Button>
        ) : (
          <>
            <Button
              onClick={stopSession}
              variant="destructive"
              size="lg"
              className="gap-2"
            >
              <MicOff className="h-5 w-5" />
              Encerrar
            </Button>
            <Button
              onClick={toggleVision}
              variant={visionActive ? "default" : "outline"}
              size="lg"
              className="gap-2"
            >
              {visionActive ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
              {visionActive ? "Visão Ativa" : "Ativar Visão"}
            </Button>
          </>
        )}
      </div>

      {/* Indicadores de status */}
      {isConnected && (
        <div className="flex gap-3">
          <Card className="glass-card flex-1">
            <CardContent className="p-3 flex items-center gap-2">
              <div className={`p-2 rounded-lg ${listening ? "bg-green-500/20" : "bg-muted"}`}>
                <Mic className={`h-4 w-4 ${listening ? "text-green-400" : "text-muted-foreground"}`} />
              </div>
              <div>
                <p className="text-xs font-medium">Microfone</p>
                <p className="text-xs text-muted-foreground">{listening ? "Escutando" : "Inativo"}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="glass-card flex-1">
            <CardContent className="p-3 flex items-center gap-2">
              <div className={`p-2 rounded-lg ${visionActive ? "bg-blue-500/20" : "bg-muted"}`}>
                <Eye className={`h-4 w-4 ${visionActive ? "text-blue-400" : "text-muted-foreground"}`} />
              </div>
              <div>
                <p className="text-xs font-medium">Visão</p>
                <p className="text-xs text-muted-foreground">{visionActive ? "Vendo tela" : "Inativa"}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="glass-card flex-1">
            <CardContent className="p-3 flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/20">
                <Volume2 className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-xs font-medium">Voz</p>
                <p className="text-xs text-muted-foreground">Gemini Live</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Transcrição */}
      <Card className="glass-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Transcrição em tempo real
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div
            ref={transcriptRef}
            className="bg-background/50 rounded-lg p-3 h-48 overflow-y-auto space-y-1 mono text-xs"
          >
            {transcript.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                {isConnected ? "Fale algo para começar..." : "Inicie o Jarvis para ver a transcrição"}
              </p>
            ) : (
              transcript.map((line, i) => (
                <p key={i} className={line.startsWith("[Você]") ? "text-primary" : "text-muted-foreground"}>
                  {line}
                </p>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Info técnica */}
      <Card className="glass-card border-border/50">
        <CardContent className="p-4">
          <p className="text-xs font-medium text-muted-foreground mb-2">Informações técnicas</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            {[
              { label: "Modelo", value: "gemini-2.5-flash-preview-native-audio-dialog" },
              { label: "Áudio entrada", value: "PCM 16kHz mono" },
              { label: "Áudio saída", value: "PCM 24kHz" },
              { label: "Visão", value: "JPEG 5fps / 2s" },
            ].map((i) => (
              <div key={i.label}>
                <p className="text-muted-foreground">{i.label}</p>
                <p className="font-mono text-foreground">{i.value}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
