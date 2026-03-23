import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import qrcode from 'qrcode';
import pkg from 'whatsapp-web.js';
import OpenAI from 'openai';
import os from 'os';
import multer from 'multer';
import PDFDocument from 'pdfkit';
import crypto from 'crypto';
import { installMcpRuntime } from './mcpRuntime.js';
import { createNgrokManager } from './ngrokRuntime.js';

const { Client: WhatsAppClient, LocalAuth, MessageMedia } = pkg as any;

dotenv.config();
dotenv.config({ path: '.env.local' });

const app = express();
const PORT = 3001;

// =========================
// Config
// =========================
const CESAR_NUMBER = '5511961240197@c.us';
const DB_DIR = process.env.DB_DIR || path.join(process.cwd(), 'bd');
const DB_PATH = path.join(DB_DIR, 'db.json');

// (3.0 PRO) Memória persistente por conversa (30 dias)
const CONV_DIR = path.join(DB_DIR, 'conversations');
if (!fs.existsSync(CONV_DIR)) fs.mkdirSync(CONV_DIR, { recursive: true });

// (3.0 PRO+) Memória persistente do Suporte IA (30 dias)
const SUPPORT_CONV_DIR = path.join(DB_DIR, 'support_conversations');
if (!fs.existsSync(SUPPORT_CONV_DIR)) fs.mkdirSync(SUPPORT_CONV_DIR, { recursive: true });

// Logs em pasta na raiz (predefinida)
const LOG_DIR = path.join(process.cwd(), 'logs');
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
const LOG_MAIN_PATH = path.join(LOG_DIR, 'klaus.log');
const LOG_SUPPORT_PATH = path.join(LOG_DIR, 'support.log');
const LOG_JARVIS_PATH = path.join(LOG_DIR, 'jarvis.log');
const ngrokManager = createNgrokManager({ port: PORT, logDir: LOG_DIR });

// Templates (PDFs e outros arquivos) armazenados localmente
const TEMPLATES_DIR = path.join(DB_DIR, 'templates');
if (!fs.existsSync(TEMPLATES_DIR)) fs.mkdirSync(TEMPLATES_DIR, { recursive: true });

// Onde ficam as chaves (panel vai escrever aqui)
const ENV_PATH = process.env.ENV_PATH || path.join(process.cwd(), '.env');
const ENV_LOCAL_PATH = process.env.ENV_LOCAL_PATH || path.join(process.cwd(), '.env.local');

if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

app.use(cors() as any);
app.use(express.json({
  limit: '50mb',
  verify: (req: any, _res, buf) => {
    req.rawBody = buf?.toString('utf8') || '';
  },
}) as any);

const V4MCP_LOCAL_BASE = String(process.env.V4MCP_LOCAL_BASE || 'http://127.0.0.1:8765').replace(/\/$/, '');

async function proxyV4Workbench(req: express.Request, res: express.Response) {
  try {
    const incomingPath = String(req.path || '');
    const mappedPath = incomingPath === '/mcp-workbench'
      ? '/mcp'
      : incomingPath.startsWith('/mcp-workbench/')
        ? `/${incomingPath.slice('/mcp-workbench/'.length)}`
        : '/mcp';
    const query = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
    const targetUrl = `${V4MCP_LOCAL_BASE}${mappedPath}${query}`;
    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers: {
        ...(req.headers['content-type'] ? { 'Content-Type': String(req.headers['content-type']) } : {}),
        ...(req.headers.authorization ? { Authorization: String(req.headers.authorization) } : {}),
      },
      body: ['GET', 'HEAD'].includes(req.method.toUpperCase()) ? undefined : (((req as any).rawBody && String((req as any).rawBody).length) ? (req as any).rawBody : undefined),
    });

    res.status(upstream.status);
    upstream.headers.forEach((value, key) => {
      const lower = key.toLowerCase();
      if (['content-length', 'connection', 'transfer-encoding', 'content-encoding'].includes(lower)) return;
      res.setHeader(key, value);
    });

    const raw = Buffer.from(await upstream.arrayBuffer());
    res.send(raw);
  } catch (e: any) {
    res.status(502).json({ ok: false, error: `V4MCP indisponível: ${e?.message || e}` });
  }
}

type PanelRole = 'admin' | 'tester';
type PanelCapabilities = {
  canUseJarvis: boolean;
  canManualSend: boolean;
  canUseSupportAI: boolean;
  canEditSensitive: boolean;
  canModifyData: boolean;
};
type PanelSession = {
  id: string;
  role: PanelRole;
  email: string;
  createdAt: number;
  expiresAt: number;
};

const PANEL_SESSION_COOKIE = 'klaus_panel_session';
const PANEL_SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const panelSessions = new Map<string, PanelSession>();

function sha256(input: string) {
  return crypto.createHash('sha256').update(String(input || '')).digest('hex');
}

function getPanelAdminEmail() {
  return String(process.env.PANEL_ADMIN_EMAIL || '').trim().toLowerCase();
}

function getPanelAdminSecretHash() {
  return String(process.env.PANEL_ADMIN_SECRET_HASH || '').trim().toLowerCase();
}

function getPanelTesterSecretHash() {
  return String(process.env.PANEL_TESTER_SECRET_HASH || '').trim().toLowerCase();
}

function getPanelTesterId() {
  return String(process.env.PANEL_TESTER_ID || 'teste').trim().toLowerCase();
}

function envFlag(name: string, fallback = false) {
  const raw = String(process.env[name] ?? '').trim().toLowerCase();
  if (!raw) return fallback;
  return !['0', 'false', 'no', 'off'].includes(raw);
}

function normalizeHostInput(value: string | undefined | null) {
  return String(value || '').trim().replace(/^https?:\/\//i, '').replace(/\/$/, '');
}

function getPanelPublicHost() {
  const direct = normalizeHostInput(process.env.MCP_PUBLIC_PANEL_HOST || process.env.NGROK_DOMAIN || '').toLowerCase();
  if (direct) return direct;
  const base = String(process.env.MCP_PUBLIC_BASE_URL || '').trim();
  if (!base) return '';
  try {
    return normalizeHostInput(new URL(base).host).toLowerCase();
  } catch {
    return '';
  }
}

function getRequestHost(req: express.Request) {
  const raw = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  return normalizeHostInput(raw).toLowerCase();
}

function isRemotePanelRequest(req: express.Request) {
  const panelHost = getPanelPublicHost();
  const requestHost = getRequestHost(req);
  return !!panelHost && !!requestHost && requestHost === panelHost;
}

function parseCookies(req: express.Request) {
  const header = String(req.headers.cookie || '');
  const out: Record<string, string> = {};
  header.split(';').forEach((chunk) => {
    const idx = chunk.indexOf('=');
    if (idx === -1) return;
    const key = chunk.slice(0, idx).trim();
    const value = chunk.slice(idx + 1).trim();
    if (!key) return;
    try {
      out[key] = decodeURIComponent(value);
    } catch {
      out[key] = value;
    }
  });
  return out;
}

function setPanelSessionCookie(res: express.Response, value: string, secure = false) {
  const parts = [
    `${PANEL_SESSION_COOKIE}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.floor(PANEL_SESSION_TTL_MS / 1000)}`,
  ];
  if (secure) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

function clearPanelSessionCookie(res: express.Response, secure = false) {
  const parts = [
    `${PANEL_SESSION_COOKIE}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
  ];
  if (secure) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

function prunePanelSessions() {
  const now = Date.now();
  for (const [id, session] of panelSessions.entries()) {
    if (session.expiresAt <= now) panelSessions.delete(id);
  }
}

function createPanelSession(role: PanelRole, email: string) {
  prunePanelSessions();
  const id = crypto.randomBytes(24).toString('hex');
  const session: PanelSession = { id, role, email, createdAt: Date.now(), expiresAt: Date.now() + PANEL_SESSION_TTL_MS };
  panelSessions.set(id, session);
  return session;
}

function getPanelSession(req: express.Request) {
  prunePanelSessions();
  const cookies = parseCookies(req);
  const sessionId = String(cookies[PANEL_SESSION_COOKIE] || '').trim();
  if (!sessionId) return null;
  const session = panelSessions.get(sessionId);
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    panelSessions.delete(sessionId);
    return null;
  }
  return session;
}

function getPanelCapabilities(role: PanelRole | null): PanelCapabilities {
  if (role === 'admin') {
    return {
      canUseJarvis: true,
      canManualSend: true,
      canUseSupportAI: true,
      canEditSensitive: true,
      canModifyData: true,
    };
  }
  return {
    canUseJarvis: true,
    canManualSend: true,
    canUseSupportAI: false,
    canEditSensitive: false,
    canModifyData: false,
  };
}

function shouldBypassPanelApiAuth(pathname: string) {
  return pathname === '/api/panel/login'
    || pathname === '/api/panel/session'
    || pathname === '/api/panel/logout'
    || pathname === '/api/whatsapp/meta/webhook'
    || pathname === '/api/support/frontend-log';
}

function isTesterAllowedApi(req: express.Request) {
  if (req.method === 'GET' || req.method === 'HEAD') return true;
  if (req.method === 'POST' && (req.path === '/api/whatsapp/send' || req.path === '/api/support/frontend-log' || req.path === '/api/panel/logout')) {
    return true;
  }
  return false;
}

function getPanelProxyEnabled() {
  return envFlag('PANEL_PROXY_ENABLED', true);
}

function getPanelDevUrl() {
  return String(process.env.PANEL_DEV_URL || 'http://127.0.0.1:5173').replace(/\/$/, '');
}

function getPanelProxyTimeoutMs() {
  return Number(process.env.PANEL_PROXY_TIMEOUT_MS || 15000);
}

function shouldProxyPanelRequest(url = '') {
  return !url.startsWith('/api/')
    && url !== '/api'
    && !url.startsWith('/mcp')
    && url !== '/health'
    && url !== '/status';
}

async function proxyPanelRequest(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!getPanelProxyEnabled()) return next();
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  if (!shouldProxyPanelRequest(req.path)) return next();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getPanelProxyTimeoutMs());

  try {
    const targetUrl = `${getPanelDevUrl()}${req.originalUrl}`;
    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers: {
        Accept: String(req.headers.accept || '*/*'),
        'User-Agent': String(req.headers['user-agent'] || 'KlausPanelProxy/1.0'),
      },
      signal: controller.signal,
    });

    res.status(upstream.status);

    upstream.headers.forEach((value, key) => {
      const lower = key.toLowerCase();
      if (['content-length', 'connection', 'transfer-encoding', 'content-encoding'].includes(lower)) return;
      res.setHeader(key, value);
    });

    const body = Buffer.from(await upstream.arrayBuffer());
    res.send(body);
    return;
  } catch (e: any) {
    if (req.path === '/' || req.path === '/index.html') {
      return res.status(502).type('text/plain').send(`Painel não disponível em ${getPanelDevUrl()}. Suba o frontend antes de acessar pelo túnel.`);
    }
    return next();
  } finally {
    clearTimeout(timeout);
  }
}

function renderPanelLoginPage(error = '') {
  const safeError = String(error || '').replace(/[<>]/g, '');
  return `<!DOCTYPE html><html lang="pt-br"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>Klaus OS — Login</title><style>body{margin:0;font-family:Inter,system-ui,sans-serif;background:#020617;color:#e2e8f0;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px}.card{width:100%;max-width:420px;background:#0f172a;border:1px solid rgba(148,163,184,.18);border-radius:28px;padding:28px;box-shadow:0 20px 80px rgba(0,0,0,.35)}.eyebrow{font-size:11px;text-transform:uppercase;letter-spacing:.28em;color:#64748b;font-weight:800}h1{margin:10px 0 6px;font-size:34px;line-height:1;font-weight:900;letter-spacing:-.05em}p{color:#94a3b8;font-size:14px;line-height:1.5}label{display:block;margin:18px 0 8px;font-size:11px;text-transform:uppercase;letter-spacing:.2em;color:#64748b;font-weight:800}input{width:100%;box-sizing:border-box;background:#020617;border:1px solid #1e293b;border-radius:18px;padding:14px 16px;color:#fff;font-size:14px;outline:none}button{width:100%;margin-top:18px;background:#059669;border:0;color:#fff;border-radius:18px;padding:14px 16px;font-size:11px;text-transform:uppercase;letter-spacing:.24em;font-weight:900;cursor:pointer}.hint{margin-top:12px;color:#64748b;font-size:12px}.error{margin-bottom:12px;padding:12px 14px;border-radius:14px;background:#7f1d1d;color:#fecaca;border:1px solid #b91c1c;font-size:14px}</style></head><body><div class="card"><div class="eyebrow">Painel protegido</div><h1>Klaus OS</h1><p>Entre com seu login para acessar o painel web remoto.</p>${safeError ? `<div class="error">${safeError}</div>` : ''}<form id="loginForm"><label for="email">Login</label><input id="email" name="email" type="text" autocomplete="username" required /><label for="password">Senha</label><input id="password" name="password" type="password" autocomplete="current-password" required /><button type="submit">Entrar</button></form><div class="hint">Modo tester mantém o painel visível, mas bloqueia alterações sensíveis.</div></div><script>document.getElementById('loginForm').addEventListener('submit', async (event) => { event.preventDefault(); const email = document.getElementById('email').value; const password = document.getElementById('password').value; const res = await fetch('/api/panel/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) }); const data = await res.json().catch(() => ({})); if (!res.ok || !data.ok) { window.location.href = '/panel-login?error=' + encodeURIComponent(data.error || 'Falha no login'); return; } window.location.href = '/'; });</script></body></html>`;
}

app.get('/panel-login', (req, res) => {
  if (!isRemotePanelRequest(req)) return res.redirect('/');
  const current = getPanelSession(req);
  if (current) return res.redirect('/');
  res.status(200).type('html').send(renderPanelLoginPage(String(req.query.error || '').slice(0, 200)));
});

// panel remote auth hooks
app.get('/api/panel/session', (req, res) => {
  const session = getPanelSession(req);
  if (!session) {
    return res.json({ ok: true, authenticated: false, role: null, email: null, capabilities: getPanelCapabilities(null), remote: isRemotePanelRequest(req) });
  }
  return res.json({ ok: true, authenticated: true, role: session.role, email: session.email, capabilities: getPanelCapabilities(session.role), remote: isRemotePanelRequest(req) });
});

app.post('/api/panel/logout', (req, res) => {
  const current = getPanelSession(req);
  if (current) panelSessions.delete(current.id);
  clearPanelSessionCookie(res, isRemotePanelRequest(req));
  return res.json({ ok: true, authenticated: false });
});
app.post('/api/panel/login', (req, res) => {
  const loginId = String(req.body?.email || req.body?.login || '').trim().toLowerCase();
  const secret = String(req.body?.password || '').trim();
  if (!loginId || !secret) return res.status(400).json({ ok: false, error: 'Login e senha são obrigatórios.' });
  let role: PanelRole | null = null;
  if (loginId === getPanelAdminEmail() && sha256(secret) === getPanelAdminSecretHash()) role = 'admin';
  if (!role && loginId === getPanelTesterId() && sha256(secret) === getPanelTesterSecretHash()) role = 'tester';
  if (!role) return res.status(401).json({ ok: false, error: 'Credenciais inválidas.' });
  const session = createPanelSession(role, loginId);
  setPanelSessionCookie(res, session.id, isRemotePanelRequest(req));
  return res.json({ ok: true, authenticated: true, role: session.role, email: session.email, capabilities: getPanelCapabilities(session.role), remote: isRemotePanelRequest(req) });
});
function panelApiAuthMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!isRemotePanelRequest(req)) return next();
  if (!req.path.startsWith('/api/')) return next();
  if (shouldBypassPanelApiAuth(req.path)) return next();
  const session = getPanelSession(req);
  if (!session) return res.status(401).json({ ok: false, error: 'Login obrigatório no painel web.' });
  (req as any).panelSession = session;
  if (session.role !== 'admin' && !isTesterAllowedApi(req)) {
    return res.status(403).json({ ok: false, error: 'Acesso negado: disponível apenas para administrador.' });
  }
  return next();
}

function panelWebAuthMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!isRemotePanelRequest(req)) return next();
  if (!shouldProxyPanelRequest(req.path)) return next();
  const session = getPanelSession(req);
  if (session) {
    (req as any).panelSession = session;
    return next();
  }
  return res.redirect('/panel-login');
}

app.use(panelApiAuthMiddleware as any);
app.use(panelWebAuthMiddleware as any);
app.use(proxyPanelRequest as any);

// =========================
// State / Logs
// =========================
let lastDbUpdate = Date.now();
let activityLogs: any[] = [];
type WhatsAppProvider = 'web' | 'meta';
let currentState = { connected: false, qr: null as string | null, status: 'initializing', provider: 'web' as WhatsAppProvider };
let metaState = {
  enabled: false,
  connected: false,
  status: 'disabled',
  lastError: null as string | null,
  apiVersion: 'v23.0',
  appId: '',
  businessAccountId: '',
  phoneNumberId: '',
  verifyToken: '',
  accessToken: '',
  webhookPath: '/api/whatsapp/meta/webhook',
};

