import React, { useEffect, useMemo, useState } from 'react';
import { apiUrl } from '../../services/runtimeBase';

type RuntimeConfig = {
  mcpEnabled: boolean;
  mcpRequireAuth: boolean;
  mcpToken: string;
  mcpAllowCommands: boolean;
  mcpReadOnly: boolean;
  ngrokEnabled: boolean;
  ngrokAutostart: boolean;
  ngrokDomain: string;
  ngrokAuthtoken: string;
  panelProxyEnabled: boolean;
  panelDevUrl: string;
  panelProxyTimeoutMs: number;
  localPanelUrl: string;
  localApiUrl: string;
  localMcpUrl: string;
  remoteBaseUrl: string;
  remoteMcpUrl: string;
  authMode: 'token' | 'no-auth';
};

type TunnelStatus = {
  active?: boolean;
  starting?: boolean;
  url?: string | null;
  mcpUrl?: string | null;
  domain?: string | null;
  lastError?: string | null;
};

const defaultConfig: RuntimeConfig = {
  mcpEnabled: true,
  mcpRequireAuth: true,
  mcpToken: '',
  mcpAllowCommands: true,
  mcpReadOnly: false,
  ngrokEnabled: true,
  ngrokAutostart: true,
  ngrokDomain: '',
  ngrokAuthtoken: '',
  panelProxyEnabled: true,
  panelDevUrl: 'http://127.0.0.1:5173',
  panelProxyTimeoutMs: 15000,
  localPanelUrl: 'http://127.0.0.1:5173',
  localApiUrl: 'http://127.0.0.1:3001',
  localMcpUrl: 'http://127.0.0.1:3001/mcp',
  remoteBaseUrl: '',
  remoteMcpUrl: '',
  authMode: 'token',
};

const card = 'bg-slate-900/70 border border-slate-800 rounded-[2rem] p-6';
const input = 'w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-white outline-none focus:border-emerald-500';
const label = 'block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2';

