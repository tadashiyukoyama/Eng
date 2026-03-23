import fs from 'fs';
import path from 'path';

function envBool(name, fallback = false) {
  const raw = String(process.env[name] ?? '').trim().toLowerCase();
  if (!raw) return fallback;
  return !['0', 'false', 'no', 'off'].includes(raw);
}

function normalizeDomainInput(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  return raw.replace(/^https?:\/\//i, '').replace(/\/$/, '');
}

function isReservedDomainId(value) {
  return /^rd_[a-zA-Z0-9]+$/.test(String(value || '').trim());
}

export function createNgrokManager(options = {}) {
  const port = Number(options.port || 3001);
  const logDir = options.logDir || path.join(process.cwd(), 'logs');
  const logPath = path.join(logDir, 'ngrok.log');
  const apiBase = String(process.env.NGROK_API_BASE || 'https://api.ngrok.com').replace(/\/$/, '');
  const upstreamUrl = `http://127.0.0.1:${port}`;

  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

  let listener = null;
  let state = {
    enabled: envBool('NGROK_ENABLED', false),
    autostart: envBool('NGROK_AUTOSTART', false),
    active: false,
    starting: false,
    url: null,
    mcpUrl: null,
    domain: null,
    reservedDomainId: String(process.env.NGROK_RESERVED_DOMAIN_ID || '').trim() || null,
    upstream: upstreamUrl,
    startedAt: null,
    lastError: null,
    source: null,
  };

  function log(line, extra) {
    try {
      const payload = extra ? ` | ${JSON.stringify(extra).slice(0, 5000)}` : '';
      fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${line}${payload}
`);
    } catch {}
  }

  async function resolveDomain() {
    const rawDomain = normalizeDomainInput(process.env.NGROK_DOMAIN || '');
    const reservedId = String(process.env.NGROK_RESERVED_DOMAIN_ID || '').trim() || (isReservedDomainId(rawDomain) ? rawDomain : '');
    const authtoken = String(process.env.NGROK_AUTHTOKEN || '').trim();

    if (rawDomain && !isReservedDomainId(rawDomain)) {
      return { domain: rawDomain, source: 'env-domain' };
    }

    if (!reservedId) {
      throw new Error('NGROK_DOMAIN ou NGROK_RESERVED_DOMAIN_ID não configurado.');
    }

    if (!authtoken) {
      throw new Error('NGROK_AUTHTOKEN não configurado.');
    }

    const response = await fetch(`${apiBase}/reserved_domains/${encodeURIComponent(reservedId)}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${authtoken}`,
        'ngrok-version': '2',
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`Falha ao resolver reserved domain (${response.status}): ${body || response.statusText}`);
    }

    const data = await response.json();
    const domain = normalizeDomainInput(data?.domain || '');
    if (!domain) throw new Error('A API da ngrok não retornou o domínio reservado.');
    return { domain, source: 'api-reserved-domain', reservedId };
  }

  async function start() {
    state.enabled = envBool('NGROK_ENABLED', false);
    state.autostart = envBool('NGROK_AUTOSTART', false);

    if (!state.enabled) {
      state.lastError = 'NGROK_ENABLED=false';
      return { ok: false, ...state };
    }

    if (listener) {
      return { ok: true, ...state };
    }

    state.starting = true;
    state.lastError = null;

    try {
      const authtoken = String(process.env.NGROK_AUTHTOKEN || '').trim();
      if (!authtoken) throw new Error('NGROK_AUTHTOKEN não configurado.');

      const resolved = await resolveDomain();
      const ngrok = await import('@ngrok/ngrok');
      listener = await ngrok.forward({
        addr: port,
        authtoken,
        domain: resolved.domain,
      });

      const url = String(listener.url()).replace(/\/$/, '');
      const mcpUrl = `${url}/mcp`;
      process.env.NGROK_DOMAIN = resolved.domain;
      process.env.MCP_PUBLIC_BASE_URL = url;
      process.env.MCP_PUBLIC_MCP_URL = mcpUrl;

      state = {
        ...state,
        active: true,
        starting: false,
        url,
        mcpUrl,
        domain: resolved.domain,
        reservedDomainId: resolved.reservedId || state.reservedDomainId,
        startedAt: new Date().toISOString(),
        lastError: null,
        source: resolved.source,
      };
      log('Tunnel online', { url, domain: resolved.domain, source: resolved.source, upstream: upstreamUrl });
      return { ok: true, ...state };
    } catch (error) {
      const message = error?.message || String(error);
      state = {
        ...state,
        active: false,
        starting: false,
        url: null,
        mcpUrl: null,
        startedAt: null,
        lastError: message,
      };
      log('Tunnel failed', { error: message });
      return { ok: false, error: message, ...state };
    }
  }

  async function stop() {
    try {
      if (listener?.close) await listener.close();
    } catch (error) {
      log('Tunnel stop error', { error: error?.message || String(error) });
    } finally {
      listener = null;
      state = {
        ...state,
        active: false,
        starting: false,
        url: null,
        mcpUrl: null,
        startedAt: null,
      };
      delete process.env.MCP_PUBLIC_BASE_URL;
      delete process.env.MCP_PUBLIC_MCP_URL;
    }
    return { ok: true, ...state };
  }

  function status() {
    state.enabled = envBool('NGROK_ENABLED', false);
    state.autostart = envBool('NGROK_AUTOSTART', false);
    return { ok: true, ...state };
  }

  return { start, stop, status };
}