function getWhatsAppProvider(): WhatsAppProvider {
  try {
    const dbProvider = String(getDb()?.config?.whatsappMeta?.provider || '').trim().toLowerCase();
    if (dbProvider === 'meta' || dbProvider === 'web') return dbProvider as WhatsAppProvider;
  } catch {}
  const raw = String(process.env.WHATSAPP_PROVIDER || 'web').trim().toLowerCase();
  return raw === 'meta' ? 'meta' : 'web';
}

function normalizePhoneDigits(value: string | undefined | null) {
  return String(value || '').replace(/\D/g, '');
}

function toWebChatId(value: string | undefined | null) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (raw.includes('@')) return raw;
  const digits = normalizePhoneDigits(raw);
  return digits ? `${digits}@c.us` : raw;
}

function toMetaPhone(value: string | undefined | null) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (raw.toLowerCase() === 'master') return normalizePhoneDigits(CESAR_NUMBER);
  return normalizePhoneDigits(raw);
}

function readWhatsAppMetaConfig() {
  const dbCfg = (() => {
    try {
      return getDb()?.config?.whatsappMeta || {};
    } catch {
      return {};
    }
  })();
  return {
    provider: String(dbCfg.provider || process.env.WHATSAPP_PROVIDER || 'web').trim().toLowerCase() === 'meta' ? 'meta' : 'web',
    enabled: typeof dbCfg.enabled === 'boolean' ? dbCfg.enabled : envFlag('WHATSAPP_META_ENABLED', false),
    apiVersion: String(dbCfg.apiVersion || process.env.WHATSAPP_META_API_VERSION || 'v23.0').trim() || 'v23.0',
    appId: String(dbCfg.appId || process.env.WHATSAPP_META_APP_ID || '').trim(),
    businessAccountId: String(dbCfg.businessAccountId || process.env.WHATSAPP_META_BUSINESS_ACCOUNT_ID || '').trim(),
    phoneNumberId: String(dbCfg.phoneNumberId || process.env.WHATSAPP_META_PHONE_NUMBER_ID || '').trim(),
    verifyToken: String(dbCfg.verifyToken || process.env.WHATSAPP_META_VERIFY_TOKEN || '').trim(),
    accessToken: String(dbCfg.accessToken || process.env.WHATSAPP_META_ACCESS_TOKEN || '').trim(),
    webhookPath: '/api/whatsapp/meta/webhook',
  };
}

function applyWhatsAppMetaConfigPatch(input: any) {
  const db = getDb();
  db.config = db.config || {};
  const currentCfg = db.config.whatsappMeta || {};
  const currentMeta = readWhatsAppMetaConfig();
  const rawAccessToken = String(input?.accessToken ?? '').trim();
  const nextAccessToken = !rawAccessToken || rawAccessToken.includes('••••')
    ? String(currentCfg.accessToken || currentMeta.accessToken || '').trim()
    : rawAccessToken;

  db.config.whatsappMeta = {
    provider: String(input?.provider || currentMeta.provider || 'web').trim().toLowerCase() === 'meta' ? 'meta' : 'web',
    enabled: typeof input?.enabled === 'boolean' ? input.enabled : !!currentMeta.enabled,
    apiVersion: String(input?.apiVersion ?? currentMeta.apiVersion ?? 'v23.0').trim() || 'v23.0',
    appId: String(input?.appId ?? currentMeta.appId ?? '').trim(),
    businessAccountId: String(input?.businessAccountId ?? currentMeta.businessAccountId ?? '').trim(),
    phoneNumberId: String(input?.phoneNumberId ?? currentMeta.phoneNumberId ?? '').trim(),
    verifyToken: String(input?.verifyToken ?? currentMeta.verifyToken ?? '').trim(),
    accessToken: nextAccessToken,
  };
  saveDb(db);
  process.env.WHATSAPP_PROVIDER = db.config.whatsappMeta.provider;
  return refreshMetaState(null);
}

function isMetaReady(cfg = readWhatsAppMetaConfig()) {
  return !!(cfg.enabled && cfg.apiVersion && cfg.phoneNumberId && cfg.verifyToken && cfg.accessToken);
}

function refreshMetaState(lastError?: string | null) {
  const cfg = readWhatsAppMetaConfig();
  metaState = {
    ...metaState,
    ...cfg,
    connected: getWhatsAppProvider() === 'meta' && isMetaReady(cfg),
    status: !cfg.enabled ? 'disabled' : (isMetaReady(cfg) ? (getWhatsAppProvider() === 'meta' ? 'connected' : 'standby') : 'config_required'),
    lastError: typeof lastError === 'undefined' ? metaState.lastError : lastError,
  };
  return metaState;
}

function getWhatsappPublicState() {
  const provider = getWhatsAppProvider();
  if (provider === 'meta') {
    const meta = refreshMetaState();
    return {
      connected: meta.connected,
      qr: null,
      status: meta.status,
      provider,
      meta,
    };
  }
  return {
    ...currentState,
    provider,
    meta: refreshMetaState(),
  };
}

async function sendMetaApiRequest(endpoint: string, init?: RequestInit) {
  const cfg = readWhatsAppMetaConfig();
  if (!isMetaReady(cfg)) throw new Error('WhatsApp Meta não configurado completamente.');
  const response = await fetch(`https://graph.facebook.com/${cfg.apiVersion}/${String(endpoint || '').replace(/^\//, '')}`, {
    ...(init || {}),
    headers: {
      Authorization: `Bearer ${cfg.accessToken}`,
      ...(init?.headers || {}),
    },
  });
  const raw = await response.text();
  const data = raw ? (() => { try { return JSON.parse(raw); } catch { return raw; } })() : null;
  if (!response.ok) {
    throw new Error(typeof data === 'string' ? data : (data as any)?.error?.message || `Meta API ${response.status}`);
  }
  return data;
}

async function sendMetaTextMessage(to: string, text: string) {
  const cfg = readWhatsAppMetaConfig();
  if (!isMetaReady(cfg)) throw new Error('WhatsApp Meta não configurado completamente.');
  const phone = toMetaPhone(to);
  if (!phone) throw new Error('Número de destino inválido para WhatsApp Meta.');
  return await sendMetaApiRequest(`${cfg.phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: phone,
      type: 'text',
      text: {
        preview_url: false,
        body: String(text || '').slice(0, 4096),
      },
    }),
  });
}

async function sendMetaInteractiveMessage(to: string, interactive: any) {
  const cfg = readWhatsAppMetaConfig();
  const phone = toMetaPhone(to);
  if (!phone) throw new Error('Número de destino inválido para WhatsApp Meta.');
  return await sendMetaApiRequest(`${cfg.phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: phone,
      type: 'interactive',
      interactive,
    }),
  });
}

function getPublicBaseUrl() {
  return String(process.env.MCP_PUBLIC_BASE_URL || '').replace(/\/$/, '');
}

async function sendMetaDocumentLink(to: string, documentLink: string, filename: string, caption?: string) {
  const cfg = readWhatsAppMetaConfig();
  const phone = toMetaPhone(to);
  if (!phone) throw new Error('Número de destino inválido para WhatsApp Meta.');
  return await sendMetaApiRequest(`${cfg.phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: phone,
      type: 'document',
      document: {
        link: documentLink,
        filename,
        ...(caption ? { caption } : {}),
      },
    }),
  });
}

async function fetchMetaMediaBuffer(mediaId: string) {
  const meta = await sendMetaApiRequest(String(mediaId || '').trim());
  const mediaUrl = String((meta as any)?.url || '').trim();
  const mimeType = String((meta as any)?.mime_type || '').trim();
  if (!mediaUrl) throw new Error('Meta media URL ausente.');
  const cfg = readWhatsAppMetaConfig();
  const resp = await fetch(mediaUrl, {
    headers: { Authorization: `Bearer ${cfg.accessToken}` },
  });
  if (!resp.ok) throw new Error(`Falha ao baixar mídia Meta (${resp.status})`);
  const arr = await resp.arrayBuffer();
  return { buffer: Buffer.from(arr), mimeType, meta };
}

async function transcribeAudioBuffer(buffer: Buffer, mimeType?: string) {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY não configurada.');
  const ext = String((mimeType || 'audio/ogg').split('/')[1] || 'ogg').split(';')[0] || 'ogg';
  const tempPath = path.join(os.tmpdir(), `klaus-meta-audio-${Date.now()}.${ext}`);
  fs.writeFileSync(tempPath, buffer);
  try {
    const transcript = await openai.audio.transcriptions.create({
      model: 'whisper-1',
      file: fs.createReadStream(tempPath) as any,
    });
    return String((transcript as any)?.text || '').trim();
  } finally {
    try { fs.unlinkSync(tempPath); } catch {}
  }
}

async function sendWhatsAppMessage(to: string, message: any, options?: any) {
  if (getWhatsAppProvider() === 'meta') {
    if (message && typeof message === 'object' && (message as any).__metaInteractive) {
      return await sendMetaInteractiveMessage(to, (message as any).interactive);
    }
    if (message && typeof message === 'object' && (message as any).__metaDocumentLink) {
      return await sendMetaDocumentLink(
        to,
        String((message as any).link || ''),
        String((message as any).filename || 'documento.pdf'),
        options?.caption,
      );
    }
    const fallbackText = typeof message === 'string'
      ? message
      : [options?.caption || '', '[anexo indisponível no provider Meta nesta etapa]'].filter(Boolean).join('\n\n');
    return await sendMetaTextMessage(to, fallbackText || '[mensagem vazia]');
  }
  const chatId = toWebChatId(to);
  if (!chatId) throw new Error('Número de destino inválido.');
  return await wwClient.sendMessage(chatId, message, options);
}


const addLog = (msg: string, type: 'ia' | 'sys' | 'user' = 'sys') => {
  activityLogs.unshift({ msg, type, time: new Date().toLocaleTimeString() });
  if (activityLogs.length > 80) activityLogs.pop();

  // Persistência leve em arquivo (para diagnóstico)
  try {
    const line = `[${new Date().toISOString()}] [${type}] ${String(msg).replace(/\n/g, ' | ')}\n`;
    fs.appendFileSync(LOG_MAIN_PATH, line);
  } catch {}
};

// Logs vindos do frontend (Jarvis/VoiceModule). Úteis quando o erro só aparece no browser.
const addJarvisLog = (msg: string, extra?: any) => {
  try {
    const payload = extra ? ` | ${JSON.stringify(extra).slice(0, 4000)}` : '';
    const line = `[${new Date().toISOString()}] ${String(msg).replace(/\n/g, ' | ')}${payload}\n`;
    fs.appendFileSync(LOG_JARVIS_PATH, line);
  } catch {}
};

// =========================
// DB helpers
// =========================
const getDb = () => {
  if (!fs.existsSync(DB_PATH)) {
    const initial = {
      clients: [],
      transactions: [],
      budgets: [],
      agenda: [],
      templates: [],
      activeProfile: 'PROSPECTING_ALFA',
      companies: { bellarte: 'Bellarte Pinturas', alfa: 'Alfa DDT', personal: 'Vida Pessoal' },
      config: {
        klausPrompt: 'Yukoyama Engine: Controle Total para César.',
        prospectingAlfaPrompt: 'Abordagem AlfaDDT: Pergunta sobre controle de pragas e oferece plano de 89.90.',
        prospectingCustomPrompt: 'Perfil de Prospecção Customizável.',
        attendantPrompt: 'Suporte focado na satisfação do cliente.',
        companyDetails: {
          bellarte: { nome: 'Bellarte Pinturas' },
          alfa: { nome: 'Alfa DDT' },
          personal: { nome: 'Vida Pessoal' },
        },
        docTemplates: {
          bellarte: {
            budgetMessage: '🧾 *ORÇAMENTO — {{COMPANY_NAME}}*\n\nCliente: {{CLIENT_NAME}}\nServiço: {{SERVICE}}\nValor: R$ {{VALUE}}\nData: {{DATE}}\n\n{{COMPANY_PHONE}}',
            proposal: 'PROPOSTA — {{COMPANY_NAME}}\n\nCliente: {{CLIENT_NAME}}\nServiço: {{SERVICE}}\nValor: R$ {{VALUE}}\nData: {{DATE}}',
            contract: 'CONTRATO — {{COMPANY_NAME}}\n\nCliente: {{CLIENT_NAME}}\nServiço: {{SERVICE}}\nValor: R$ {{VALUE}}\nData: {{DATE}}',
          },
          alfa: {
            budgetMessage: '🧾 *ORÇAMENTO — {{COMPANY_NAME}}*\n\nCliente: {{CLIENT_NAME}}\nServiço: {{SERVICE}}\nValor: R$ {{VALUE}}\nData: {{DATE}}\n\nAtendimento 24h — {{COMPANY_PHONE}}',
            proposal: 'PROPOSTA — {{COMPANY_NAME}}\n\nCliente: {{CLIENT_NAME}}\nServiço: {{SERVICE}}\nValor: R$ {{VALUE}}\nData: {{DATE}}',
            contract: 'CONTRATO — {{COMPANY_NAME}}\n\nCliente: {{CLIENT_NAME}}\nServiço: {{SERVICE}}\nValor: R$ {{VALUE}}\nData: {{DATE}}',
          },
          personal: { budgetMessage: '{{TEXT}}', proposal: '{{TEXT}}', contract: '{{TEXT}}' }
        }
      },
    };
    fs.writeFileSync(DB_PATH, JSON.stringify(initial, null, 2));
    return initial;
  }

  const loaded = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
  // Normalização: garante chaves novas sem quebrar db antigo
  loaded.config = loaded.config || {};
  loaded.config.companyDetails = loaded.config.companyDetails || { bellarte: { nome: loaded.companies?.bellarte || 'Bellarte Pinturas' }, alfa: { nome: loaded.companies?.alfa || 'Alfa DDT' }, personal: { nome: loaded.companies?.personal || 'Vida Pessoal' } };
  loaded.config.docTemplates = loaded.config.docTemplates || {
    bellarte: { budgetMessage: '🧾 *ORÇAMENTO — {{COMPANY_NAME}}*\n\nCliente: {{CLIENT_NAME}}\nServiço: {{SERVICE}}\nValor: R$ {{VALUE}}\nData: {{DATE}}', proposal: 'PROPOSTA — {{COMPANY_NAME}}\n\nCliente: {{CLIENT_NAME}}\nServiço: {{SERVICE}}\nValor: R$ {{VALUE}}\nData: {{DATE}}', contract: 'CONTRATO — {{COMPANY_NAME}}\n\nCliente: {{CLIENT_NAME}}\nServiço: {{SERVICE}}\nValor: R$ {{VALUE}}\nData: {{DATE}}' },
    alfa: { budgetMessage: '🧾 *ORÇAMENTO — {{COMPANY_NAME}}*\n\nCliente: {{CLIENT_NAME}}\nServiço: {{SERVICE}}\nValor: R$ {{VALUE}}\nData: {{DATE}}', proposal: 'PROPOSTA — {{COMPANY_NAME}}\n\nCliente: {{CLIENT_NAME}}\nServiço: {{SERVICE}}\nValor: R$ {{VALUE}}\nData: {{DATE}}', contract: 'CONTRATO — {{COMPANY_NAME}}\n\nCliente: {{CLIENT_NAME}}\nServiço: {{SERVICE}}\nValor: R$ {{VALUE}}\nData: {{DATE}}' },
    personal: { budgetMessage: '{{TEXT}}', proposal: '{{TEXT}}', contract: '{{TEXT}}' }
  };
  loaded.templates = Array.isArray(loaded.templates) ? loaded.templates : [];
  return loaded;
};

const saveDb = (data: any) => {
  const tmpPath = `${DB_PATH}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2));
  fs.renameSync(tmpPath, DB_PATH);
  lastDbUpdate = Date.now();
};


installMcpRuntime(app, {
  projectRoot: process.cwd(),
  projectName: 'Klaus OS Local 3.0',
  port: PORT,
  dbPath: DB_PATH,
  logDir: LOG_DIR,
  logMainPath: LOG_MAIN_PATH,
  logSupportPath: LOG_SUPPORT_PATH,
  logJarvisPath: LOG_JARVIS_PATH,
  envPath: ENV_PATH,
  envLocalPath: ENV_LOCAL_PATH,
  getDb,
  saveDb,
  getAppState: () => ({
    currentState: getWhatsappPublicState(),
    lastDbUpdate,
    activityLogs,
  }),
  getSupportScanReport: () => buildSupportScanReport(),
  whatsappControl: {
    start: async () => {
      if (getWhatsAppProvider() === 'meta') {
        refreshMetaState(null);
        addLog('MCP: WhatsApp Meta start solicitado.', 'sys');
        return { ok: true, status: refreshMetaState().status, provider: 'meta' };
      }
      wwClient.initialize();
      currentState.provider = 'web';
      currentState.status = 'starting';
      addLog('MCP: WhatsApp start solicitado.', 'sys');
      return { ok: true, status: 'starting', provider: 'web' };
    },
    stop: async () => {
      if (getWhatsAppProvider() === 'meta') {
        refreshMetaState(null);
        metaState.connected = false;
        metaState.status = 'stopped';
        addLog('MCP: WhatsApp Meta stop solicitado.', 'sys');
        return { ok: true, status: 'stopped', provider: 'meta' };
      }
      await wwClient.destroy();
      currentState.connected = false;
      currentState.qr = null;
      currentState.status = 'stopped';
      addLog('MCP: WhatsApp stop solicitado.', 'sys');
      return { ok: true, status: 'stopped', provider: 'web' };
    },
    restart: async () => {
      if (getWhatsAppProvider() === 'meta') {
        refreshMetaState(null);
        metaState.connected = isMetaReady();
        metaState.status = metaState.connected ? 'connected' : 'config_required';
        addLog('MCP: WhatsApp Meta restart solicitado.', 'sys');
        return { ok: true, status: metaState.status, provider: 'meta' };
      }
      await wwClient.destroy();
      currentState.connected = false;
      currentState.status = 'restarting';
      setTimeout(() => {
        wwClient.initialize();
      }, 400);
      addLog('MCP: WhatsApp restart solicitado.', 'sys');
      return { ok: true, status: 'restarting', provider: 'web' };
    },
  },
});

