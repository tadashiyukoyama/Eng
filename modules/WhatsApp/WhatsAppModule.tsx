
import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { askKlaus } from '../../services/geminiService';
import { apiUrl } from '../../services/runtimeBase';

type LogItem = { msg: string; type: 'ia' | 'sys' | 'user'; time: string };

type MetaConfig = {
  provider: 'web' | 'meta';
  enabled: boolean;
  apiVersion: string;
  appId: string;
  businessAccountId: string;
  phoneNumberId: string;
  verifyToken: string;
  accessToken: string;
  webhookPath: string;
};

type MetaState = {
  enabled?: boolean;
  connected?: boolean;
  status?: string;
  lastError?: string | null;
  apiVersion?: string;
  appId?: string;
  businessAccountId?: string;
  phoneNumberId?: string;
  verifyToken?: string;
  accessToken?: string;
  webhookPath?: string;
  provider?: 'web' | 'meta';
};

const defaultMetaConfig: MetaConfig = {
  provider: 'web',
  enabled: false,
  apiVersion: 'v23.0',
  appId: '',
  businessAccountId: '',
  phoneNumberId: '',
  verifyToken: '',
  accessToken: '',
  webhookPath: '/api/whatsapp/meta/webhook',
};

const isLocalhostHost = (host: string) => {
  const value = String(host || '').toLowerCase();
  return value.includes('localhost') || value.startsWith('127.0.0.1');
};

const normalizeBaseUrl = (value?: string | null) => String(value || '').replace(/\/$/, '');