const RuntimeModule: React.FC = () => {
  const [form, setForm] = useState<RuntimeConfig>(defaultConfig);
  const [tunnel, setTunnel] = useState<TunnelStatus>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyTunnel, setBusyTunnel] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const remoteMcpUrl = useMemo(() => {
    if (tunnel.mcpUrl) return tunnel.mcpUrl;
    if (form.remoteMcpUrl) return form.remoteMcpUrl;
    return form.ngrokDomain ? `https://${form.ngrokDomain}/mcp` : '';
  }, [tunnel.mcpUrl, form.remoteMcpUrl, form.ngrokDomain]);

  const remotePanelUrl = useMemo(() => {
    if (tunnel.url) return tunnel.url;
    if (form.remoteBaseUrl) return form.remoteBaseUrl;
    return form.ngrokDomain ? `https://${form.ngrokDomain}` : '';
  }, [tunnel.url, form.remoteBaseUrl, form.ngrokDomain]);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [cfgRes, tunnelRes] = await Promise.all([
        fetch(apiUrl('/api/system/runtime-config'), { cache: 'no-store' }),
        fetch(apiUrl('/api/system/tunnel-status'), { cache: 'no-store' }),
      ]);
      const cfgJson = await cfgRes.json();
      const tunnelJson = await tunnelRes.json();
      if (!cfgRes.ok || !cfgJson?.ok) throw new Error(cfgJson?.error || 'Falha ao ler runtime config');
      setForm({ ...defaultConfig, ...(cfgJson.config || {}) });
      setTunnel(tunnelJson || {});
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const patch = (field: keyof RuntimeConfig, value: string | boolean | number) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const save = async () => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const res = await fetch(apiUrl('/api/system/runtime-config'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error || 'Falha ao salvar');
      setForm({ ...defaultConfig, ...(json.config || {}) });
      setTunnel(json.tunnel || {});
      setMessage('Configurações salvas.');
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setSaving(false);
    }
  };

  const tunnelAction = async (action: 'start' | 'stop') => {
    setBusyTunnel(true);
    setError('');
    setMessage('');
    try {
      const res = await fetch(apiUrl(`/api/system/${action}-tunnel`), { method: 'POST' });
      const json = await res.json();
      if (!res.ok || json?.ok === false) throw new Error(json?.error || json?.lastError || `Falha ao ${action === 'start' ? 'subir' : 'parar'} túnel`);
      setTunnel(json || {});
      setMessage(action === 'start' ? 'Túnel iniciado.' : 'Túnel parado.');
      await load();
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setBusyTunnel(false);
    }
  };

  if (loading) {
    return <div className="text-slate-400">Carregando runtime...</div>;
  }

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.35em] text-slate-500">Runtime Control</p>
          <h2 className="text-4xl font-black tracking-tight text-white mt-2">MCP + Túnel</h2>
        </div>
        <div className="flex gap-3">
          <button onClick={load} className="px-5 py-3 rounded-2xl border border-slate-700 text-slate-300 text-[11px] font-black uppercase tracking-widest">Atualizar</button>
          <button onClick={save} disabled={saving} className="px-5 py-3 rounded-2xl bg-emerald-600 text-white text-[11px] font-black uppercase tracking-widest disabled:opacity-60">{saving ? 'Salvando...' : 'Salvar'}</button>
        </div>
      </header>

      {(message || error) && (
        <div className={`${card} ${error ? 'border-rose-500/30' : 'border-emerald-500/30'}`}>
          <p className={`text-sm font-semibold ${error ? 'text-rose-300' : 'text-emerald-300'}`}>{error || message}</p>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className={card}>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-3">Status MCP</p>
          <p className="text-2xl font-black text-white">{form.mcpEnabled ? 'Ligado' : 'Desligado'}</p>
          <p className="text-sm text-slate-400 mt-2">Auth: {form.mcpRequireAuth ? 'Token customizado' : 'Sem auth'}</p>
          <p className="text-sm text-slate-400 mt-1 break-all">{remoteMcpUrl || form.localMcpUrl}</p>
        </div>
        <div className={card}>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-3">Status Túnel</p>
          <p className="text-2xl font-black text-white">{tunnel.active ? 'Online' : tunnel.starting ? 'Subindo' : 'Offline'}</p>
          <p className="text-sm text-slate-400 mt-2 break-all">{remotePanelUrl || 'Sem URL remota'}</p>
          {tunnel.lastError && <p className="text-xs text-rose-300 mt-2">{tunnel.lastError}</p>}
        </div>
        <div className={card}>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-3">Ações</p>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => tunnelAction('start')} disabled={busyTunnel} className="py-3 rounded-2xl bg-emerald-600 text-white text-[11px] font-black uppercase tracking-widest disabled:opacity-60">Subir túnel</button>
            <button onClick={() => tunnelAction('stop')} disabled={busyTunnel} className="py-3 rounded-2xl border border-slate-700 text-slate-300 text-[11px] font-black uppercase tracking-widest disabled:opacity-60">Parar túnel</button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <section className={card}>
          <h3 className="text-lg font-black text-white mb-6">Servidor MCP</h3>
          <div className="space-y-4">
            <label className="flex items-center justify-between gap-4">
              <span className={label}>MCP ativo</span>
              <input type="checkbox" checked={form.mcpEnabled} onChange={(e) => patch('mcpEnabled', e.target.checked)} />
            </label>
            <label className="flex items-center justify-between gap-4">
              <span className={label}>Exigir token</span>
              <input type="checkbox" checked={form.mcpRequireAuth} onChange={(e) => patch('mcpRequireAuth', e.target.checked)} />
            </label>
            <label className="flex items-center justify-between gap-4">
              <span className={label}>Permitir comandos shell</span>
              <input type="checkbox" checked={form.mcpAllowCommands} onChange={(e) => patch('mcpAllowCommands', e.target.checked)} />
            </label>
            <label className="flex items-center justify-between gap-4">
              <span className={label}>Modo somente leitura</span>
              <input type="checkbox" checked={form.mcpReadOnly} onChange={(e) => patch('mcpReadOnly', e.target.checked)} />
            </label>
            <div>
              <span className={label}>Token MCP</span>
              <input className={input} value={form.mcpToken} onChange={(e) => patch('mcpToken', e.target.value)} placeholder="Bearer token do MCP" />
            </div>
            <div>
              <span className={label}>URL MCP remota</span>
              <input className={input} value={remoteMcpUrl} readOnly />
            </div>
          </div>
        </section>

        <section className={card}>
          <h3 className="text-lg font-black text-white mb-6">Túnel / Painel</h3>
          <div className="space-y-4">
            <label className="flex items-center justify-between gap-4">
              <span className={label}>Ngrok ativo</span>
              <input type="checkbox" checked={form.ngrokEnabled} onChange={(e) => patch('ngrokEnabled', e.target.checked)} />
            </label>
            <label className="flex items-center justify-between gap-4">
              <span className={label}>Autostart</span>
              <input type="checkbox" checked={form.ngrokAutostart} onChange={(e) => patch('ngrokAutostart', e.target.checked)} />
            </label>
            <div>
              <span className={label}>Domínio fixo ngrok</span>
              <input className={input} value={form.ngrokDomain} onChange={(e) => patch('ngrokDomain', e.target.value)} placeholder="supersufficient-reynalda-thankless.ngrok-free.dev" />
            </div>
            <div>
              <span className={label}>Authtoken ngrok</span>
              <input className={input} value={form.ngrokAuthtoken} onChange={(e) => patch('ngrokAuthtoken', e.target.value)} placeholder="NGROK_AUTHTOKEN" />
            </div>
            <label className="flex items-center justify-between gap-4">
              <span className={label}>Proxy do painel</span>
              <input type="checkbox" checked={form.panelProxyEnabled} onChange={(e) => patch('panelProxyEnabled', e.target.checked)} />
            </label>
            <div>
              <span className={label}>URL local do painel</span>
              <input className={input} value={form.panelDevUrl} onChange={(e) => patch('panelDevUrl', e.target.value)} placeholder="http://127.0.0.1:5173" />
            </div>
            <div>
              <span className={label}>URL painel remoto</span>
              <input className={input} value={remotePanelUrl} readOnly />
            </div>
          </div>
        </section>
      </div>

      <section className={card}>
        <h3 className="text-lg font-black text-white mb-4">Uso no ChatGPT</h3>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-slate-400">URL MCP</p>
            <p className="text-white break-all">{remoteMcpUrl || 'Suba o túnel primeiro'}</p>
          </div>
          <div>
            <p className="text-slate-400">Autenticação</p>
            <p className="text-white">{form.mcpRequireAuth ? 'Token customizado (não entra direto nessa UI do ChatGPT)' : 'No Authentication'}</p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default RuntimeModule;