// =========================
// Conversation Store (30 dias)
// =========================
type ConvMsg = { role: 'user' | 'assistant'; content: string; ts: number };
type ConvState = { previousResponseId?: string; messages: ConvMsg[] };

function convFileFor(sessionKey: string) {
  const safe = Buffer.from(sessionKey).toString('base64').replace(/[^a-zA-Z0-9]/g, '_');
  return path.join(CONV_DIR, `${safe}.json`);
}

function loadConversation(sessionKey: string): ConvState {
  try {
    const fp = convFileFor(sessionKey);
    if (!fs.existsSync(fp)) return { messages: [] };
    const parsed = JSON.parse(fs.readFileSync(fp, 'utf-8'));
    const messages: ConvMsg[] = Array.isArray(parsed?.messages) ? parsed.messages : [];
    const previousResponseId = typeof parsed?.previousResponseId === 'string' ? parsed.previousResponseId : undefined;
    return { previousResponseId, messages };
  } catch {
    return { messages: [] };
  }
}

function saveConversation(sessionKey: string, state: ConvState) {
  const fp = convFileFor(sessionKey);
  const tmp = `${fp}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
  fs.renameSync(tmp, fp);
}

function pruneConversationMessages(messages: ConvMsg[]) {
  const now = Date.now();
  const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
  const pruned = messages.filter((m) => now - Number(m.ts || 0) <= THIRTY_DAYS);
  // limite duro (evitar arquivo gigante)
  const MAX_MSGS = 200;
  return pruned.slice(Math.max(0, pruned.length - MAX_MSGS));
}

function appendConversation(sessionKey: string, msg: ConvMsg) {
  const state = loadConversation(sessionKey);
  const next = pruneConversationMessages([...(state.messages || []), msg]);
  saveConversation(sessionKey, { ...state, messages: next });
}

function buildMemoryBlock(sessionKey: string) {
  const state = loadConversation(sessionKey);
  const msgs = pruneConversationMessages(state.messages || []);
  if (!msgs.length) return '';
  // pega uma janela recente para evitar excesso de tokens
  const window = msgs.slice(Math.max(0, msgs.length - 30));
  const lines = window.map((m) => `${m.role === 'user' ? 'Cliente/Usuário' : 'Klaus'}: ${String(m.content || '').slice(0, 500)}`);
  return `\n\nMEMÓRIA (últimos 30 dias — conversa persistida):\n${lines.join('\n')}`;
}

// =========================
// Support Conversation Store (30 dias)
// =========================
type SupportMsg = { role: 'user' | 'assistant'; content: string; ts: number };
type SupportState = { previousResponseId?: string; messages: SupportMsg[]; pins?: { id: string; text: string; ts: number }[] };

function supportFileFor(sessionKey: string) {
  const safe = Buffer.from(sessionKey).toString('base64').replace(/[^a-zA-Z0-9]/g, '_');
  return path.join(SUPPORT_CONV_DIR, `${safe}.json`);
}

function loadSupport(sessionKey: string): SupportState {
  try {
    const fp = supportFileFor(sessionKey);
    if (!fs.existsSync(fp)) return { messages: [], pins: [] };
    const parsed = JSON.parse(fs.readFileSync(fp, 'utf-8'));
    const messages: SupportMsg[] = Array.isArray(parsed?.messages) ? parsed.messages : [];
    const previousResponseId = typeof parsed?.previousResponseId === 'string' ? parsed.previousResponseId : undefined;
    const pins = Array.isArray(parsed?.pins) ? parsed.pins : [];
    return { previousResponseId, messages, pins };
  } catch {
    return { messages: [], pins: [] };
  }
}

function saveSupport(sessionKey: string, state: SupportState) {
  const fp = supportFileFor(sessionKey);
  const tmp = `${fp}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
  fs.renameSync(tmp, fp);
}

function pruneSupportMessages(messages: SupportMsg[]) {
  const now = Date.now();
  const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
  const pruned = messages.filter((m) => now - Number(m.ts || 0) <= THIRTY_DAYS);
  const MAX_MSGS = 300;
  return pruned.slice(Math.max(0, pruned.length - MAX_MSGS));
}

function appendSupport(sessionKey: string, msg: SupportMsg) {
  const state = loadSupport(sessionKey);
  const next = pruneSupportMessages([...(state.messages || []), msg]);
  saveSupport(sessionKey, { ...state, messages: next });
}

function buildSupportMemoryBlock(sessionKey: string) {
  const st = loadSupport(sessionKey);
  const msgs = pruneSupportMessages(st.messages || []);
  const pins = Array.isArray(st.pins) ? st.pins : [];

  const pinBlock = pins.length
    ? `\n\nMEMÓRIAS SELECIONADAS (pins — use como prioridade):\n${pins
        .slice(Math.max(0, pins.length - 30))
        .map((p) => `- (${new Date(p.ts).toLocaleDateString('pt-BR')}) ${String(p.text || '').slice(0, 500)}`)
        .join('\n')}`
    : '';

  if (!msgs.length) return pinBlock;
  const window = msgs.slice(Math.max(0, msgs.length - 40));
  const lines = window.map((m) => `${m.role === 'user' ? 'César' : 'Suporte IA'}: ${String(m.content || '').slice(0, 600)}`);
  return `${pinBlock}\n\nMEMÓRIA (últimos 30 dias — suporte persistido):\n${lines.join('\n')}`;
}

// =========================
// .env helpers
// =========================
function upsertEnvValue(filePath: string, key: string, value: string) {
  const exists = fs.existsSync(filePath);
  const content = exists ? fs.readFileSync(filePath, 'utf-8') : '';
  const lines = content.split(/\r?\n/);
  const keyRegex = new RegExp(`^\\s*${key}\\s*=`);

  let found = false;
  const next = lines.map((l) => {
    if (keyRegex.test(l)) {
      found = true;
      return `${key}=${JSON.stringify(value)}`;
    }
    return l;
  });

  if (!found) {
    if (next.length && next[next.length - 1].trim() !== '') next.push('');
    next.push(`${key}=${JSON.stringify(value)}`);
  }

  fs.writeFileSync(filePath, next.join('\n'));
}

function maskKey(v?: string | null) {
  if (!v) return '';
  const s = String(v);
  if (s.length <= 8) return '••••••••';
  return `${s.slice(0, 3)}••••••${s.slice(-3)}`;
}


function boolString(value: boolean) {
  return value ? 'true' : 'false';
}

function readRuntimeConfig() {
  const ngrokDomain = normalizeHostInput(process.env.NGROK_DOMAIN || '');
  const remoteBaseUrl = process.env.MCP_PUBLIC_BASE_URL || (ngrokDomain ? `https://${ngrokDomain}` : '');
  const remoteMcpUrl = process.env.MCP_PUBLIC_MCP_URL || (remoteBaseUrl ? `${remoteBaseUrl}/mcp` : '');

  return {
    mcpEnabled: envFlag('MCP_RUNTIME_ENABLED', true),
    mcpRequireAuth: envFlag('MCP_RUNTIME_REQUIRE_AUTH', true),
    mcpToken: String(process.env.MCP_RUNTIME_TOKEN || ''),
    mcpAllowCommands: envFlag('MCP_RUNTIME_ALLOW_COMMANDS', true),
    mcpReadOnly: envFlag('MCP_RUNTIME_READONLY', false),
    ngrokEnabled: envFlag('NGROK_ENABLED', false),
    ngrokAutostart: envFlag('NGROK_AUTOSTART', false),
    ngrokDomain,
    ngrokAuthtoken: String(process.env.NGROK_AUTHTOKEN || ''),
    panelProxyEnabled: getPanelProxyEnabled(),
    panelDevUrl: getPanelDevUrl(),
    panelProxyTimeoutMs: getPanelProxyTimeoutMs(),
    localPanelUrl: 'http://127.0.0.1:5173',
    localApiUrl: `http://127.0.0.1:${PORT}`,
    localMcpUrl: `http://127.0.0.1:${PORT}/mcp`,
    remoteBaseUrl,
    remoteMcpUrl,
    authMode: envFlag('MCP_RUNTIME_REQUIRE_AUTH', true) ? 'token' : 'no-auth',
  };
}

function applyRuntimeConfigPatch(input: any) {
  const patch: Record<string, string> = {};

  const setBool = (envKey: string, value: any) => {
    if (typeof value === 'undefined') return;
    const normalized = typeof value === 'string' ? !['0', 'false', 'no', 'off'].includes(value.trim().toLowerCase()) : !!value;
    patch[envKey] = boolString(normalized);
    process.env[envKey] = patch[envKey];
  };

  const setText = (envKey: string, value: any, normalize = false) => {
    if (typeof value === 'undefined') return;
    const nextValue = normalize ? normalizeHostInput(String(value || '')) : String(value || '').trim();
    patch[envKey] = nextValue;
    process.env[envKey] = nextValue;
  };

  setBool('MCP_RUNTIME_ENABLED', input.mcpEnabled);
  setBool('MCP_RUNTIME_REQUIRE_AUTH', input.mcpRequireAuth);
  setBool('MCP_RUNTIME_ALLOW_COMMANDS', input.mcpAllowCommands);
  setBool('MCP_RUNTIME_READONLY', input.mcpReadOnly);
  setText('MCP_RUNTIME_TOKEN', input.mcpToken);

  setBool('NGROK_ENABLED', input.ngrokEnabled);
  setBool('NGROK_AUTOSTART', input.ngrokAutostart);
  setText('NGROK_DOMAIN', input.ngrokDomain, true);
  setText('NGROK_RESERVED_DOMAIN_ID', input.ngrokReservedDomainId);
  setText('NGROK_AUTHTOKEN', input.ngrokAuthtoken);

  setBool('PANEL_PROXY_ENABLED', input.panelProxyEnabled);
  setText('PANEL_DEV_URL', input.panelDevUrl);

  if (typeof input.panelProxyTimeoutMs !== 'undefined') {
    const timeout = Number(input.panelProxyTimeoutMs || 15000);
    const safeTimeout = Number.isFinite(timeout) && timeout >= 1000 ? String(Math.round(timeout)) : '15000';
    patch['PANEL_PROXY_TIMEOUT_MS'] = safeTimeout;
    process.env.PANEL_PROXY_TIMEOUT_MS = safeTimeout;
  }

  if (!Object.keys(patch).length) return patch;

  for (const [key, value] of Object.entries(patch)) {
    upsertEnvValue(ENV_PATH, key, value);
  }

  return patch;
}

function renderTemplate(tpl: string, vars: Record<string, any>) {
  let out = String(tpl || '');
  for (const [k, v] of Object.entries(vars)) {
    out = out.split(`{{${k}}}`).join(String(v ?? ''));
  }
  // remove placeholders restantes
  out = out.replace(/\{\{[^}]+\}\}/g, '');
  return out;
}

function money(v: any) {
  const n = Number(v || 0);
  return n.toFixed(2).replace('.', ',');
}

function generateBudgetPdfBuffer(db: any, budget: any): Promise<Buffer> {
  const companyKey = (budget.company || 'bellarte');
  const details: any = db.config?.companyDetails?.[companyKey] || {};
  const companyName = (companyKey === 'alfa' ? db.companies?.alfa : companyKey === 'personal' ? db.companies?.personal : db.companies?.bellarte) || details.nome || '';
  const serviceTitle = String(budget.servico || '').trim() || 'Serviço sob consulta';
  const dateText = String(budget.data || new Date().toLocaleDateString('pt-BR'));
  const amountText = `R$ ${money(budget.valor)}`;
  const statusText = String(budget.status || 'Pendente');
  const companyPhone = String(details.telefone || '').trim();
  const companyEmail = String(details.email || '').trim();
  const companySite = String(details.site || '').trim();
  const companyAddress = String(details.endereco || '').trim();
  const companyCnpj = String(details.cnpj || '').trim();
  const companyPix = String(details.pix || '').trim();

  const doc = new PDFDocument({ size: 'A4', margin: 0 });
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));

  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  const accent = companyKey === 'alfa' ? '#2563eb' : '#d4a017';
  const accentSoft = companyKey === 'alfa' ? '#dbeafe' : '#fef3c7';
  const dark = '#0f172a';
  const muted = '#64748b';

  return new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', (err) => reject(err));

    doc.rect(0, 0, pageWidth, 160).fill(dark);
    doc.rect(0, 160, pageWidth, pageHeight - 160).fill('#ffffff');
    doc.rect(50, 118, pageWidth - 100, 6).fill(accent);

    doc.fillColor('#ffffff').fontSize(10).text('PROPOSTA COMERCIAL', 55, 42, { align: 'left' });
    doc.fontSize(26).text(companyName || 'Klaus Business', 55, 58, { align: 'left' });
    doc.fontSize(11).fillColor('#cbd5e1').text('Documento executivo gerado pelo Klaus para apresentação profissional ao cliente.', 55, 92, {
      width: pageWidth - 110,
      align: 'left',
    });

    doc.roundedRect(50, 145, pageWidth - 100, 128, 20).fillAndStroke('#ffffff', '#e2e8f0');
    doc.fillColor(muted).fontSize(9).text('CLIENTE', 72, 168);
    doc.fillColor(dark).fontSize(18).text(String(budget.cliente || 'Cliente não informado'), 72, 182, { width: 250 });
    doc.fillColor(muted).fontSize(9).text('DATA', 360, 168);
    doc.fillColor(dark).fontSize(12).text(dateText, 360, 182);
    doc.fillColor(muted).fontSize(9).text('STATUS', 360, 214);
    doc.fillColor(accent).fontSize(12).text(statusText, 360, 228);

    doc.roundedRect(50, 300, pageWidth - 100, 118, 20).fillAndStroke(accentSoft, '#f1f5f9');
    doc.fillColor(muted).fontSize(9).text('RESUMO EXECUTIVO', 72, 324);
    doc.fillColor(dark).fontSize(20).text(serviceTitle, 72, 340, { width: 290 });
    doc.fillColor('#334155').fontSize(11).text(
      'Proposta preparada com foco em apresentação clara, valor percebido e facilidade de aprovação. O conteúdo final pode ser entregue pelo Klaus diretamente ao cliente via WhatsApp.',
      72,
      372,
      { width: 290, align: 'left' }
    );

    doc.roundedRect(390, 320, 145, 80, 18).fillAndStroke('#ffffff', '#e2e8f0');
    doc.fillColor(muted).fontSize(9).text('VALOR DO ORÇAMENTO', 405, 340, { width: 115, align: 'center' });
    doc.fillColor(dark).fontSize(22).text(amountText, 405, 360, { width: 115, align: 'center' });

    doc.fillColor(dark).fontSize(12).text('Escopo do serviço', 50, 452);
    doc.fillColor('#334155').fontSize(11).text(
      `Serviço contratado: ${serviceTitle}.\nContato de referência: ${String(budget.contato || 'Não informado')}.\nIdentificador interno: ${String(budget.id || '')}.`,
      50,
      472,
      { width: pageWidth - 100, lineGap: 4 }
    );

    doc.fillColor(dark).fontSize(12).text('Dados comerciais', 50, 560);
    const footerLines = [
      companyCnpj ? `CNPJ: ${companyCnpj}` : '',
      companyAddress ? `Endereço: ${companyAddress}` : '',
      companyPhone ? `Telefone: ${companyPhone}` : '',
      companyEmail ? `E-mail: ${companyEmail}` : '',
      companySite ? `Site: ${companySite}` : '',
      companyPix ? `PIX: ${companyPix}` : '',
    ].filter(Boolean);
    doc.fillColor('#334155').fontSize(10).text(
      footerLines.length ? footerLines.join('   •   ') : 'Dados comerciais disponíveis sob consulta.',
      50,
      580,
      { width: pageWidth - 100, align: 'left' }
    );

    doc.fillColor('#94a3b8').fontSize(9).text(
      'Documento gerado automaticamente pelo Klaus OS. A aprovação interna permanece obrigatória antes do envio final ao cliente.',
      50,
      760,
      { width: pageWidth - 100, align: 'center' }
    );

    doc.end();
  });
}

// =========================
// OpenAI (Responses)
// =========================
// (3.0 RELEASE) Re-instanciar o client quando a chave mudar (evita "salvei no painel e não pegou").
function createOpenAIClient(apiKey?: string) {
  return new OpenAI({ apiKey: (apiKey || process.env.OPENAI_API_KEY || '').trim() });
}

let openai = createOpenAIClient(process.env.OPENAI_API_KEY);

type SessionState = { previousResponseId?: string };
const coreSessions = new Map<string, SessionState>();