const WhatsAppModule: React.FC = () => {
  const { executeAction } = useApp();
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [nexusStatus, setNexusStatus] = useState('offline');
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [terminalInput, setTerminalInput] = useState('');
  const [directMsg, setDirectMsg] = useState({ to: '', text: '' });
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeSessions, setActiveSessions] = useState(0);
  const [provider, setProvider] = useState<'web' | 'meta'>('web');
  const [metaConfig, setMetaConfig] = useState<MetaConfig>(defaultMetaConfig);
  const [metaState, setMetaState] = useState<MetaState>({});
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [savingMeta, setSavingMeta] = useState(false);
  const [metaMessage, setMetaMessage] = useState('');
  const [metaError, setMetaError] = useState('');
  const [publicBaseUrl, setPublicBaseUrl] = useState('');
  const [publicBaseUrlOverride, setPublicBaseUrlOverride] = useState(() => {
    try {
      return window.localStorage.getItem('klaus.meta.publicBaseUrlOverride') || '';
    } catch {
      return '';
    }
  });

  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchStatus = async () => {
    try {
      const res = await fetch(apiUrl('/status'), { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setNexusStatus(data.status || 'offline');
        setLogs(data.logs || []);
        setActiveSessions(data.sessions || 0);
        setProvider((data.provider || 'web') === 'meta' ? 'meta' : 'web');
        setMetaState(data.meta || {});
        if (data.qr) setQrCode(data.qr);
        else setQrCode(null);
      } else {
        setNexusStatus('offline');
      }
    } catch {
      setNexusStatus('offline');
    }
  };

  const loadTunnelStatus = async () => {
    try {
      const res = await fetch(apiUrl('/api/system/tunnel-status'), { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      setPublicBaseUrl(normalizeBaseUrl(data?.panelRemoteUrl || data?.url || ''));
    } catch {}
  };

  const loadMetaConfig = async () => {
    setLoadingMeta(true);
    setMetaError('');
    try {
      const res = await fetch(apiUrl('/api/whatsapp/meta/config'), { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || 'Falha ao carregar config Meta');
      setMetaConfig({ ...defaultMetaConfig, ...(data.config || {}) });
      setMetaState(data.state || {});
    } catch (e: any) {
      setMetaError(e?.message || String(e));
    } finally {
      setLoadingMeta(false);
    }
  };

  useEffect(() => {
    const timer = setInterval(fetchStatus, 3000);
    fetchStatus();
    loadMetaConfig();
    loadTunnelStatus();
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [logs]);

  useEffect(() => {
    try {
      if (publicBaseUrlOverride) window.localStorage.setItem('klaus.meta.publicBaseUrlOverride', publicBaseUrlOverride);
      else window.localStorage.removeItem('klaus.meta.publicBaseUrlOverride');
    } catch {}
  }, [publicBaseUrlOverride]);

  const handleTerminalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!terminalInput || isProcessing) return;
    setIsProcessing(true);
    await askKlaus('Nexus Command', terminalInput, 'Você é o controlador do Nexus Bridge.', (name, args) => executeAction(name, args));
    setTerminalInput('');
    setIsProcessing(false);
  };

  const sendDirectMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!directMsg.to || !directMsg.text) return;
    try {
      const res = await fetch(apiUrl('/api/whatsapp/send'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: directMsg.to, message: directMsg.text })
      });
      if (!res.ok) throw new Error('Erro ao disparar mensagem');
      setDirectMsg({ ...directMsg, text: '' });
      alert(`Mensagem enviada pelo provider ${provider === 'meta' ? 'Meta' : 'QR/Web'}!`);
    } catch {
      alert('Erro ao disparar mensagem.');
    }
  };

  const saveMetaConfig = async () => {
    setSavingMeta(true);
    setMetaError('');
    setMetaMessage('');
    try {
      const res = await fetch(apiUrl('/api/whatsapp/meta/config'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metaConfig),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || 'Falha ao salvar config Meta');
      setMetaConfig({ ...defaultMetaConfig, ...(data.config || {}) });
      setMetaState(data.state || {});
      setProvider((((data.config || {}).provider) || 'web') === 'meta' ? 'meta' : 'web');
      setMetaMessage('Configuração Meta salva.');
      fetchStatus();
      loadTunnelStatus();
    } catch (e: any) {
      setMetaError(e?.message || String(e));
    } finally {
      setSavingMeta(false);
    }
  };

  const currentOrigin = normalizeBaseUrl(window.location.origin);
  const manualBaseUrl = normalizeBaseUrl(publicBaseUrlOverride);
  const resolvedBaseUrl = manualBaseUrl || publicBaseUrl || (!isLocalhostHost(window.location.host) ? currentOrigin : '');
  const webhookUrl = resolvedBaseUrl
    ? `${resolvedBaseUrl}${metaConfig.webhookPath || '/api/whatsapp/meta/webhook'}`
    : 'URL pública indisponível — ligue o túnel para validar na Meta.';
  const usingMeta = provider === 'meta';
  const webhookNeedsTunnel = !resolvedBaseUrl;

  return (
    <div className="space-y-8 animate-fadeIn pb-20">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-5xl font-black text-white italic tracking-tighter uppercase leading-none">
            Nexus <span className="text-emerald-500 font-extralight not-italic">Bridge</span>
          </h2>
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.4em] mt-2">WHATSAPP PROVIDER CONTROL</p>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex px-6 py-3 bg-slate-900/50 border border-slate-800 rounded-2xl items-center gap-4">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Atividade</span>
            <span className="text-xl font-mono font-bold text-emerald-500">{activeSessions}</span>
          </div>
          <div className={`flex items-center gap-4 px-8 py-4 rounded-[2rem] border ${nexusStatus === 'connected' ? 'bg-emerald-500/5 border-emerald-500/30' : 'bg-slate-900 border-slate-800'}`}>
            <div className={`w-2.5 h-2.5 rounded-full ${nexusStatus === 'connected' ? 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.8)] animate-pulse' : 'bg-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.5)]'}`}></div>
            <span className={`text-[11px] font-black uppercase tracking-[0.2em] ${nexusStatus === 'connected' ? 'text-emerald-400' : 'text-rose-400'}`}>
              {nexusStatus === 'connected' ? 'ONLINE' : String(nexusStatus || 'OFFLINE').toUpperCase()}
            </span>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        <div className="xl:col-span-8 bg-slate-950 border border-slate-800/50 rounded-[3rem] overflow-hidden shadow-2xl">
          <div className="p-8 border-b border-slate-900 bg-slate-950/80 flex justify-between items-center backdrop-blur-md">
            <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-[0.3em]">Fluxo de Telemetria Klaus</h3>
            <span className="text-[9px] font-mono text-emerald-500">Provider: {provider.toUpperCase()}</span>
          </div>
          <div className="h-[440px] overflow-y-auto p-8 space-y-4 scrollbar-hide flex flex-col-reverse" ref={scrollRef}>
            {logs.map((log, i) => (
              <div key={i} className={`p-4 rounded-2xl border ${
                log.type === 'ia' ? 'bg-emerald-500/5 border-emerald-500/10' :
                log.type === 'user' ? 'bg-blue-500/5 border-blue-500/10' : 'bg-slate-900/50 border-slate-800'
              }`}>
                <div className="flex justify-between mb-2">
                  <span className={`text-[8px] font-black uppercase tracking-widest ${log.type === 'ia' ? 'text-emerald-500' : 'text-slate-500'}`}>
                    {log.type === 'ia' ? 'KLAUS_THINK' : log.type === 'user' ? 'IN_SIGNAL' : 'SYS_EVENT'}
                  </span>
                  <span className="text-[8px] font-mono text-slate-700">{log.time}</span>
                </div>
                <p className="text-xs font-mono text-slate-300 leading-relaxed">{log.msg}</p>
              </div>
            ))}
          </div>
          <form onSubmit={handleTerminalSubmit} className="p-6 bg-slate-950 border-t border-slate-900">
            <input
              type="text"
              value={terminalInput}
              onChange={e => setTerminalInput(e.target.value)}
              placeholder="Comando manual para o Klaus..."
              className="w-full bg-slate-900 border border-slate-800 rounded-xl py-4 px-6 text-emerald-400 font-mono text-sm outline-none focus:border-emerald-500/50"
            />
          </form>
        </div>

        <div className="xl:col-span-4 space-y-8">
          <div className="bg-slate-900 border border-slate-800 rounded-[3rem] p-8 shadow-2xl space-y-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-xs font-black uppercase tracking-[0.3em] text-emerald-500 italic">Provider WhatsApp</h3>
                <p className="text-slate-500 text-[11px] mt-2">Escolha entre QR/Web atual ou Meta API.</p>
              </div>
              <select
                value={metaConfig.provider}
                onChange={(e) => setMetaConfig(prev => ({ ...prev, provider: e.target.value === 'meta' ? 'meta' : 'web' }))}
                className="bg-slate-950 border border-slate-800 rounded-2xl p-3 text-xs text-white outline-none"
              >
                <option value="web">QR / Local</option>
                <option value="meta">Meta API</option>
              </select>
            </div>

            {usingMeta ? (
              <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/5 p-5 text-sm text-emerald-100">
                O fluxo ativo está usando <strong>Meta API</strong>. As mensagens de texto entram pelo webhook abaixo e seguem o mesmo pipeline principal do WhatsApp.
              </div>
            ) : (
              <div className="rounded-3xl border border-slate-800 bg-slate-950 p-6 text-center">
                {qrCode ? (
                  <div className="bg-white p-4 rounded-[2rem] inline-block shadow-2xl">
                    <img src={qrCode} alt="WhatsApp QR" className="w-56 h-56" />
                  </div>
                ) : (
                  <div className="opacity-40 py-10">
                    <div className="text-6xl">🛰️</div>
                    <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 mt-4">QR / Local</p>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => fetch(apiUrl('/api/system/start-whatsapp'), { method: 'POST' }).then(fetchStatus)} className="py-3 bg-slate-950 hover:bg-slate-900 text-slate-300 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border border-slate-800">
                Start
              </button>
              <button onClick={() => fetch(apiUrl('/api/system/stop-whatsapp'), { method: 'POST' }).then(fetchStatus)} className="py-3 bg-slate-950 hover:bg-slate-900 text-slate-300 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border border-slate-800">
                Stop
              </button>
            </div>

            <button onClick={() => fetch(apiUrl('/api/system/restart-whatsapp'), { method: 'POST' }).then(fetchStatus)} className="w-full py-3 bg-slate-800 hover:bg-rose-900/30 hover:text-rose-400 text-slate-300 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border border-slate-700">
              Resetar conexão
            </button>

            <form onSubmit={sendDirectMessage} className="space-y-4 border-t border-slate-800 pt-6">
              <label className="text-[10px] font-black text-slate-500 uppercase ml-1">Disparo direto</label>
              <input
                type="text"
                placeholder={usingMeta ? '5511999999999' : '5511999999999 ou @c.us'}
                value={directMsg.to}
                onChange={e => setDirectMsg({ ...directMsg, to: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs text-white outline-none focus:border-emerald-500"
              />
              <textarea
                placeholder="Mensagem..."
                value={directMsg.text}
                onChange={e => setDirectMsg({ ...directMsg, text: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs text-white outline-none focus:border-emerald-500 h-24 resize-none"
              />
              <button type="submit" className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl transition-all">
                Enviar mensagem ⚡
              </button>
            </form>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-[3rem] p-8 shadow-2xl space-y-5">
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-xs font-black uppercase tracking-[0.3em] text-cyan-400 italic">Meta API</h3>
              <button onClick={() => { loadMetaConfig(); loadTunnelStatus(); }} className="px-4 py-2 rounded-2xl border border-slate-700 text-slate-300 text-[10px] font-black uppercase tracking-widest">
                {loadingMeta ? 'Carregando...' : 'Atualizar'}
              </button>
            </div>

            {(metaMessage || metaError) && (
              <div className={`rounded-2xl border p-4 text-sm ${metaError ? 'border-rose-500/30 bg-rose-500/10 text-rose-200' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'}`}>
                {metaError || metaMessage}
              </div>
            )}

            <label className="flex items-center justify-between text-sm text-slate-300">
              <span>Habilitar Meta</span>
              <input type="checkbox" checked={!!metaConfig.enabled} onChange={(e) => setMetaConfig(prev => ({ ...prev, enabled: e.target.checked }))} />
            </label>

            <input className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs text-white outline-none focus:border-emerald-500" value={metaConfig.apiVersion} onChange={(e) => setMetaConfig(prev => ({ ...prev, apiVersion: e.target.value }))} placeholder="v23.0" />
            <input className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs text-white outline-none focus:border-emerald-500" value={metaConfig.appId} onChange={(e) => setMetaConfig(prev => ({ ...prev, appId: e.target.value }))} placeholder="Meta App ID" />
            <input className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs text-white outline-none focus:border-emerald-500" value={metaConfig.businessAccountId} onChange={(e) => setMetaConfig(prev => ({ ...prev, businessAccountId: e.target.value }))} placeholder="Business Account ID" />
            <input className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs text-white outline-none focus:border-emerald-500" value={metaConfig.phoneNumberId} onChange={(e) => setMetaConfig(prev => ({ ...prev, phoneNumberId: e.target.value }))} placeholder="Phone Number ID" />
            <input className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs text-white outline-none focus:border-emerald-500" value={metaConfig.verifyToken} onChange={(e) => setMetaConfig(prev => ({ ...prev, verifyToken: e.target.value }))} placeholder="Verify Token" />
            <input className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs text-white outline-none focus:border-emerald-500" value={metaConfig.accessToken} onChange={(e) => setMetaConfig(prev => ({ ...prev, accessToken: e.target.value }))} placeholder="Access Token" />
            <input className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs text-white outline-none focus:border-cyan-500" value={publicBaseUrlOverride} onChange={(e) => setPublicBaseUrlOverride(e.target.value)} placeholder="Base pública do webhook (ex: https://supersufficient-reynalda-thankless.ngrok-free.dev)" />

            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 text-xs text-slate-300 space-y-2">
              <div><strong>Base pública:</strong> <span className="break-all">{resolvedBaseUrl || 'não definida'}</span></div>
              <div><strong>Webhook Meta:</strong> <span className="break-all">{webhookUrl}</span></div>
              <div className="text-slate-400">Use somente a base do domínio público. O app monta sozinho <strong>/api/whatsapp/meta/webhook</strong>. Não use <strong>/mcp</strong> aqui.</div>
              {webhookNeedsTunnel && (
                <div className="text-amber-300">
                  Abra esta tela pelo domínio público do túnel, ligue o túnel no módulo Runtime, ou preencha manualmente a base pública acima para validar esse webhook na Meta.
                </div>
              )}
              <div><strong>Status Meta:</strong> {metaState.status || 'unknown'}</div>
              {!!metaState.lastError && <div className="text-rose-300"><strong>Erro:</strong> {metaState.lastError}</div>}
            </div>

            <button onClick={saveMetaConfig} disabled={savingMeta} className="w-full py-4 bg-cyan-600 hover:bg-cyan-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl transition-all disabled:opacity-60">
              {savingMeta ? 'Salvando...' : 'Salvar configuração Meta'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WhatsAppModule;