// NOTE (Responses API): tools expect {type:"function", name, description, parameters}
// (NOT nested under a "function" key like Chat Completions).
const CORE_TOOLS: any[] = [
  {
    type: 'function',
    name: 'add_client',
    description: 'Adiciona um cliente ao CRM (Bellarte/Alfa).',
    parameters: {
      type: 'object',
      properties: {
        nome: { type: 'string' },
        telefone: { type: 'string' },
        empresa: { type: 'string', description: 'Bellarte Pinturas | Alfa DDT | Vida Pessoal' },
        status: { type: 'string', enum: ['Lead', 'Interessado', 'Desqualificado'] },
        observacoes: { type: 'string' },
      },
      required: ['nome', 'telefone'],
    },
  },
  {
    type: 'function',
    name: 'add_budget',
    description: 'Cria um orçamento (sempre como Pendente; envio ao cliente somente após aprovação do Master).',
    parameters: {
      type: 'object',
      properties: {
        cliente: { type: 'string' },
        servico: { type: 'string' },
        valor: { type: 'number' },
        company: { type: 'string', description: 'bellarte | alfa | personal (opcional). Se omitido, inferido pelo perfil ativo.' },
      },
      required: ['cliente', 'servico', 'valor'],
    },
  },
  {
    type: 'function',
    name: 'add_transaction',
    description: 'Registra uma entrada/saída financeira.',
    parameters: {
      type: 'object',
      properties: {
        tipo: { type: 'string', enum: ['Entrada', 'Saída', 'Receber', 'Pagar'] },
        valor: { type: 'number' },
        descricao: { type: 'string' },
        empresa: { type: 'string' },
      },
      required: ['tipo', 'valor', 'descricao', 'empresa'],
    },
  },
  {
    type: 'function',
    name: 'add_event',
    description: 'Cria um agendamento.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        date: { type: 'string', description: 'YYYY-MM-DD' },
        time: { type: 'string', description: 'HH:mm' },
        company: { type: 'string' },
        clientName: { type: 'string', description: 'Nome do cliente/contato' },
        address: { type: 'string', description: 'Endereço completo da visita' },
        notes: { type: 'string', description: 'Observações importantes sobre a visita' },
      },
      required: ['title', 'date', 'time'],
    },
  },
  {
    type: 'function',
    name: 'list_events',
    description: 'Lista eventos/agendamentos por data, faixa de datas ou empresa.',
    parameters: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'YYYY-MM-DD (opcional, para um dia específico)' },
        fromDate: { type: 'string', description: 'YYYY-MM-DD (opcional, início do período)' },
        toDate: { type: 'string', description: 'YYYY-MM-DD (opcional, fim do período)' },
        company: { type: 'string', description: 'bellarte | alfa | personal | outro (opcional)' },
        limit: { type: 'number', description: 'máximo de resultados (opcional, padrão 20)' },
      },
    },
  },
  {
    type: 'function',
    name: 'update_event',
    description: 'Atualiza um agendamento existente pelo id.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        title: { type: 'string' },
        date: { type: 'string', description: 'YYYY-MM-DD' },
        time: { type: 'string', description: 'HH:mm' },
        company: { type: 'string' },
      },
      required: ['id'],
    },
  },
  {
    type: 'function',
    name: 'remove_event',
    description: 'Remove/cancela um agendamento pelo id.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string' },
      },
      required: ['id'],
    },
  },
  {
    type: 'function',
    name: 'get_schedule_summary',
    description: 'Retorna um resumo textual da agenda de um dia ou período, incluindo contagem de eventos.',
    parameters: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'YYYY-MM-DD (opcional, para um dia específico)' },
        fromDate: { type: 'string', description: 'YYYY-MM-DD (opcional, início do período)' },
        toDate: { type: 'string', description: 'YYYY-MM-DD (opcional, fim do período)' },
        company: { type: 'string', description: 'bellarte | alfa | personal | outro (opcional)' },
      },
    },
  },
  {
    type: 'function',
    name: 'get_finance_summary',
    description: 'Retorna resumo de saldo (pode filtrar por empresa).',
    parameters: {
      type: 'object',
      properties: {
        empresa: { type: 'string', description: 'Nome da empresa ou Todas' },
      },
    },
  },
  {
    type: 'function',
    name: 'list_recent_clients',
    description: 'Lista clientes mais recentes.',
    parameters: {
      type: 'object',
      properties: {
        limit: { type: 'number' },
      },
    },
  },
  {
    type: 'function',
    name: 'list_templates',
    description: 'Lista modelos de documentos (arquivos) disponíveis para envio.',
    parameters: {
      type: 'object',
      properties: {
        company: { type: 'string', description: 'bellarte | alfa | personal (opcional)' },
        docType: { type: 'string', description: 'proposal | contract | budget | other (opcional)' },
      },
    },
  },
  {
    type: 'function',
    name: 'send_template',
    description: 'Envia um modelo de documento (PDF/arquivo) para um número ou para o Mestre.',
    parameters: {
      type: 'object',
      properties: {
        templateId: { type: 'string' },
        to: { type: 'string', description: 'Telefone (55...) ou "master"' },
        caption: { type: 'string' },
      },
      required: ['templateId', 'to'],
    },
  },
  {
    type: 'function',
    name: 'send_interactive_buttons',
    description: 'Envia mensagem interativa com até 3 botões no WhatsApp Meta. Em provider não-Meta, faz fallback em texto.',
    parameters: {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'Telefone (55...) ou "master"' },
        body: { type: 'string' },
        button1Id: { type: 'string' },
        button1Title: { type: 'string' },
        button2Id: { type: 'string' },
        button2Title: { type: 'string' },
        button3Id: { type: 'string' },
        button3Title: { type: 'string' },
      },
      required: ['to', 'body', 'button1Id', 'button1Title'],
    },
  },
  {
    type: 'function',
    name: 'send_interactive_list',
    description: 'Envia mensagem interativa de lista no WhatsApp Meta. Em provider não-Meta, faz fallback em texto.',
    parameters: {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'Telefone (55...) ou "master"' },
        body: { type: 'string' },
        buttonText: { type: 'string' },
        sectionTitle: { type: 'string' },
        row1Id: { type: 'string' },
        row1Title: { type: 'string' },
        row1Description: { type: 'string' },
        row2Id: { type: 'string' },
        row2Title: { type: 'string' },
        row2Description: { type: 'string' },
        row3Id: { type: 'string' },
        row3Title: { type: 'string' },
        row3Description: { type: 'string' },
      },
      required: ['to', 'body', 'buttonText', 'sectionTitle', 'row1Id', 'row1Title'],
    },
  },
];

function getCoreToolsForRole(isMaster: boolean) {
  if (isMaster) return CORE_TOOLS;
  return CORE_TOOLS.filter((tool: any) => tool?.name !== 'add_budget');
}

function buildInstruction(db: any, opts: { channel: string; isMaster: boolean; from: string; module?: string }) {
  const { channel, isMaster, from, module } = opts;

  const header = `VOCÊ É O KLAUS OS. Canal: ${channel}. Remetente: ${from}. Data/hora: ${new Date().toLocaleString('pt-BR')}.`;

  if (isMaster) {
    return `${header}\n\n${db.config?.klausPrompt || ''}\n\nREGRAS MESTRE:\n- Você é um gerente operacional e financeiro do César.\n- Quando o usuário pedir ações, use ferramentas.\n- Orçamentos criados por ferramentas ficam PENDENTES e só são enviados ao cliente após o Master aprovar (WhatsApp: APROVAR <id>).\n- Seja direto e executivo.\n- Nunca se apresente como desenvolvedor.\n- Nunca fale de código a menos que o Master peça explicitamente.`;
  }

  // Cliente
  let profilePrompt = db.config?.attendantPrompt || 'Atendimento objetivo.';
  if (db.activeProfile === 'PROSPECTING_ALFA') profilePrompt = db.config?.prospectingAlfaPrompt || profilePrompt;
  if (db.activeProfile === 'PROSPECTING_CUSTOM') profilePrompt = db.config?.prospectingCustomPrompt || profilePrompt;

  return `${header}\n\nVOCÊ NÃO É O DESENVOLVEDOR. Você é um atendente profissional.\n\nPERFIL ATIVO: ${db.activeProfile}\n${profilePrompt}\n\nREGRAS CLIENTE:\n- Não mencione sistema interno, painel, nem desenvolvimento.\n- Se o cliente pedir orçamento, NÃO gere orçamento e NÃO use add_budget. Colete nome, serviço, melhor dia, melhor horário e o endereço completo da visita antes de concluir.
- Só use add_event quando já tiver nome, serviço, data, horário e endereço.
- Ao usar add_event, preencha clientName, address e notes quando houver.
- Se faltar endereço, continue a conversa pedindo o local da visita de forma natural e objetiva.
- Quando marcar a visita, confirme ao cliente que o pedido foi registrado e que o César ou técnico fará a avaliação no dia/horário combinado.\n- Seja educado e persuasivo, sem prometer coisas impossíveis.`;
}

async function runCoreAgent(params: {
  sessionKey: string;
  db: any;
  channel: 'whatsapp' | 'panel' | 'jarvis';
  from: string;
  isMaster: boolean;
  module?: string;
  text: string;
  // multimodal (ex.: image) para o Core (Responses)
  media?: { kind: 'image'; dataUrl: string };
  wwClient?: any;
}) {
  const { sessionKey, db, channel, from, isMaster, module, text, wwClient, media } = params;
  if (!process.env.OPENAI_API_KEY) {
    return { text: '⚠️ OPENAI_API_KEY não configurada. Vá em Cérebro IA → Chaves e salve a chave.', didMutateDb: false };
  }

  // Restaura sessão persistida (3.0 PRO)
  let session = coreSessions.get(sessionKey);
  if (!session) {
    const persisted = loadConversation(sessionKey);
    session = { previousResponseId: persisted.previousResponseId };
    coreSessions.set(sessionKey, session);
  }

  const instruction = buildInstruction(db, { channel, isMaster, from, module }) + buildMemoryBlock(sessionKey);

  // Input list cresce automaticamente via previous_response_id
  // Se houver imagem, mandamos input_text + input_image (multimodal).
  const userContent = media?.kind === 'image'
    ? [
        { type: 'input_text', text: text || 'Analise a imagem e responda.' },
        { type: 'input_image', image_url: media.dataUrl },
      ]
    : text;

  const input: any[] = [{ role: 'user', content: userContent }];

  // registra memória do usuário (persistente)
  try {
    const plain = typeof userContent === 'string' ? userContent : (Array.isArray(userContent) ? (userContent.find((x: any) => x?.type === 'input_text')?.text || '[mídia]') : '[mensagem]');
    appendConversation(sessionKey, { role: 'user', content: String(plain || '').slice(0, 4000), ts: Date.now() });
  } catch {}

  let response = await openai.responses.create({
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    instructions: instruction,
    tools: getCoreToolsForRole(isMaster),
    input,
    previous_response_id: session.previousResponseId,
  });

  let didMutateDb = false;

  // Tool loop (até não ter mais function_call)
  // Baseado no guia oficial de function calling com Responses
  // https://developers.openai.com/api/docs/guides/function-calling/
  // (a estrutura é: response.output[] com itens type=function_call)
  while (true) {
    const toolCalls = (response.output || []).filter((it: any) => it && it.type === 'function_call');
    if (!toolCalls.length) break;

    for (const toolCall of toolCalls) {
      const name = toolCall.name;
      let args: any = {};
      try {
        args = JSON.parse(toolCall.arguments || '{}');
      } catch {
        args = {};
      }

      addLog(`[CORE TOOL]: ${name}`, 'ia');

      let toolResult: any = { ok: true };

      if (name === 'add_client') {
        db.clients.push({
          ...args,
          id: Date.now().toString(),
          status: args.status || 'Lead',
        });
        didMutateDb = true;
        toolResult = { ok: true, message: 'Cliente adicionado.' };
      }

      if (name === 'add_budget') {
        const id = Date.now().toString();
        const contato = from; // ex: 55...@c.us (ou 'panel:master')
        const inferredCompany = (args.company || (() => {
          const ap = String(db.activeProfile || '').toUpperCase();
          if (ap.includes('ALFA')) return 'alfa';
          return 'bellarte';
        })());
        const createdBudget: any = {
          ...args,
          id,
          data: new Date().toISOString().split('T')[0],
          status: 'Pendente',
          contato,
          canal: channel,
          company: inferredCompany,
        };
        db.budgets.push(createdBudget);
        didMutateDb = true;

        const resumo = `📝 *ORÇAMENTO PENDENTE*\nID: *${id}*\nCliente: ${args.cliente || args.nome || ''}\nServiço: ${args.servico || args.descricao || ''}\nValor: R$ ${Number(args.valor || 0).toFixed(2)}\nContato: ${from}\n\nResponda: *APROVAR ${id}* ou *RECUSAR ${id}*`;

        // Notifica Master no WhatsApp quando veio de um cliente
        if (channel === 'whatsapp' && !isMaster && wwClient) {
          try {
            await sendWhatsAppMessage(CESAR_NUMBER, resumo);
          } catch (e: any) {
            addLog(`Falha ao notificar Master: ${e?.message || e}`, 'sys');
          }
        }

        toolResult = { ok: true, message: `Orçamento criado como Pendente (ID ${id}).` };

        // Envia ao mestre o PDF do orçamento (para abrir no celular), além do resumo.
        // HARD RULE: nunca enviar ao cliente até aprovação.
        if (wwClient) {
          try {
            const pdfBuf = await generateBudgetPdfBuffer(db, createdBudget);
            const media = new MessageMedia('application/pdf', pdfBuf.toString('base64'), `orcamento-${id}.pdf`);
            await sendWhatsAppMessage(CESAR_NUMBER, media, { caption: resumo });
          } catch (e: any) {
            addLog(`Falha ao gerar/enviar PDF do orçamento ao mestre: ${e?.message || e}`, 'sys');
          }
        }
      }

      if (name === 'add_transaction') {
        db.transactions.unshift({
          ...args,
          id: Date.now().toString(),
          status: 'Concluído',
        });
        didMutateDb = true;
        toolResult = { ok: true, message: 'Transação registrada.' };
      }

      if (name === 'add_event') {
        const normalizedPhone = normalizePhoneDigits(from);
        const eventCompany = String(args.company || (() => {
          const ap = String(db.activeProfile || '').toUpperCase();
          if (ap.includes('ALFA')) return 'alfa';
          if (ap.includes('PERSONAL')) return 'personal';
          return 'bellarte';
        })()).trim() || 'bellarte';
        const clientName = String(args.clientName || args.nome || '').trim() || normalizedPhone || 'Cliente';
        const address = String(args.address || '').trim();
        const notes = String(args.notes || '').trim();
        if (!address) {
          toolResult = { ok: false, message: 'Endereço obrigatório para agendar visita.' };
        } else {
          const newEvent = {
            ...args,
            id: Date.now().toString(),
            company: eventCompany,
            clientName,
            address,
            notes,
            contactPhone: normalizedPhone,
            reminderSent: false,
          };
          db.agenda.push(newEvent);
          didMutateDb = true;

          if (channel === 'whatsapp' && !isMaster && normalizedPhone) {
            db.clients = Array.isArray(db.clients) ? db.clients : [];
            const companyLabel = eventCompany === 'alfa' ? 'Alfa DDT' : eventCompany === 'personal' ? 'Vida Pessoal' : 'Bellarte Pinturas';
            const existingIdx = db.clients.findIndex((c: any) => normalizePhoneDigits(c?.telefone || '') === normalizedPhone);
            const clientRecord = {
              nome: clientName,
              telefone: normalizedPhone,
              empresa: companyLabel,
              status: 'Interessado',
              observacoes: [
                `Visita agendada para ${String(newEvent.date || '')} às ${String(newEvent.time || '')}.`,
                address ? `Endereço: ${address}` : '',
                notes ? `Obs: ${notes}` : '',
              ].filter(Boolean).join(' '),
            };
            if (existingIdx >= 0) {
              db.clients[existingIdx] = {
                ...db.clients[existingIdx],
                ...clientRecord,
              };
            } else {
              db.clients.push({
                ...clientRecord,
                id: Date.now().toString(),
              });
            }
          }

          if (channel === 'whatsapp' && !isMaster) {
            try {
              const phoneDisplay = normalizedPhone ? `+${normalizedPhone}` : from;
              const body = [
                'Novo pedido de visita/orçamento.',
                `Nome: ${clientName}`,
                `Telefone: ${phoneDisplay}`,
                `Canal: WhatsApp Meta`,
                `Ação: Visita agendada`,
                `Data: ${String(newEvent.date || '')}`,
                `Hora: ${String(newEvent.time || '')}`,
                address ? `Endereço: ${address}` : 'Endereço: não informado',
              ].join('\n');
              const convoId = `VER_CONVERSA_${normalizedPhone || 'contato'}`.slice(0, 256);
              const addrId = `VER_ENDERECO_${normalizedPhone || 'contato'}`.slice(0, 256);
              const talkId = `FALAR_CLIENTE_${normalizedPhone || 'contato'}`.slice(0, 256);
              await sendWhatsAppMessage(CESAR_NUMBER, {
                __metaInteractive: true,
                interactive: {
                  type: 'button',
                  body: { text: body.slice(0, 1024) },
                  action: {
                    buttons: [
                      { type: 'reply', reply: { id: talkId, title: 'Falar cliente' } },
                      { type: 'reply', reply: { id: convoId, title: 'Ver conversa' } },
                      { type: 'reply', reply: { id: addrId, title: 'Ver endereço' } },
                    ],
                  },
                },
              });
            } catch (e: any) {
              addLog(`Falha ao notificar Master sobre agendamento: ${e?.message || e}`, 'sys');
            }
          }

          toolResult = { ok: true, message: 'Agendamento criado.', event: newEvent };
        }
      }

      if (name === 'list_events') {
        const date = String(args.date || '').trim();
        const fromDate = String(args.fromDate || '').trim();
        const toDate = String(args.toDate || '').trim();
        const company = String(args.company || '').trim();
        const limit = Math.max(1, Math.min(100, Number(args.limit || 20)));
        let events = Array.isArray(db.agenda) ? [...db.agenda] : [];
        if (date) events = events.filter((e: any) => String(e.date || '') === date);
        if (fromDate) events = events.filter((e: any) => String(e.date || '') >= fromDate);
        if (toDate) events = events.filter((e: any) => String(e.date || '') <= toDate);
        if (company) events = events.filter((e: any) => String(e.company || '').toLowerCase() === company.toLowerCase());
        events.sort((a: any, b: any) => `${String(a.date || '')} ${String(a.time || '')}`.localeCompare(`${String(b.date || '')} ${String(b.time || '')}`));
        toolResult = {
          ok: true,
          count: events.length,
          events: events.slice(0, limit).map((e: any) => ({ id: e.id, title: e.title, date: e.date, time: e.time, company: e.company || '' })),
        };
      }

      if (name === 'update_event') {
        const id = String(args.id || '').trim();
        const idx = (Array.isArray(db.agenda) ? db.agenda : []).findIndex((e: any) => String(e.id) === id);
        if (idx < 0) {
          toolResult = { ok: false, message: `Agendamento não encontrado: ${id}` };
        } else {
          const current = db.agenda[idx];
          const updated = {
            ...current,
            ...(typeof args.title !== 'undefined' ? { title: args.title } : {}),
            ...(typeof args.date !== 'undefined' ? { date: args.date } : {}),
            ...(typeof args.time !== 'undefined' ? { time: args.time } : {}),
            ...(typeof args.company !== 'undefined' ? { company: args.company } : {}),
          };
          db.agenda[idx] = updated;
          didMutateDb = true;
          toolResult = { ok: true, message: 'Agendamento atualizado.', event: updated };
        }
      }

      if (name === 'remove_event') {
        const id = String(args.id || '').trim();
        const before = Array.isArray(db.agenda) ? db.agenda.length : 0;
        db.agenda = (Array.isArray(db.agenda) ? db.agenda : []).filter((e: any) => String(e.id) !== id);
        if (db.agenda.length === before) {
          toolResult = { ok: false, message: `Agendamento não encontrado: ${id}` };
        } else {
          didMutateDb = true;
          toolResult = { ok: true, message: 'Agendamento removido.' };
        }
      }

      if (name === 'get_schedule_summary') {
        const date = String(args.date || '').trim();
        const fromDate = String(args.fromDate || '').trim();
        const toDate = String(args.toDate || '').trim();
        const company = String(args.company || '').trim();
        let events = Array.isArray(db.agenda) ? [...db.agenda] : [];
        if (date) events = events.filter((e: any) => String(e.date || '') === date);
        if (fromDate) events = events.filter((e: any) => String(e.date || '') >= fromDate);
        if (toDate) events = events.filter((e: any) => String(e.date || '') <= toDate);
        if (company) events = events.filter((e: any) => String(e.company || '').toLowerCase() === company.toLowerCase());
        events.sort((a: any, b: any) => `${String(a.date || '')} ${String(a.time || '')}`.localeCompare(`${String(b.date || '')} ${String(b.time || '')}`));
        const lines = events.slice(0, 20).map((e: any) => `- ${e.date || ''} ${e.time || ''} — ${e.title || 'Sem título'}${e.company ? ` (${e.company})` : ''}`);
        toolResult = { ok: true, count: events.length, summary: lines.length ? lines.join('\n') : 'Nenhum agendamento encontrado.' };
      }

      if (name === 'get_finance_summary') {
        const empresa = args.empresa || 'Todas';
        const txs = db.transactions.filter((t: any) => empresa === 'Todas' || t.empresa === empresa);
        const total = txs.reduce((acc: number, t: any) => (t.tipo === 'Entrada' || t.tipo === 'Receber') ? acc + Number(t.valor || 0) : acc - Number(t.valor || 0), 0);
        toolResult = { ok: true, empresa, saldo: total, message: `Saldo atual para ${empresa}: R$ ${total.toFixed(2)}` };
      }

      if (name === 'list_recent_clients') {
        const limit = Math.max(1, Math.min(50, Number(args.limit || 5)));
        const list = db.clients.slice(-limit).map((c: any) => ({ nome: c.nome, status: c.status, telefone: c.telefone }));
        toolResult = { ok: true, limit, clients: list };
      }

      if (name === 'list_templates') {
        const company = String(args.company || '').trim();
        const docType = String(args.docType || '').trim();
        let list = Array.isArray(db.templates) ? db.templates : [];
        if (company) list = list.filter((t: any) => t.company === company);
        if (docType) list = list.filter((t: any) => t.docType === docType);
        toolResult = { ok: true, count: list.length, templates: list.map((t: any) => ({ id: t.id, name: t.originalName || t.name, company: t.company, docType: t.docType })) };
      }

      if (name === 'send_template') {
        const templateId = String(args.templateId || '').trim();
        const toRaw = String(args.to || '').trim();
        const caption = String(args.caption || '').trim();
        const tpl = (Array.isArray(db.templates) ? db.templates : []).find((t: any) => t.id === templateId);
        if (!tpl) {
          toolResult = { ok: false, message: `Modelo não encontrado: ${templateId}` };
        } else if (!wwClient && getWhatsAppProvider() !== 'meta') {
          toolResult = { ok: false, message: 'WhatsApp não está disponível neste canal.' };
        } else {
          const filePath = path.join(TEMPLATES_DIR, tpl.filename);
          if (!fs.existsSync(filePath)) {
            toolResult = { ok: false, message: 'Arquivo do modelo não existe no disco.' };
          } else {
            const to = (toRaw.toLowerCase() === 'master') ? CESAR_NUMBER : (toRaw.includes('@c.us') ? toRaw : `${toRaw.replace(/\D/g, '')}@c.us`);
            const base64 = fs.readFileSync(filePath).toString('base64');
            const media = new MessageMedia(tpl.mimetype || 'application/pdf', base64, tpl.originalName || tpl.name || 'documento.pdf');
            await sendWhatsAppMessage(to, media, caption ? { caption } : undefined);
            toolResult = { ok: true, message: `Enviado para ${toRaw}` };
          }
        }
      }

      if (name === 'send_interactive_buttons') {
        const toRaw = String(args.to || '').trim();
        const to = (toRaw.toLowerCase() === 'master') ? CESAR_NUMBER : (toRaw.includes('@c.us') ? toRaw : `${toRaw.replace(/\D/g, '')}@c.us`);
        const body = String(args.body || '').trim();
        const buttons = [
          { id: String(args.button1Id || '').trim(), title: String(args.button1Title || '').trim() },
          { id: String(args.button2Id || '').trim(), title: String(args.button2Title || '').trim() },
          { id: String(args.button3Id || '').trim(), title: String(args.button3Title || '').trim() },
        ].filter((b) => b.id && b.title).slice(0, 3);
        if (!body || !buttons.length) {
          toolResult = { ok: false, message: 'Corpo e pelo menos um botão são obrigatórios.' };
        } else if (getWhatsAppProvider() === 'meta') {
          await sendWhatsAppMessage(to, {
            __metaInteractive: true,
            interactive: {
              type: 'button',
              body: { text: body },
              action: {
                buttons: buttons.map((b) => ({ type: 'reply', reply: { id: b.id, title: b.title } })),
              },
            },
          });
          toolResult = { ok: true, message: `Mensagem interativa enviada para ${toRaw}` };
        } else {
          const fallback = [body, ...buttons.map((b, i) => `${i + 1}. ${b.title} (${b.id})`)].join('\n');
          await sendWhatsAppMessage(to, fallback);
          toolResult = { ok: true, message: `Fallback textual enviado para ${toRaw}` };
        }
      }

      if (name === 'send_interactive_list') {
        const toRaw = String(args.to || '').trim();
        const to = (toRaw.toLowerCase() === 'master') ? CESAR_NUMBER : (toRaw.includes('@c.us') ? toRaw : `${toRaw.replace(/\D/g, '')}@c.us`);
        const body = String(args.body || '').trim();
        const buttonText = String(args.buttonText || '').trim();
        const sectionTitle = String(args.sectionTitle || '').trim();
        const rows = [
          { id: String(args.row1Id || '').trim(), title: String(args.row1Title || '').trim(), description: String(args.row1Description || '').trim() },
          { id: String(args.row2Id || '').trim(), title: String(args.row2Title || '').trim(), description: String(args.row2Description || '').trim() },
          { id: String(args.row3Id || '').trim(), title: String(args.row3Title || '').trim(), description: String(args.row3Description || '').trim() },
        ].filter((r) => r.id && r.title);
        if (!body || !buttonText || !sectionTitle || !rows.length) {
          toolResult = { ok: false, message: 'body, buttonText, sectionTitle e ao menos uma linha são obrigatórios.' };
        } else if (getWhatsAppProvider() === 'meta') {
          await sendWhatsAppMessage(to, {
            __metaInteractive: true,
            interactive: {
              type: 'list',
              body: { text: body },
              action: {
                button: buttonText,
                sections: [
                  {
                    title: sectionTitle,
                    rows,
                  },
                ],
              },
            },
          });
          toolResult = { ok: true, message: `Lista interativa enviada para ${toRaw}` };
        } else {
          const fallback = [body, `${buttonText}:`, ...rows.map((r, i) => `${i + 1}. ${r.title}${r.description ? ` — ${r.description}` : ''} (${r.id})`)].join('\n');
          await sendWhatsAppMessage(to, fallback);
          toolResult = { ok: true, message: `Fallback textual enviado para ${toRaw}` };
        }
      }

      if (didMutateDb) saveDb(db);

      // Envia o output da tool de volta para o modelo (call_id é obrigatório)
      input.push({
        type: 'function_call_output',
        call_id: toolCall.call_id,
        output: JSON.stringify(toolResult),
      });
    }

    response = await openai.responses.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      instructions: instruction,
      tools: getCoreToolsForRole(isMaster),
      input,
      previous_response_id: response.id,
    });
  }

  // guarda contexto (RAM + disco)
  coreSessions.set(sessionKey, { previousResponseId: response.id });
  try {
    const st = loadConversation(sessionKey);
    saveConversation(sessionKey, { previousResponseId: response.id, messages: pruneConversationMessages(st.messages || []) });
  } catch {}

  // registra resposta na memória persistente
  try {
    const out = String(response.output_text || '').trim();
    if (out) appendConversation(sessionKey, { role: 'assistant', content: out.slice(0, 4000), ts: Date.now() });
  } catch {}

  return { text: response.output_text || 'Ok.', didMutateDb };
}

// =========================
// Support IA Agent (painel) — leitura/patch/diagnóstico (multimodal)
// =========================
type PendingAction = {
  id: string;
  token: string;
  createdAt: number;
  summary: string;
  kind: 'CLEAR_DB' | 'CLEAR_LOG' | 'DELETE_PATH' | 'WRITE_DB' | 'WRITE_FILE' | 'REPLACE_LINES' | 'REPLACE_TEXT' | 'RUN_CMD';
  payload: any;
};

const pendingSupportActions = new Map<string, PendingAction>();
function newActionId() {
  return crypto.randomBytes(8).toString('hex');
}

function safeResolveProjectPath(relPath: string) {
  const root = process.cwd();
  const resolved = path.resolve(root, relPath);
  if (!resolved.startsWith(root)) throw new Error('Caminho fora do projeto (bloqueado).');
  return resolved;
}

function readTextFileWithLines(relPath: string, startLine = 1, endLine = 200) {
  const fp = safeResolveProjectPath(relPath);
  const content = fs.readFileSync(fp, 'utf-8');
  const lines = content.split(/\r?\n/);
  const s = Math.max(1, Number(startLine || 1));
  const e = Math.min(lines.length, Number(endLine || s + 200));
  const slice = lines.slice(s - 1, e);
  return {
    path: relPath,
    startLine: s,
    endLine: e,
    totalLines: lines.length,
    text: slice.map((l, i) => `${String(s + i).padStart(5, ' ')}| ${l}`).join('\n'),
  };
}

function listProjectFiles(relDir = '.', max = 500) {
  const root = process.cwd();
  const base = safeResolveProjectPath(relDir);
  const out: string[] = [];
  const walk = (dir: string) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const ent of entries) {
      if (ent.name === 'node_modules' || ent.name === '.git' || ent.name === '.wwebjs_auth') continue;
      const full = path.join(dir, ent.name);
      const rel = path.relative(root, full).replace(/\\/g, '/');
      if (ent.isDirectory()) {
        walk(full);
      } else {
        out.push(rel);
        if (out.length >= max) return;
      }
    }
  };
  walk(base);
  return out.slice(0, max);
}

function searchInProject(query: string, options?: { maxHits?: number; fileExts?: string[] }) {
  const q = String(query || '').trim();
  if (!q) return [];
  const maxHits = Math.max(1, Math.min(200, options?.maxHits ?? 50));
  const exts = options?.fileExts?.length ? options.fileExts : ['.ts', '.tsx', '.js', '.jsx', '.json', '.md'];
  const files = listProjectFiles('.', 2000).filter((f) => exts.some((e) => f.toLowerCase().endsWith(e)));
  const hits: any[] = [];
  for (const rel of files) {
    if (hits.length >= maxHits) break;
    try {
      const fp = safeResolveProjectPath(rel);
      const text = fs.readFileSync(fp, 'utf-8');
      const lines = text.split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        if (hits.length >= maxHits) break;
        const line = lines[i];
        if (line.includes(q)) {
          hits.push({ file: rel, line: i + 1, preview: line.slice(0, 300) });
        }
      }
    } catch {}
  }
  return hits;
}

function writeSupportLog(line: string) {
  try {
    fs.appendFileSync(LOG_SUPPORT_PATH, `[${new Date().toISOString()}] ${line}\n`);
  } catch {}
}

const SUPPORT_TOOLS: any[] = [
  {
    type: 'function',
    name: 'support_list_files',
    description: 'Lista arquivos do projeto (recursivo) a partir de um diretório relativo. Ignora node_modules/.git/.wwebjs_auth.',
    parameters: {
      type: 'object',
      properties: {
        dir: { type: 'string', description: 'Diretório relativo (ex: ".", "modules", "backend").' },
        max: { type: 'number', description: 'Máximo de arquivos.' },
      },
    },
  },
  {
    type: 'function',
    name: 'support_read_file',
    description: 'Lê um arquivo de texto por intervalo de linhas, retornando com numeração.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Caminho relativo do arquivo (ex: "server.ts").' },
        startLine: { type: 'number' },
        endLine: { type: 'number' },
      },
      required: ['path'],
    },
  },
  {
    type: 'function',
    name: 'support_search_code',
    description: 'Busca uma string literal no projeto e retorna hits com arquivo/linha/preview.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        maxHits: { type: 'number' },
        fileExts: { type: 'array', items: { type: 'string' } },
      },
      required: ['query'],
    },
  },
  {
    type: 'function',
    name: 'support_read_db',
    description: 'Lê o db.json local (use para diagnóstico).',
    parameters: { type: 'object', properties: {} },
  },
  {
    type: 'function',
    name: 'support_read_logs',
    description: 'Lê o final de um log do sistema (klaus.log, support.log ou jarvis.log).',
    parameters: {
      type: 'object',
      properties: {
        which: { type: 'string', enum: ['klaus', 'support', 'jarvis'] },
        lastLines: { type: 'number' },
      },
      required: ['which'],
    },
  },
  {
    type: 'function',
    name: 'support_pin_memory',
    description: 'Salva uma memória selecionada (pin) para o Suporte IA usar como prioridade nas próximas decisões.',
    parameters: {
      type: 'object',
      properties: {
        text: { type: 'string' },
      },
      required: ['text'],
    },
  },
  {
    type: 'function',
    name: 'support_list_pins',
    description: 'Lista memórias selecionadas (pins) do Suporte IA.',
    parameters: { type: 'object', properties: {} },
  },
  {
    type: 'function',
    name: 'support_remove_pin',
    description: 'Remove uma memória selecionada (pin) pelo id.',
    parameters: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
    },
  },
  // Ações destrutivas / mutações — exigem confirmação
  {
    type: 'function',
    name: 'support_request_clear_db',
    description: 'Solicita confirmação para apagar o db.json (destrutivo).',
    parameters: {
      type: 'object',
      properties: { reason: { type: 'string' } },
    },
  },
  {
    type: 'function',
    name: 'support_request_clear_log',
    description: 'Solicita confirmação para apagar um log (destrutivo).',
    parameters: {
      type: 'object',
      properties: { which: { type: 'string', enum: ['klaus', 'support', 'jarvis'] }, reason: { type: 'string' } },
      required: ['which'],
    },
  },
  {
    type: 'function',
    name: 'support_request_delete_path',
    description: 'Solicita confirmação para deletar um arquivo/pasta dentro do projeto (destrutivo).',
    parameters: {
      type: 'object',
      properties: { path: { type: 'string' }, reason: { type: 'string' } },
      required: ['path'],
    },
  },
  {
    type: 'function',
    name: 'support_request_replace_lines',
    description: 'Solicita confirmação para substituir um intervalo de linhas em um arquivo (muta código).',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        startLine: { type: 'number' },
        endLine: { type: 'number' },
        newText: { type: 'string' },
        reason: { type: 'string' },
      },
      required: ['path', 'startLine', 'endLine', 'newText'],
    },
  },
  {
    type: 'function',
    name: 'support_request_replace_text',
    description: 'Solicita confirmação para substituir texto literal em um arquivo (muta código).',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        find: { type: 'string' },
        replace: { type: 'string' },
        replaceAll: { type: 'boolean' },
        reason: { type: 'string' },
      },
      required: ['path', 'find', 'replace'],
    },
  },

  {
    type: 'function',
    name: 'support_request_cmd',
    description: 'Solicita confirmação para executar um comando no sistema (cmd/terminal) no contexto do projeto. Use com cuidado.',
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string' },
        cwd: { type: 'string', description: 'Diretório relativo ao projeto (opcional). Default: "."' },
        timeoutMs: { type: 'number', description: 'Timeout em ms (opcional). Default: 20000' },
        reason: { type: 'string' }
      },
      required: ['command']
    }
  },
];

function buildSupportInstruction() {
  const root = process.cwd();
  return `VOCÊ É O SUPORTE IA DO KLAUS OS (modo PRO).

MISSÃO:
- Ajudar o César a diagnosticar, corrigir e evoluir este projeto.
- Você pode ler arquivos do projeto, buscar trechos e sugerir correções.
- Você pode solicitar mudanças (patches) e também executar comandos no sistema, mas ações destrutivas SEMPRE exigem confirmação.

REGRAS CRÍTICAS:
- Nunca invente. Se não tiver certeza, use tools para ler o arquivo ou buscar no código.
- Para qualquer alteração em arquivo/banco/log/comando: use as tools de "support_request_*" (elas criam um pedido de confirmação).
- Só depois que o usuário confirmar (mensagem começa com "CONFIRM ") você executa a ação (o backend executa).
- Limite-se ao diretório do projeto: ${root} (paths fora disso são bloqueados).
- Banco: ${DB_PATH}
- Logs: ${LOG_DIR} (klaus.log e support.log)

FORMATO DE TRABALHO (obrigatório):
1) Diagnosticar (com evidência do código/log).
2) Propor solução com impacto e arquivos afetados.
3) Se precisar alterar algo: pedir confirmação (tool).
4) Após confirmar: validar o resultado (lendo o arquivo/log e explicando o que mudou).`;
}

function buildSupportScanReport() {
  const safeExists = (rel: string) => {
    try { return fs.existsSync(safeResolveProjectPath(rel)); } catch { return false; }
  };
  const readTail = (fp: string, lastLines: number) => {
    try {
      const content = fs.existsSync(fp) ? fs.readFileSync(fp, 'utf-8') : '';
      const lines = content.split(/\r?\n/).filter(Boolean);
      return lines.slice(Math.max(0, lines.length - lastLines)).join('\n');
    } catch {
      return '';
    }
  };

  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  const modelCore = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const modelSupport = process.env.OPENAI_MODEL_SUPPORT || modelCore;

  const items = {
    timestamp: new Date().toISOString(),
    node: process.version,
    platform: `${process.platform} ${process.arch}`,
    projectRoot: process.cwd(),
    openaiConfigured: hasOpenAI,
    openaiModelCore: modelCore,
    openaiModelSupport: modelSupport,
    whatsapp: { connected: currentState.connected, status: currentState.status },
    files: {
      voiceModule: safeExists('modules/Voice/VoiceModule.tsx'),
      supportModule: safeExists('modules/Support/SupportModule.tsx'),
      db: fs.existsSync(DB_PATH),
      env: fs.existsSync(ENV_PATH),
      envLocal: fs.existsSync(ENV_LOCAL_PATH),
    },
    logsTail: {
      klaus: readTail(LOG_MAIN_PATH, 120),
      support: readTail(LOG_SUPPORT_PATH, 200),
      jarvis: readTail(LOG_JARVIS_PATH, 200),
    },
    hintJarvis: [
      'Jarvis roda no FRONTEND (browser). Para funcionar, VITE_GEMINI_API_KEY precisa estar definido em .env.local e o dev server precisa ser reiniciado.',
      'Se o botão acende e apaga, normalmente é: chave Gemini inválida/sem permissão, ou erro do Live connect que fecha a sessão (veja jarvis.log e o Console do navegador).',
      'Permissões: permitir microfone e, se usar, compartilhamento de tela.',
    ]
  };

  return `🧪 SCAN (sob demanda) — Klaus OS\n\n` + JSON.stringify(items, null, 2);
}

async function runSupportAgent(params: {
  sessionKey: string;
  text: string;
  imageBase64?: string;
}) {
  const { sessionKey, text, imageBase64 } = params;
  if (!process.env.OPENAI_API_KEY) {
    return { text: '⚠️ OPENAI_API_KEY não configurada. Vá em Cérebro IA → Chaves e salve a chave.' };
  }

  // restaura sessão
  const st = loadSupport(sessionKey);
  const previousResponseId = st.previousResponseId;

  const memory = buildSupportMemoryBlock(sessionKey);
  const instruction = buildSupportInstruction() + memory;

  // Log persistido do suporte
  writeSupportLog(`USER: ${text.slice(0, 1000)}`);
  appendSupport(sessionKey, { role: 'user', content: text.slice(0, 8000), ts: Date.now() });

  // confirmação: mensagem especial (frontend envia)
  const confirmMatch = /^CONFIRM\s+([a-f0-9]{16})\s+([A-Za-z0-9_-]{16,})/i.exec(text.trim());
  if (confirmMatch) {
    const actionId = confirmMatch[1];
    const token = confirmMatch[2];
    const action = pendingSupportActions.get(actionId);
    if (!action) return { text: '⚠️ Não encontrei esse pedido de confirmação (talvez expirou).' };
    if (action.token !== token) return { text: '⚠️ Token de confirmação inválido.' };
    // expira em 15 minutos
    if (Date.now() - action.createdAt > 15 * 60 * 1000) {
      pendingSupportActions.delete(actionId);
      return { text: '⚠️ Esse pedido de confirmação expirou. Peça novamente.' };
    }

    try {
      // executa
      if (action.kind === 'CLEAR_DB') {
        const db = getDb();
        db.clients = [];
        db.transactions = [];
        db.budgets = [];
        db.agenda = [];
        db.templates = Array.isArray(db.templates) ? db.templates : [];
        saveDb(db);
      }
      if (action.kind === 'CLEAR_LOG') {
        const which = String(action.payload?.which || 'support');
        const fp = which === 'klaus' ? LOG_MAIN_PATH : (which === 'jarvis' ? LOG_JARVIS_PATH : LOG_SUPPORT_PATH);
        fs.writeFileSync(fp, '');
      }
      if (action.kind === 'DELETE_PATH') {
        const rel = String(action.payload?.path || '');
        const fp = safeResolveProjectPath(rel);
        const st = fs.statSync(fp);
        if (st.isDirectory()) fs.rmSync(fp, { recursive: true, force: true });
        else fs.rmSync(fp, { force: true });
      }
      if (action.kind === 'WRITE_DB') {
        const next = action.payload?.db;
        if (!next || typeof next !== 'object') throw new Error('Payload DB inválido');
        saveDb(next);
      }
      if (action.kind === 'WRITE_FILE') {
        const rel = String(action.payload?.path || '');
        const fp = safeResolveProjectPath(rel);
        const content = String(action.payload?.content ?? '');
        fs.writeFileSync(fp, content);
      }
      if (action.kind === 'REPLACE_LINES') {
        const rel = String(action.payload?.path || '');
        const fp = safeResolveProjectPath(rel);
        const startLine = Number(action.payload?.startLine || 1);
        const endLine = Number(action.payload?.endLine || startLine);
        const newText = String(action.payload?.newText || '');
        const original = fs.readFileSync(fp, 'utf-8').split(/\r?\n/);
        const s = Math.max(1, startLine);
        const e = Math.min(original.length, endLine);
        const replacement = newText.split(/\r?\n/);
        const next = [...original.slice(0, s - 1), ...replacement, ...original.slice(e)];
        fs.writeFileSync(fp, next.join('\n'));
      }
      if (action.kind === 'REPLACE_TEXT') {
        const rel = String(action.payload?.path || '');
        const fp = safeResolveProjectPath(rel);
        const find = String(action.payload?.find ?? '');
        const replace = String(action.payload?.replace ?? '');
        const replaceAll = !!action.payload?.replaceAll;
        const original = fs.readFileSync(fp, 'utf-8');
        if (!find) throw new Error('Texto de busca vazio');
        const next = replaceAll ? original.split(find).join(replace) : original.replace(find, replace);
        fs.writeFileSync(fp, next);
      }

      if (action.kind === 'RUN_CMD') {
        const command = String(action.payload?.command || '');
        const cwdRel = String(action.payload?.cwd || '.');
        const timeoutMs = Math.max(1000, Math.min(120000, Number(action.payload?.timeoutMs || 20000)));
        if (!command.trim()) throw new Error('Comando vazio');
        if (command.length > 2000) throw new Error('Comando muito longo');
        const cwd = safeResolveProjectPath(cwdRel);

        const { spawnSync } = await import('node:child_process');
        const isWin = process.platform === 'win32';
        const proc = isWin
          ? spawnSync('cmd.exe', ['/c', command], { cwd, encoding: 'utf-8', timeout: timeoutMs, maxBuffer: 5 * 1024 * 1024 })
          : spawnSync('bash', ['-lc', command], { cwd, encoding: 'utf-8', timeout: timeoutMs, maxBuffer: 5 * 1024 * 1024 });

        const out = (proc.stdout || '').toString();
        const err = (proc.stderr || '').toString();
        const code = typeof proc.status === 'number' ? proc.status : null;

        writeSupportLog(`CMD: ${command} (cwd=${cwdRel}) => code=${code}`);
        if (out) writeSupportLog(`CMD STDOUT: ${out.slice(0, 2000)}`);
        if (err) writeSupportLog(`CMD STDERR: ${err.slice(0, 2000)}`);

        action.payload.__result = { code, stdout: out.slice(0, 12000), stderr: err.slice(0, 12000) };
      }

      pendingSupportActions.delete(actionId);
      writeSupportLog(`CONFIRMED: ${action.summary}`);
      const cmdResult = action.kind === 'RUN_CMD' ? (action.payload?.__result ? `\n\n🧪 Resultado do comando:\ncode: ${action.payload.__result.code}\n\nstdout:\n${action.payload.__result.stdout || ''}\n\nstderr:\n${action.payload.__result.stderr || ''}` : '') : '';
      return { text: `✅ Ação confirmada e executada: ${action.summary}${cmdResult}\n\nSe quiser, eu valido agora (lendo arquivo/log) para garantir que ficou 100%.` };
    } catch (e: any) {
      writeSupportLog(`CONFIRM ERROR: ${e?.message || e}`);
      return { text: `⚠️ Executei a ação, mas deu erro: ${e?.message || e}` };
    }
  }

  // chama o modelo
  const input: any[] = [];
  if (imageBase64) {
    // multimodal: imagem do usuário (print de erro etc.)
    input.push({ role: 'user', content: [
      { type: 'input_text', text },
      { type: 'input_image', image_base64: imageBase64 }
    ] });
  } else {
    input.push({ role: 'user', content: [{ type: 'input_text', text }] });
  }

  let confirmOut: { actionId: string; token: string; summary: string } | undefined;

  const resp = await openai.responses.create({
    model: process.env.OPENAI_MODEL_SUPPORT || process.env.OPENAI_MODEL || 'gpt-4o-mini',
    instructions: instruction,
    tools: SUPPORT_TOOLS,
    input,
    previous_response_id: previousResponseId,
  });

  let r: any = resp;
  // loop tools
  const maxLoops = 12;
  for (let i = 0; i < maxLoops; i++) {
    const calls = (r.output || []).filter((o: any) => o.type === 'function_call');
    if (!calls.length) break;

    const outputs: any[] = [];
    for (const c of calls) {
      const name = c.name;
      const args = c.arguments ? JSON.parse(c.arguments) : {};

      try {
        if (name === 'support_list_files') {
          const files = listProjectFiles(args.dir || '.', args.max || 300);
          outputs.push({ type: 'function_call_output', call_id: c.call_id, output: JSON.stringify({ files }) });
          continue;
        }
        if (name === 'support_read_file') {
          const out = readTextFileWithLines(args.path, args.startLine, args.endLine);
          outputs.push({ type: 'function_call_output', call_id: c.call_id, output: JSON.stringify(out) });
          continue;
        }
        if (name === 'support_search_code') {
          const hits = searchInProject(args.query, { maxHits: args.maxHits, fileExts: args.fileExts });
          outputs.push({ type: 'function_call_output', call_id: c.call_id, output: JSON.stringify({ hits }) });
          continue;
        }
        if (name === 'support_read_db') {
          const db = getDb();
          outputs.push({ type: 'function_call_output', call_id: c.call_id, output: JSON.stringify(db) });
          continue;
        }
        if (name === 'support_read_logs') {
          const which = String(args.which || 'support');
          const fp = which === 'klaus' ? LOG_MAIN_PATH : (which === 'jarvis' ? LOG_JARVIS_PATH : LOG_SUPPORT_PATH);
          const lastLines = Math.max(10, Math.min(2000, Number(args.lastLines || 200)));
          const content = fs.existsSync(fp) ? fs.readFileSync(fp, 'utf-8') : '';
          const lines = content.split(/\r?\n/).filter(Boolean);
          const tail = lines.slice(Math.max(0, lines.length - lastLines));
          outputs.push({ type: 'function_call_output', call_id: c.call_id, output: JSON.stringify({ which, lastLines, text: tail.join('\n') }) });
          continue;
        }
        if (name === 'support_pin_memory') {
          const st = loadSupport(sessionKey);
          const pins = Array.isArray(st.pins) ? st.pins : [];
          const id = newActionId();
          pins.push({ id, text: String(args.text || '').slice(0, 2000), ts: Date.now() });
          saveSupport(sessionKey, { ...st, pins });
          outputs.push({ type: 'function_call_output', call_id: c.call_id, output: JSON.stringify({ ok: true, id }) });
          continue;
        }
        if (name === 'support_list_pins') {
          const st = loadSupport(sessionKey);
          outputs.push({ type: 'function_call_output', call_id: c.call_id, output: JSON.stringify({ pins: st.pins || [] }) });
          continue;
        }
        if (name === 'support_remove_pin') {
          const st = loadSupport(sessionKey);
          const pins = (st.pins || []).filter((p) => p.id !== String(args.id || ''));
          saveSupport(sessionKey, { ...st, pins });
          outputs.push({ type: 'function_call_output', call_id: c.call_id, output: JSON.stringify({ ok: true }) });
          continue;
        }

        // pedidos de confirmação
        const requestConfirm = (kind: PendingAction['kind'], payload: any, summary: string) => {
          const actionId = newActionId();
          const token = crypto.randomBytes(12).toString('base64url');
          const action: PendingAction = { id: actionId, token, createdAt: Date.now(), summary, kind, payload };
          pendingSupportActions.set(actionId, action);
          confirmOut = { actionId, token, summary };
          outputs.push({ type: 'function_call_output', call_id: c.call_id, output: JSON.stringify({ confirm: confirmOut }) });
        };

        
        if (name === 'support_request_cmd') {
          const command = String(args.command || '');
          const cwd = args.cwd ? String(args.cwd) : '.';
          const timeoutMs = args.timeoutMs ? Number(args.timeoutMs) : 20000;
          const reason = args.reason ? String(args.reason) : undefined;
          const summary = `Executar comando no sistema (cwd=${cwd}):\n${command}\n${reason ? `\nMotivo: ${reason}` : ''}`;
          const { actionId, token } = requestConfirm('RUN_CMD', { command, cwd, timeoutMs }, summary);
          confirmOut = { actionId, token, summary };
          outputs.push({ type: 'function_call_output', call_id: c.call_id, output: JSON.stringify({ ok: true, actionId, token, summary }) });
          continue;
        }
if (name === 'support_request_clear_db') {
          requestConfirm('CLEAR_DB', {}, `Apagar db.json (limpar clients/transactions/budgets/agenda). Motivo: ${String(args.reason || '').slice(0, 200)}`);
          continue;
        }
        if (name === 'support_request_clear_log') {
          requestConfirm('CLEAR_LOG', { which: args.which }, `Apagar log ${args.which}. Motivo: ${String(args.reason || '').slice(0, 200)}`);
          continue;
        }
        if (name === 'support_request_delete_path') {
          requestConfirm('DELETE_PATH', { path: args.path }, `Deletar caminho "${args.path}". Motivo: ${String(args.reason || '').slice(0, 200)}`);
          continue;
        }
        if (name === 'support_request_replace_lines') {
          requestConfirm(
            'REPLACE_LINES',
            { path: args.path, startLine: args.startLine, endLine: args.endLine, newText: args.newText },
            `Substituir linhas ${args.startLine}-${args.endLine} em ${args.path}. Motivo: ${String(args.reason || '').slice(0, 200)}`
          );
          continue;
        }
        if (name === 'support_request_replace_text') {
          requestConfirm(
            'REPLACE_TEXT',
            { path: args.path, find: args.find, replace: args.replace, replaceAll: !!args.replaceAll },
            `Substituir texto em ${args.path}. replaceAll=${!!args.replaceAll}. Motivo: ${String(args.reason || '').slice(0, 200)}`
          );
          continue;
        }

        outputs.push({ type: 'function_call_output', call_id: c.call_id, output: JSON.stringify({ ok: false, error: 'Tool não implementada.' }) });
      } catch (e: any) {
        outputs.push({ type: 'function_call_output', call_id: c.call_id, output: JSON.stringify({ ok: false, error: e?.message || e }) });
      }
    }

    r = await openai.responses.create({
      model: process.env.OPENAI_MODEL_SUPPORT || process.env.OPENAI_MODEL || 'gpt-4o-mini',
      instructions: instruction,
      tools: SUPPORT_TOOLS,
      input: outputs,
      previous_response_id: r.id,
    });
  }

  // persiste sessão
  const outText = String(r.output_text || '').trim();
  saveSupport(sessionKey, {
    ...loadSupport(sessionKey),
    previousResponseId: r.id,
    messages: pruneSupportMessages(loadSupport(sessionKey).messages || []),
  });
  if (outText) appendSupport(sessionKey, { role: 'assistant', content: outText.slice(0, 8000), ts: Date.now() });
  writeSupportLog(`ASSISTANT: ${outText.slice(0, 1000)}`);

  return { text: outText || 'Ok.', confirm: confirmOut };
}

// =========================
// WhatsApp Client
// =========================
const wwClient = new WhatsAppClient({
  authStrategy: new LocalAuth({ dataPath: './.wwebjs_auth' }),
  puppeteer: { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] },
});

// =========================
// WhatsApp Queue (3.0 PRO)
// =========================
// Processamento sequencial por chat para evitar:
// - respostas duplicadas
// - corrida de estado (previous_response_id)
// - travas quando chegam muitas mensagens juntas
const waQueueByJid = new Map<string, Promise<void>>();
function queueWhatsappMessage(jid: string, job: () => Promise<void>) {
  const prev = waQueueByJid.get(jid) || Promise.resolve();
  const next = prev
    .catch(() => {})
    .then(job)
    .catch((e) => {
      addLog(`Fila WhatsApp (${jid}) falhou: ${(e as any)?.message || e}`, 'sys');
    });
  waQueueByJid.set(jid, next);
  return next;
}

wwClient.on('qr', async (qr: string) => {
  currentState.qr = await qrcode.toDataURL(qr);
  currentState.status = 'qr_ready';
});

wwClient.on('ready', () => {
  currentState.connected = true;
  currentState.status = 'connected';
  addLog('Klaus Pocket pronto para o Mestre César.', 'sys');
});

// Aprovação/Recusa por WhatsApp (hard rule)
async function applyBudgetDecision(id: string, action: 'Aprovado' | 'Recusado') {
  const db = getDb();
  const b = db.budgets.find((x: any) => x.id === id);

  if (!b) return { ok: false as const, reply: `⚠️ Não achei orçamento com ID ${id}.` };

  b.status = action;
  saveDb(db);

  if (action === 'Aprovado') {
    // envia para o cliente apenas agora
    const contato = b.contato;
    if (contato && contato.includes('@c.us')) {
      const companyKey = (b.company || 'bellarte');
      const details: any = db.config?.companyDetails?.[companyKey] || {};
      const tpl = db.config?.docTemplates?.[companyKey]?.budgetMessage ||
        '✅ *ORÇAMENTO APROVADO*\n\nCliente: {{CLIENT_NAME}}\nServiço: {{SERVICE}}\nValor: R$ {{VALUE}}\nData: {{DATE}}';
      const vars = {
        COMPANY_NAME: (companyKey === 'alfa' ? db.companies?.alfa : db.companies?.bellarte) || details.nome || '',
        COMPANY_CNPJ: details.cnpj || '',
        COMPANY_ADDRESS: details.endereco || '',
        COMPANY_PHONE: details.telefone || '',
        COMPANY_EMAIL: details.email || '',
        COMPANY_SITE: details.site || '',
        COMPANY_PIX: details.pix || '',
        CLIENT_NAME: b.cliente || '',
        CLIENT_PHONE: '',
        SERVICE: b.servico || '',
        VALUE: Number(b.valor || 0).toFixed(2),
        DATE: b.data || new Date().toLocaleDateString('pt-BR'),
        TEXT: ''
      };
      const msg = renderTemplate(tpl, vars).trim();
      try {
        // Envia PDF + mensagem (no celular fica perfeito)
        try {
          const pdfBuf = await generateBudgetPdfBuffer(db, b);
          if (getWhatsAppProvider() === 'meta') {
            const publicBaseUrl = getPublicBaseUrl();
            const publicContato = contato.replace(/@c\.us$/i, '');
            if (publicBaseUrl) {
              const link = `${publicBaseUrl}/api/budgets/${encodeURIComponent(String(b.id || ''))}/pdf`;
              await sendWhatsAppMessage(publicContato, {
                __metaDocumentLink: true,
                link,
                filename: `orcamento-${b.id}.pdf`,
              }, { caption: msg });
            } else {
              await sendWhatsAppMessage(publicContato, `${msg}\n\nPDF: orçamento disponível no painel local.`);
            }
          } else {
            const media = new MessageMedia('application/pdf', pdfBuf.toString('base64'), `orcamento-${b.id}.pdf`);
            await sendWhatsAppMessage(contato, media, { caption: msg });
          }
        } catch {
          // fallback: pelo menos texto
          await sendWhatsAppMessage(contato, msg);
        }
      } catch (e: any) {
        addLog(`Falha ao enviar orçamento ao cliente: ${e?.message || e}`, 'sys');
      }
    }
    return { ok: true as const, reply: `✅ Aprovado. Enviado ao cliente (${b.contato}).` };
  }

  return { ok: true as const, reply: `🛑 Recusado. Orçamento ${id} marcado como recusado.` };
}

async function handleBudgetDecision(text: string) {
  const t = text.trim();
  const approve = /^aprovar\s+(\S+)/i.exec(t);
  const reject = /^recusar\s+(\S+)/i.exec(t);
  if (!approve && !reject) return { handled: false as const };
  const id = (approve?.[1] || reject?.[1] || '').trim();
  const action = approve ? 'Aprovado' : 'Recusado';
  const result = await applyBudgetDecision(id, action);
  return { handled: true as const, reply: result.reply };
}

async function processIncomingWhatsappText(from: string, text: string) {
  const isMaster = from === CESAR_NUMBER || normalizePhoneDigits(from) === normalizePhoneDigits(CESAR_NUMBER);

  if (isMaster) {
    const decision = await handleBudgetDecision(text);
    if (decision.handled) return { reply: decision.reply, handled: true as const };

    const talkMatch = /^FALAR_CLIENTE_(\d+)$/i.exec(text.trim());
    if (talkMatch) {
      const phone = String(talkMatch[1] || '').trim();
      return { reply: `📞 Cliente para contato: +${phone}` , handled: true as const };
    }

    const addrMatch = /^VER_ENDERECO_(\d+)$/i.exec(text.trim());
    if (addrMatch) {
      const phone = String(addrMatch[1] || '').trim();
      const db = getDb();
      const latestEvent = (Array.isArray(db.agenda) ? [...db.agenda] : [])
        .filter((e: any) => normalizePhoneDigits(e?.contactPhone || '') === phone)
        .sort((a: any, b: any) => `${String(b.date || '')} ${String(b.time || '')}`.localeCompare(`${String(a.date || '')} ${String(a.time || '')}`))[0];
      if (!latestEvent) return { reply: `⚠️ Não achei endereço salvo para +${phone}.`, handled: true as const };
      return { reply: `📍 Endereço de +${phone}\n${String(latestEvent.address || 'Endereço não informado')}\n\nData: ${String(latestEvent.date || '')} ${String(latestEvent.time || '')}` , handled: true as const };
    }

    const convoMatch = /^VER_CONVERSA_(\d+)$/i.exec(text.trim());
    if (convoMatch) {
      const phone = String(convoMatch[1] || '').trim();
      const st = loadConversation(`whatsapp:${phone}`);
      const msgs = Array.isArray(st?.messages) ? st.messages.slice(-8) : [];
      if (!msgs.length) return { reply: `⚠️ Não achei conversa salva para +${phone}.`, handled: true as const };
      const summary = msgs.map((m: any) => `${m.role === 'assistant' ? 'Klaus' : 'Cliente'}: ${String(m.content || '').replace(/\s+/g, ' ').slice(0, 180)}`).join('\n\n');
      return { reply: `🗂️ Últimas mensagens de +${phone}\n\n${summary}`.slice(0, 3500), handled: true as const };
    }

    if (text.toLowerCase().startsWith('klaus, mude para')) {
      const db = getDb();
      const lower = text.toLowerCase();
      if (lower.includes('alfa')) db.activeProfile = 'PROSPECTING_ALFA';
      else if (lower.includes('custom')) db.activeProfile = 'PROSPECTING_CUSTOM';
      else if (lower.includes('atendimento')) db.activeProfile = 'ATTENDANT';
      saveDb(db);
      return { reply: `✅ Perfil alterado para: ${db.activeProfile}. (Sessão mantida. Use o painel para limpar sessões.)`, handled: true as const };
    }
  }

  addLog(`Msg: ${from} (Master: ${isMaster})`, isMaster ? 'user' : 'sys');
  const db = getDb();
  const sessionKey = `whatsapp:${from}`;
  const result = await runCoreAgent({
    sessionKey,
    db,
    channel: 'whatsapp',
    from,
    isMaster,
    text,
    wwClient: getWhatsAppProvider() === 'web' ? wwClient : undefined,
  });
  return { reply: result.text || 'Ok.', handled: true as const };
}

wwClient.on('message', async (msg: any) => {
  const jid = msg.from;
  // fila por chat (não bloquear event loop)
  queueWhatsappMessage(jid, async () => {
    // ignora status e grupos
    if (msg.from === 'status@broadcast') return;
    if (msg.from?.includes('@g.us')) return;

  const from = msg.from;
  const rawText = (msg.body || '').trim();

  // Loga sempre o tipo (ajuda a debugar mídia que antes "sumia")
  try {
    addLog(`IN_SIGNAL\n${new Date().toLocaleTimeString()}\nType: ${msg.type} | hasMedia: ${!!msg.hasMedia}`, 'sys');
  } catch {}

  // =========================
  // Mídia (áudio/imagem/doc)
  // =========================
  // Observação: em áudio (ptt) o body costuma vir vazio.
  // Se não tratarmos aqui, a mensagem "some" sem log/erro.
  if (msg.hasMedia) {
    try {
      const media = await msg.downloadMedia();
      const mimetype = media?.mimetype || '';
      const filename = media?.filename || '';

      // Áudio → transcrição (OpenAI) → passa texto para o Core
      if (mimetype.startsWith('audio/') || msg.type === 'ptt' || msg.type === 'audio') {
        if (!process.env.OPENAI_API_KEY) {
          await msg.reply('⚠️ Não consigo transcrever áudio sem OPENAI_API_KEY. Configure no painel (Cérebro IA).');
          return;
        }

        addLog(`Áudio recebido de ${from} (${mimetype || msg.type})`, 'sys');

        const ext = (mimetype.split('/')[1] || 'ogg').split(';')[0];
        const tempPath = path.join(os.tmpdir(), `klaus-audio-${Date.now()}.${ext}`);
        fs.writeFileSync(tempPath, Buffer.from(media.data, 'base64'));

        const transcript = await openai.audio.transcriptions.create({
          // modelo estável para STT
          model: 'whisper-1',
          file: fs.createReadStream(tempPath) as any,
        });

        try { fs.unlinkSync(tempPath); } catch {}

        const text = (transcript as any)?.text?.trim() || '';
        if (!text) {
          await msg.reply('⚠️ Recebi seu áudio, mas não consegui transcrever. Pode repetir com áudio mais curto?');
          return;
        }

        // segue fluxo normal (como se fosse texto)
        const isMaster = from === CESAR_NUMBER;
        addLog(`Msg(áudio→texto): ${from} (Master: ${isMaster})`, isMaster ? 'user' : 'sys');

        // hard commands só para master (aprovar/recusar etc.)
        if (isMaster) {
          const decision = await handleBudgetDecision(text);
          if (decision.handled) {
            await msg.reply(decision.reply);
            return;
          }
          if (text.toLowerCase().startsWith('klaus, mude para')) {
            const db = getDb();
            const lower = text.toLowerCase();
            if (lower.includes('alfa')) db.activeProfile = 'PROSPECTING_ALFA';
            else if (lower.includes('custom')) db.activeProfile = 'PROSPECTING_CUSTOM';
            else if (lower.includes('atendimento')) db.activeProfile = 'ATTENDANT';
            saveDb(db);
            await msg.reply(`✅ Perfil alterado para: ${db.activeProfile}. (Sessão mantida. Use o painel para limpar sessões.)`);
            return;
          }
        }

        const db = getDb();
        const sessionKey = `whatsapp:${from}`;
        const result = await runCoreAgent({
          sessionKey,
          db,
          channel: 'whatsapp',
          from,
          isMaster,
          text,
          wwClient,
        });

        await msg.reply(result.text || 'Ok.');
        addLog(`Klaus respondeu (áudio) a ${from}`, 'ia');
        return;
      }

      // Imagem → Core multimodal (OpenAI) com input_image
      if (mimetype.startsWith('image/')) {
        const isMaster = from === CESAR_NUMBER;
        const db = getDb();
        const sessionKey = `whatsapp:${from}`;
        const dataUrl = `data:${mimetype};base64,${media.data}`;
        const prompt = rawText || 'Descreva a imagem e me diga o que devo fazer a seguir.';

        addLog(`Imagem recebida de ${from} (${mimetype})`, 'sys');

        const result = await runCoreAgent({
          sessionKey,
          db,
          channel: 'whatsapp',
          from,
          isMaster,
          text: prompt,
          media: { kind: 'image', dataUrl },
          wwClient,
        });

        await msg.reply(result.text || 'Ok.');
        addLog(`Klaus respondeu (imagem) a ${from}`, 'ia');
        return;
      }

      // Documento/PDF/Outros: por enquanto confirma recebimento
      addLog(`Arquivo recebido de ${from}: ${filename || '(sem nome)'} (${mimetype || msg.type})`, 'sys');
      await msg.reply('📎 Recebi o arquivo. No momento eu processo *áudios (transcrição)* e *imagens*. Se quiser, mande uma foto do documento ou descreva o que precisa.');
      return;
    } catch (e: any) {
      addLog(`Erro processando mídia: ${e?.message || e}`, 'sys');
      // cai para tratamento de texto normal abaixo (se houver)
    }
  }

  const text = rawText;
  if (!text) return;

  const isMaster = from === CESAR_NUMBER;

  // hard commands
  if (isMaster) {
    const decision = await handleBudgetDecision(text);
    if (decision.handled) {
      await msg.reply(decision.reply);
      return;
    }

    // troca de perfil (sem limpar sessão automaticamente)
    if (text.toLowerCase().startsWith('klaus, mude para')) {
      const db = getDb();
      const lower = text.toLowerCase();
      if (lower.includes('alfa')) db.activeProfile = 'PROSPECTING_ALFA';
      else if (lower.includes('custom')) db.activeProfile = 'PROSPECTING_CUSTOM';
      else if (lower.includes('atendimento')) db.activeProfile = 'ATTENDANT';
      saveDb(db);
      await msg.reply(`✅ Perfil alterado para: ${db.activeProfile}. (Sessão mantida. Use o painel para limpar sessões.)`);
      return;
    }
  }

  addLog(`Msg: ${from} (Master: ${isMaster})`, isMaster ? 'user' : 'sys');

  const db = getDb();

  try {
    const sessionKey = `whatsapp:${from}`;
    const result = await runCoreAgent({
      sessionKey,
      db,
      channel: 'whatsapp',
      from,
      isMaster,
      text,
      wwClient,
    });

    if (result.text) {
      await msg.reply(result.text);
      addLog(`Klaus respondeu a ${from}`, 'ia');
    }
  } catch (e: any) {
    addLog(`Erro WhatsApp/Core: ${e?.message || e}`, 'sys');
  }
  });
});

// =========================
// API
// =========================
app.get('/health', (req, res) => {
  res.json({ ok: true, status: 'up' });
});

app.get('/status', (req, res) =>
  res.json({
    ...getWhatsappPublicState(),
    lastDbUpdate,
    logs: activityLogs,
    activeProfile: getDb().activeProfile,
    sessions: coreSessions.size,
  }),
);

app.get('/api/system/data', (req, res) => res.json(getDb()));
app.post('/api/system/sync', (req, res) => {
  const current = getDb();
  const incoming = (req.body && typeof req.body === 'object') ? req.body : {};
  const next = {
    ...current,
    ...incoming,
    config: {
      ...(current.config || {}),
      ...(incoming.config || {}),
      companyDetails: {
        ...((current.config || {}).companyDetails || {}),
        ...((incoming.config || {}).companyDetails || {}),
      },
      docTemplates: {
        ...((current.config || {}).docTemplates || {}),
        ...((incoming.config || {}).docTemplates || {}),
      },
      whatsappMeta: {
        ...((current.config || {}).whatsappMeta || {}),
        ...((incoming.config || {}).whatsappMeta || {}),
      },
    },
    companies: {
      ...(current.companies || {}),
      ...(incoming.companies || {}),
    },
    clients: Array.isArray(incoming.clients) ? incoming.clients : current.clients,
    transactions: Array.isArray(incoming.transactions) ? incoming.transactions : current.transactions,
    budgets: Array.isArray(incoming.budgets) ? incoming.budgets : current.budgets,
    agenda: Array.isArray(incoming.agenda) ? incoming.agenda : current.agenda,
    templates: Array.isArray(incoming.templates) ? incoming.templates : current.templates,
    activeProfile: incoming.activeProfile || current.activeProfile,
  };
  saveDb(next);
  res.json({ status: 'ok' });
});

// =========================
// Templates upload/list/download
// =========================
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, TEMPLATES_DIR),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || '') || '.pdf';
      cb(null, `${crypto.randomUUID()}${ext}`);
    },
  }),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
});

app.get('/api/templates/list', (req, res) => {
  const db = getDb();
  res.json({ ok: true, templates: db.templates || [] });
});

app.post('/api/templates/upload', upload.single('file'), (req, res) => {
  try {
    const company = String((req.body as any)?.company || 'bellarte');
    const docType = String((req.body as any)?.docType || 'other');
    const file = (req as any).file;
    if (!file) return res.status(400).json({ ok: false, error: 'Arquivo não enviado' });

    const db = getDb();
    const rec = {
      id: crypto.randomUUID(),
      company,
      docType,
      name: file.filename,
      filename: file.filename,
      originalName: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      uploadedAt: Date.now(),
    };
    db.templates = Array.isArray(db.templates) ? db.templates : [];
    db.templates.unshift(rec);
    saveDb(db);
    res.json({ ok: true, template: rec });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

app.get('/api/templates/:id/download', (req, res) => {
  const db = getDb();
  const id = String(req.params.id);
  const tpl = (db.templates || []).find((t: any) => t.id === id);
  if (!tpl) return res.status(404).send('Not found');
  const filePath = path.join(TEMPLATES_DIR, tpl.filename);
  if (!fs.existsSync(filePath)) return res.status(404).send('File missing');
  res.download(filePath, tpl.originalName || tpl.filename);
});

// =========================
// Budgets download (PDF)
// =========================
app.get('/api/budgets/:id/pdf', async (req, res) => {
  const db = getDb();
  const id = String(req.params.id);
  const b = (db.budgets || []).find((x: any) => x.id === id);
  if (!b) return res.status(404).json({ ok: false, error: 'Orçamento não encontrado' });
  try {
    const pdf = await generateBudgetPdfBuffer(db, b);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="orcamento-${id}.pdf"`);
    res.send(pdf);
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

// Aprovar/Recusar orçamento via Painel (mesma lógica do WhatsApp)
app.post('/api/budgets/decision', async (req, res) => {
  try {
    const { id, action } = req.body || {};
    if (!id || !action) return res.status(400).json({ ok: false, error: 'id/action obrigatórios' });
    if (action !== 'Aprovado' && action !== 'Recusado') return res.status(400).json({ ok: false, error: 'action inválido' });
    const result = await applyBudgetDecision(String(id), action);
    const db = getDb();
    res.json({ ok: result.ok, reply: result.reply, budgets: db.budgets });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

// Dispatcher unificado (WhatsApp já usa internamente; painel/Jarvis usam via HTTP)
app.post('/api/ai/dispatch', async (req, res) => {
  try {
    const { channel, from, text, module } = req.body || {};
    if (!channel || !from || !text) {
      return res.status(400).json({ error: 'channel/from/text são obrigatórios' });
    }

    const db = getDb();
    const isMaster = String(from).includes('master') || from === CESAR_NUMBER;
    const sessionKey = `${channel}:${from}`;

    const result = await runCoreAgent({
      sessionKey,
      db,
      channel,
      from,
      isMaster,
      module,
      text,
    });

    res.json({ ok: true, text: result.text, didMutateDb: result.didMutateDb });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

// =========================
// Suporte IA (painel)
// =========================
app.post('/api/support/chat', async (req, res) => {
  try {
    const { sessionId, message, imageBase64 } = req.body || {};
    if (!sessionId || !message) return res.status(400).json({ error: 'sessionId e message são obrigatórios' });

    // Scan sob demanda (somente quando o César pedir)
    const trimmed = String(message).trim();
    if (trimmed === '/scan' || trimmed === 'SCAN' || trimmed === 'scan') {
      const report = buildSupportScanReport();
      return res.json({ text: report, confirm: undefined });
    }

    const sessionKey = String(sessionId);
    const result = await runSupportAgent({
      sessionKey,
      text: String(message),
      imageBase64: typeof imageBase64 === 'string' ? imageBase64 : undefined,
    });

    res.json({ text: result.text, confirm: (result as any).confirm });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || String(e) });
  }
});

// Logs do frontend (Jarvis) → server-side (para o Suporte IA conseguir diagnosticar)
app.post('/api/support/frontend-log', (req, res) => {
  try {
    const { source, level, message, data } = req.body || {};
    const src = String(source || 'frontend');
    const lvl = String(level || 'info');
    const msg = String(message || '').slice(0, 4000);
    addJarvisLog(`[${src}] [${lvl}] ${msg}`, data);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

// Scan sob demanda (endpoint direto)
app.get('/api/support/scan', (req, res) => {
  try {
    const report = buildSupportScanReport();
    res.json({ ok: true, report });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

app.post('/api/support/clear-session', (req, res) => {
  try {
    const { sessionId } = req.body || {};
    if (!sessionId) return res.status(400).json({ error: 'sessionId é obrigatório' });
    const fp = supportFileFor(String(sessionId));
    if (fs.existsSync(fp)) fs.rmSync(fp, { force: true });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

// WhatsApp controls
app.post('/api/system/restart-whatsapp', async (req, res) => {
  try {
    if (getWhatsAppProvider() === 'meta') {
      refreshMetaState(null);
      metaState.connected = isMetaReady();
      metaState.status = metaState.connected ? 'connected' : 'config_required';
      return res.json({ status: metaState.status, provider: 'meta', meta: metaState });
    }
    await wwClient.destroy();
    currentState.connected = false;
    currentState.status = 'restarting';
    setTimeout(() => {
      wwClient.initialize();
    }, 400);
    res.json({ status: 'restarting', provider: 'web' });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || String(e) });
  }
});

app.post('/api/system/stop-whatsapp', async (req, res) => {
  try {
    if (getWhatsAppProvider() === 'meta') {
      refreshMetaState(null);
      metaState.connected = false;
      metaState.status = 'stopped';
      return res.json({ status: 'stopped', provider: 'meta', meta: metaState });
    }
    await wwClient.destroy();
    currentState.connected = false;
    currentState.qr = null;
    currentState.status = 'stopped';
    res.json({ status: 'stopped', provider: 'web' });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || String(e) });
  }
});

app.post('/api/system/start-whatsapp', async (req, res) => {
  try {
    if (getWhatsAppProvider() === 'meta') {
      refreshMetaState(null);
      metaState.connected = isMetaReady();
      metaState.status = metaState.connected ? 'connected' : 'config_required';
      return res.json({ status: metaState.status, provider: 'meta', meta: metaState });
    }
    wwClient.initialize();
    currentState.status = 'starting';
    res.json({ status: 'starting', provider: 'web' });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || String(e) });
  }
});

app.post('/api/system/clear-sessions', (req, res) => {
  coreSessions.clear();
  res.json({ ok: true, cleared: true });
});

// Atualiza chaves no .env e .env.local (Jarvis usa VITE_GEMINI_API_KEY; Core usa OPENAI_API_KEY)
app.get('/api/system/env', (req, res) => {
  res.json({
    openai: maskKey(process.env.OPENAI_API_KEY),
    gemini: maskKey(process.env.VITE_GEMINI_API_KEY || process.env.API_KEY),
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  });
});

app.post('/api/system/update-env', (req, res) => {
  const { openaiKey, geminiKey, openaiModel } = req.body || {};

  try {
    if (typeof openaiKey === 'string' && openaiKey.trim()) {
      upsertEnvValue(ENV_PATH, 'OPENAI_API_KEY', openaiKey.trim());
      process.env.OPENAI_API_KEY = openaiKey.trim();
      openai = createOpenAIClient(openaiKey.trim());
    }

    if (typeof openaiModel === 'string' && openaiModel.trim()) {
      upsertEnvValue(ENV_PATH, 'OPENAI_MODEL', openaiModel.trim());
      process.env.OPENAI_MODEL = openaiModel.trim();
    }

    // Jarvis no browser: Vite lê .env.local e expõe VITE_*
    if (typeof geminiKey === 'string' && geminiKey.trim()) {
      upsertEnvValue(ENV_LOCAL_PATH, 'VITE_GEMINI_API_KEY', geminiKey.trim());
      process.env.VITE_GEMINI_API_KEY = geminiKey.trim();
    }

    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});


app.get('/api/system/runtime-config', (req, res) => {
  try {
    res.json({ ok: true, config: readRuntimeConfig(), tunnel: ngrokManager.status() });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

app.post('/api/system/runtime-config', (req, res) => {
  try {
    const patchedKeys = applyRuntimeConfigPatch(req.body || {});
    res.json({ ok: true, patchedKeys: Object.keys(patchedKeys), config: readRuntimeConfig(), tunnel: ngrokManager.status() });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

// Enviar mensagem manual do Dashboard
app.post('/api/whatsapp/send', async (req, res) => {
  const { to, message } = req.body;
  try {
    await sendWhatsAppMessage(String(to || ''), String(message || ''));
    addLog(`Msg Manual p/ ${to}: ${String(message).substring(0, 20)}...`, 'user');
    res.json({ status: 'ok', provider: getWhatsAppProvider() });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Erro ao enviar mensagem' });
  }
});

app.get('/api/whatsapp/meta/config', (_req, res) => {
  try {
    const cfg = readWhatsAppMetaConfig();
    res.json({
      ok: true,
      config: {
        ...cfg,
        accessToken: maskKey(cfg.accessToken),
      },
      state: refreshMetaState(),
    });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

app.post('/api/whatsapp/meta/config', (req, res) => {
  try {
    const state = applyWhatsAppMetaConfigPatch(req.body || {});
    res.json({ ok: true, config: { ...readWhatsAppMetaConfig(), accessToken: maskKey(readWhatsAppMetaConfig().accessToken) }, state });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

app.get('/api/whatsapp/meta/webhook', (req, res) => {
  try {
    const mode = String(req.query['hub.mode'] || '');
    const token = String(req.query['hub.verify_token'] || '');
    const challenge = String(req.query['hub.challenge'] || '');
    const cfg = readWhatsAppMetaConfig();
    if (mode === 'subscribe' && token && token === cfg.verifyToken) {
      return res.status(200).send(challenge);
    }
    return res.status(403).send('Forbidden');
  } catch (e: any) {
    return res.status(500).send(e?.message || String(e));
  }
});

app.post('/api/whatsapp/meta/webhook', async (req, res) => {
  try {
    const body = req.body || {};
    const entries = Array.isArray(body.entry) ? body.entry : [];
    for (const entry of entries) {
      const changes = Array.isArray(entry?.changes) ? entry.changes : [];
      for (const change of changes) {
        const value = change?.value || {};
        const messages = Array.isArray(value?.messages) ? value.messages : [];
        for (const message of messages) {
          const from = String(message?.from || '').trim();
          const type = String(message?.type || '').trim();
          if (!from || !type) continue;
          queueWhatsappMessage(from, async () => {
            const interactiveText = String(
              message?.interactive?.button_reply?.title
              || message?.interactive?.button_reply?.id
              || message?.interactive?.list_reply?.title
              || message?.interactive?.list_reply?.id
              || ''
            ).trim();

            if (type === 'text' || (type === 'interactive' && interactiveText)) {
              const text = type === 'text'
                ? String(message?.text?.body || '').trim()
                : interactiveText;
              if (!text) return;
              addLog(`IN_SIGNAL\n${new Date().toLocaleTimeString()}\nType: meta.${type} | hasMedia: false`, 'sys');
              const result = await processIncomingWhatsappText(from, text);
              if (result?.reply) {
                await sendWhatsAppMessage(from, result.reply);
                addLog(`Klaus respondeu a ${from} (meta)`, 'ia');
              }
              return;
            }

            if (type === 'audio') {
              addLog(`IN_SIGNAL\n${new Date().toLocaleTimeString()}\nType: meta.audio | hasMedia: true`, 'sys');
              const mediaId = String(message?.audio?.id || '').trim();
              if (!mediaId) return;
              const { buffer, mimeType } = await fetchMetaMediaBuffer(mediaId);
              const text = await transcribeAudioBuffer(buffer, mimeType);
              if (!text) {
                await sendWhatsAppMessage(from, '⚠️ Recebi seu áudio, mas não consegui transcrever. Pode repetir com áudio mais curto?');
                return;
              }
              const result = await processIncomingWhatsappText(from, text);
              if (result?.reply) {
                await sendWhatsAppMessage(from, result.reply);
                addLog(`Klaus respondeu a ${from} (meta áudio)`, 'ia');
              }
              return;
            }

            if (type === 'image') {
              addLog(`IN_SIGNAL\n${new Date().toLocaleTimeString()}\nType: meta.image | hasMedia: true`, 'sys');
              const mediaId = String(message?.image?.id || '').trim();
              if (!mediaId) return;
              const { buffer, mimeType } = await fetchMetaMediaBuffer(mediaId);
              const isMaster = from === CESAR_NUMBER || normalizePhoneDigits(from) === normalizePhoneDigits(CESAR_NUMBER);
              const db = getDb();
              const sessionKey = `whatsapp:${from}`;
              const prompt = String(message?.image?.caption || '').trim() || 'Descreva a imagem e me diga o que devo fazer a seguir.';
              const dataUrl = `data:${mimeType || 'image/jpeg'};base64,${buffer.toString('base64')}`;
              const result = await runCoreAgent({
                sessionKey,
                db,
                channel: 'whatsapp',
                from,
                isMaster,
                text: prompt,
                media: { kind: 'image', dataUrl },
              });
              if (result?.text) {
                await sendWhatsAppMessage(from, result.text);
                addLog(`Klaus respondeu a ${from} (meta imagem)`, 'ia');
              }
              return;
            }

            if (type === 'document' || type === 'video' || type === 'sticker') {
              addLog(`Arquivo recebido de ${from}: meta.${type}`, 'sys');
              await sendWhatsAppMessage(from, '📎 Recebi o arquivo. No momento eu processo texto, áudios (transcrição) e imagens. Se quiser, mande uma foto do documento ou descreva o que precisa.');
            }
          });
        }
      }
    }
    return res.json({ ok: true });
  } catch (e: any) {
    refreshMetaState(e?.message || String(e));
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});


app.get('/mcp-workbench', proxyV4Workbench);
app.post('/mcp-workbench', proxyV4Workbench);
app.get('/mcp-workbench/health', proxyV4Workbench);
app.get('/mcp-workbench/tools', proxyV4Workbench);
app.post('/mcp-workbench/:tail(*)', proxyV4Workbench);
app.get('/mcp-workbench/:tail(*)', proxyV4Workbench);

app.get('/api/system/tunnel-status', (req, res) => {
  res.json({
    ...ngrokManager.status(),
    panelProxyEnabled: getPanelProxyEnabled(),
    panelDevUrl: getPanelDevUrl(),
    panelRemoteUrl: process.env.MCP_PUBLIC_BASE_URL || null,
  });
});

app.post('/api/system/start-tunnel', async (req, res) => {
  const result = await ngrokManager.start();
  if (!result.ok) return res.status(500).json(result);
  res.json(result);
});

app.post('/api/system/stop-tunnel', async (req, res) => {
  const result = await ngrokManager.stop();
  res.json(result);
});


app.listen(PORT, '0.0.0.0', async () => {
  console.log(`🚀 NEXUS BRIDGE (Core: OpenAI Responses | Jarvis: Gemini) ONLINE NA PORTA ${PORT}`);

  const shouldStartTunnel = String(process.env.NGROK_ENABLED || 'false').toLowerCase() === 'true'
    && String(process.env.NGROK_AUTOSTART || 'false').toLowerCase() !== 'false';

  if (shouldStartTunnel) {
    const result = await ngrokManager.start();
    if (result.ok) {
      console.log(`🌐 NGROK ONLINE EM ${result.url}`);
      console.log(`🖥️ PAINEL REMOTO EM ${result.url}`);
      console.log(`🧠 MCP REMOTO EM ${result.mcpUrl}`);
    } else {
      console.error(`⚠️ NGROK NÃO SUBIU: ${result.error || result.lastError}`);
    }
  }
});

process.on('SIGINT', async () => {
  await ngrokManager.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await ngrokManager.stop();
  process.exit(0);
});

// inicia WhatsApp
wwClient.initialize();
