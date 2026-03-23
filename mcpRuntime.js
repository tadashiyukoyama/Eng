import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { spawnSync } from 'node:child_process';

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function nowIso() {
  return new Date().toISOString();
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function safeJsonParse(text, fallback) {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

function redactValue(key, value) {
  const k = String(key || '').toLowerCase();
  if (!value) return value;
  if (k.includes('key') || k.includes('token') || k.includes('secret') || k.includes('password')) {
    const v = String(value);
    if (v.length <= 8) return '***';
    return `${v.slice(0, 4)}***${v.slice(-4)}`;
  }
  return value;
}

function parseEnvText(text) {
  const map = {};
  const lines = String(text || '').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    map[key] = value;
  }
  return map;
}

function patchEnvText(original, patch) {
  const lines = String(original || '').split(/\r?\n/);
  const used = new Set();
  const next = lines.map((line) => {
    const idx = line.indexOf('=');
    if (idx === -1) return line;
    const key = line.slice(0, idx).trim();
    if (!Object.prototype.hasOwnProperty.call(patch, key)) return line;
    used.add(key);
    return `${key}=${JSON.stringify(String(patch[key] ?? ''))}`;
  });
  for (const [key, value] of Object.entries(patch || {})) {
    if (used.has(key)) continue;
    next.push(`${key}=${JSON.stringify(String(value ?? ''))}`);
  }
  return next.join('\n');
}

function readTail(filePath, lines) {
  try {
    if (!fs.existsSync(filePath)) return '';
    const content = fs.readFileSync(filePath, 'utf-8');
    const arr = content.split(/\r?\n/);
    return arr.slice(Math.max(0, arr.length - lines)).join('\n');
  } catch (error) {
    return `Erro lendo log: ${error?.message || error}`;
  }
}

function normalizeRel(relPath) {
  return String(relPath || '.').replace(/\\/g, '/').replace(/^\/+/, '') || '.';
}

function safeResolve(root, relPath) {
  const rel = normalizeRel(relPath);
  const resolved = path.resolve(root, rel);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error('Caminho fora do projeto (bloqueado).');
  }
  return resolved;
}

function readTextFileSegment(root, relPath, startLine = 1, endLine = 240) {
  const filePath = safeResolve(root, relPath);
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split(/\r?\n/);
  const s = clamp(Number(startLine || 1), 1, Math.max(1, lines.length));
  const e = clamp(Number(endLine || s + 239), s, Math.max(s, lines.length));
  const slice = lines.slice(s - 1, e);
  return {
    path: normalizeRel(relPath),
    startLine: s,
    endLine: e,
    totalLines: lines.length,
    text: slice.map((line, idx) => `${String(s + idx).padStart(5, ' ')}| ${line}`).join('\n'),
  };
}

function listTree(root, relDir = '.', maxDepth = 4, maxItems = 2000) {
  const base = safeResolve(root, relDir);
  const out = [];
  const skip = new Set(['node_modules', '.git', '.wwebjs_auth', 'dist']);
  function walk(current, depth) {
    if (out.length >= maxItems) return;
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      if (skip.has(entry.name)) continue;
      const full = path.join(current, entry.name);
      const rel = path.relative(root, full).replace(/\\/g, '/');
      out.push({
        path: rel,
        type: entry.isDirectory() ? 'dir' : 'file',
      });
      if (out.length >= maxItems) return;
      if (entry.isDirectory() && depth < maxDepth) walk(full, depth + 1);
    }
  }
  if (fs.existsSync(base)) walk(base, 1);
  return out;
}

function scanRoutesFromServer(serverFilePath) {
  try {
    const text = fs.readFileSync(serverFilePath, 'utf-8');
    const rx = /app\.(get|post|put|delete|patch)\(\s*['"`]([^'"`]+)['"`]/g;
    const routes = [];
    let match;
    while ((match = rx.exec(text))) {
      routes.push({ method: match[1].toUpperCase(), path: match[2] });
    }
    return routes;
  } catch {
    return [];
  }
}

function scanModules(projectRoot) {
  const modulesDir = path.join(projectRoot, 'modules');
  if (!fs.existsSync(modulesDir)) return [];
  return fs.readdirSync(modulesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const folder = entry.name;
      const candidates = fs.readdirSync(path.join(modulesDir, folder)).filter((name) => /module\.(t|j)sx?$/i.test(name));
      return {
        id: folder,
        path: `modules/${folder}`,
        files: candidates.map((name) => `modules/${folder}/${name}`),
      };
    });
}

function makeMcpResponse(id, result) {
  return { jsonrpc: '2.0', id, result };
}

function makeMcpError(id, code, message, data) {
  return { jsonrpc: '2.0', id, error: { code, message, ...(data ? { data } : {}) } };
}

export function installMcpRuntime(app, options = {}) {
  const projectRoot = options.projectRoot || process.cwd();
  const projectName = options.projectName || path.basename(projectRoot);
  const port = Number(options.port || process.env.PORT || 3001);
  const logDir = options.logDir || path.join(projectRoot, 'logs');
  const logFiles = {
    klaus: options.logMainPath || path.join(logDir, 'klaus.log'),
    support: options.logSupportPath || path.join(logDir, 'support.log'),
    jarvis: options.logJarvisPath || path.join(logDir, 'jarvis.log'),
    mcp: path.join(logDir, 'mcp-runtime.log'),
  };
  ensureDir(logDir);

  const traces = [];
  const supportAudit = [];
  const sessionId = crypto.randomBytes(12).toString('hex');
  const serverFilePath = path.join(projectRoot, 'server.ts');

  const envPath = options.envPath || path.join(projectRoot, '.env');
  const envLocalPath = options.envLocalPath || path.join(projectRoot, '.env.local');
  const dbPath = options.dbPath || path.join(projectRoot, 'bd', 'db.json');

  const getDb = typeof options.getDb === 'function'
    ? options.getDb
    : () => (fs.existsSync(dbPath) ? safeJsonParse(fs.readFileSync(dbPath, 'utf-8'), {}) : {});
  const saveDb = typeof options.saveDb === 'function'
    ? options.saveDb
    : (data) => fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
  const getAppState = typeof options.getAppState === 'function'
    ? options.getAppState
    : () => ({ currentState: null, lastDbUpdate: null, activityLogs: [] });
  const getSupportScanReport = typeof options.getSupportScanReport === 'function'
    ? options.getSupportScanReport
    : null;
  const whatsappControl = options.whatsappControl || {};

  function isAuthEnabled() {
    return String(process.env.MCP_RUNTIME_REQUIRE_AUTH || 'true').toLowerCase() !== 'false';
  }

  function isReadOnly() {
    return String(process.env.MCP_RUNTIME_READONLY || 'false').toLowerCase() === 'true';
  }

  function areCommandsEnabled() {
    return String(process.env.MCP_RUNTIME_ALLOW_COMMANDS || 'true').toLowerCase() !== 'false';
  }

  function isMcpEnabled() {
    return String(process.env.MCP_RUNTIME_ENABLED || 'true').toLowerCase() !== 'false';
  }

  function getConfiguredToken() {
    return String(process.env.MCP_RUNTIME_TOKEN || '').trim();
  }

  function audit(line, meta) {
    const entry = { at: nowIso(), line, meta: meta || null };
    supportAudit.unshift(entry);
    if (supportAudit.length > 300) supportAudit.pop();
    try {
      fs.appendFileSync(logFiles.mcp, `[${entry.at}] ${line}${meta ? ` | ${JSON.stringify(meta).slice(0, 5000)}` : ''}\n`);
    } catch {}
  }

  function pushTrace(trace) {
    traces.unshift(trace);
    if (traces.length > 300) traces.pop();
  }

  function requireWritable(toolName) {
    if (isReadOnly()) throw new Error(`Ferramenta bloqueada em modo read-only: ${toolName}`);
  }

  function checkAuth(req) {
    if (!isMcpEnabled()) return { ok: false, status: 404, message: 'MCP runtime desativado.' };
    if (!isAuthEnabled()) return { ok: true };
    const configuredToken = getConfiguredToken();
    if (!configuredToken) return { ok: false, status: 503, message: 'MCP_RUNTIME_TOKEN não configurado.' };
    const header = String(req.headers.authorization || '');
    const xToken = String(req.headers['x-mcp-token'] || '');
    const queryToken = String(req.query?.token || '');
    const bearer = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    const token = bearer || xToken || queryToken;
    if (token !== configuredToken) {
      return { ok: false, status: 401, message: 'Token MCP inválido.' };
    }
    return { ok: true };
  }

  function parseConfigs(includeSecrets = false) {
    const env = fs.existsSync(envPath) ? parseEnvText(fs.readFileSync(envPath, 'utf-8')) : {};
    const envLocal = fs.existsSync(envLocalPath) ? parseEnvText(fs.readFileSync(envLocalPath, 'utf-8')) : {};
    if (includeSecrets) return { env, envLocal };
    const redactedEnv = Object.fromEntries(Object.entries(env).map(([k, v]) => [k, redactValue(k, v)]));
    const redactedEnvLocal = Object.fromEntries(Object.entries(envLocal).map(([k, v]) => [k, redactValue(k, v)]));
    return { env: redactedEnv, envLocal: redactedEnvLocal };
  }

  function summarizeState() {
    const db = getDb() || {};
    const appState = getAppState() || {};
    return {
      app: {
        name: projectName,
        uptimeSec: Math.round(process.uptime()),
        node: process.version,
        platform: `${process.platform} ${process.arch}`,
        hostname: os.hostname(),
        pid: process.pid,
        cwd: projectRoot,
        port,
      },
      runtime: {
        enabled: isMcpEnabled(),
        authEnabled: isAuthEnabled(),
        readOnly: isReadOnly(),
        commandsEnabled: areCommandsEnabled(),
        transport: 'streamable-http-jsonrpc',
        endpoint: `/mcp`,
      },
      data: {
        dbPath: path.relative(projectRoot, dbPath).replace(/\\/g, '/'),
        clients: Array.isArray(db.clients) ? db.clients.length : 0,
        budgets: Array.isArray(db.budgets) ? db.budgets.length : 0,
        transactions: Array.isArray(db.transactions) ? db.transactions.length : 0,
        agenda: Array.isArray(db.agenda) ? db.agenda.length : 0,
        templates: Array.isArray(db.templates) ? db.templates.length : 0,
        activeProfile: db.activeProfile || null,
      },
      appState: {
        currentState: appState.currentState || null,
        lastDbUpdate: appState.lastDbUpdate || null,
        recentActivity: Array.isArray(appState.activityLogs) ? appState.activityLogs.slice(0, 20) : [],
      },
      filesystem: {
        env: fs.existsSync(envPath),
        envLocal: fs.existsSync(envLocalPath),
        logsDir: path.relative(projectRoot, logDir).replace(/\\/g, '/'),
        modules: scanModules(projectRoot),
      },
    };
  }

  async function executeTool(name, args = {}) {
    switch (name) {
      case 'health.get': {
        const state = summarizeState();
        return { ok: true, status: 'up', time: nowIso(), ...state };
      }
      case 'registry.get': {
        return {
          ok: true,
          project: projectName,
          routes: scanRoutesFromServer(serverFilePath),
          modules: scanModules(projectRoot),
          tools: toolDefinitions.map((tool) => ({ name: tool.name, description: tool.description })),
        };
      }
      case 'state.get': {
        return { ok: true, ...summarizeState() };
      }
      case 'state.reload':
      case 'runtime.reload': {
        if (args?.clearTraces) traces.length = 0;
        return { ok: true, message: 'Estado reavaliado.', ...summarizeState() };
      }
      case 'fs.list': {
        const rel = args.path || '.';
        const maxDepth = clamp(Number(args.maxDepth || 4), 1, 12);
        const items = listTree(projectRoot, rel, maxDepth, 3000);
        return { ok: true, path: normalizeRel(rel), count: items.length, items };
      }
      case 'fs.read': {
        const rel = String(args.path || '');
        if (!rel) throw new Error('path é obrigatório');
        if (typeof args.startLine === 'number' || typeof args.endLine === 'number') {
          return { ok: true, ...readTextFileSegment(projectRoot, rel, args.startLine, args.endLine) };
        }
        const filePath = safeResolve(projectRoot, rel);
        const encoding = String(args.encoding || 'utf-8');
        const content = fs.readFileSync(filePath, encoding);
        return { ok: true, path: normalizeRel(rel), content };
      }
      case 'fs.write': {
        requireWritable(name);
        const rel = String(args.path || '');
        if (!rel) throw new Error('path é obrigatório');
        const filePath = safeResolve(projectRoot, rel);
        ensureDir(path.dirname(filePath));
        fs.writeFileSync(filePath, String(args.content ?? ''));
        audit(`fs.write ${rel}`, { bytes: Buffer.byteLength(String(args.content ?? ''), 'utf-8') });
        return { ok: true, path: normalizeRel(rel), written: true };
      }
      case 'fs.patch': {
        requireWritable(name);
        const rel = String(args.path || '');
        const search = String(args.search ?? '');
        const replace = String(args.replace ?? '');
        const all = !!args.all;
        if (!rel || !search) throw new Error('path e search são obrigatórios');
        const filePath = safeResolve(projectRoot, rel);
        const original = fs.readFileSync(filePath, 'utf-8');
        const next = all ? original.split(search).join(replace) : original.replace(search, replace);
        if (next === original) {
          return { ok: true, changed: false, path: normalizeRel(rel), message: 'Trecho não encontrado.' };
        }
        fs.writeFileSync(filePath, next);
        audit(`fs.patch ${rel}`, { all, searchPreview: search.slice(0, 120) });
        return { ok: true, changed: true, path: normalizeRel(rel) };
      }
      case 'fs.mkdir': {
        requireWritable(name);
        const rel = String(args.path || '');
        if (!rel) throw new Error('path é obrigatório');
        const dirPath = safeResolve(projectRoot, rel);
        fs.mkdirSync(dirPath, { recursive: args.recursive !== false });
        audit(`fs.mkdir ${rel}`);
        return { ok: true, path: normalizeRel(rel), created: true };
      }
      case 'fs.delete': {
        requireWritable(name);
        const rel = String(args.path || '');
        if (!rel) throw new Error('path é obrigatório');
        const targetPath = safeResolve(projectRoot, rel);
        if (!fs.existsSync(targetPath)) return { ok: true, path: normalizeRel(rel), deleted: false, message: 'Arquivo/pasta não existe.' };
        const stat = fs.statSync(targetPath);
        if (stat.isDirectory()) fs.rmSync(targetPath, { recursive: !!args.recursive, force: true });
        else fs.rmSync(targetPath, { force: true });
        audit(`fs.delete ${rel}`, { recursive: !!args.recursive });
        return { ok: true, path: normalizeRel(rel), deleted: true };
      }
      case 'log.read': {
        const target = String(args.target || 'klaus');
        const lines = clamp(Number(args.lines || 120), 1, 2000);
        let filePath;
        if (args.path) filePath = safeResolve(projectRoot, args.path);
        else filePath = logFiles[target] || logFiles.klaus;
        return { ok: true, target, lines, content: readTail(filePath, lines) };
      }
      case 'trace.list': {
        const limit = clamp(Number(args.limit || 50), 1, 200);
        return { ok: true, count: Math.min(limit, traces.length), traces: traces.slice(0, limit) };
      }
      case 'db.read': {
        return { ok: true, path: path.relative(projectRoot, dbPath).replace(/\\/g, '/'), data: getDb() };
      }
      case 'db.write': {
        requireWritable(name);
        if (typeof args.data !== 'object' || !args.data) throw new Error('data deve ser um objeto JSON');
        saveDb(args.data);
        audit('db.write', { keys: Object.keys(args.data).slice(0, 30) });
        return { ok: true, saved: true };
      }
      case 'config.get': {
        return { ok: true, ...parseConfigs(!!args.includeSecrets) };
      }
      case 'config.patch': {
        requireWritable(name);
        const patch = args.patch;
        if (!patch || typeof patch !== 'object') throw new Error('patch deve ser um objeto');
        const target = String(args.target || '.env.local');
        const filePath = target === '.env' ? envPath : envLocalPath;
        const original = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : '';
        const next = patchEnvText(original, patch);
        fs.writeFileSync(filePath, next);
        audit(`config.patch ${target}`, { keys: Object.keys(patch) });
        return { ok: true, target, patchedKeys: Object.keys(patch) };
      }
      case 'cmd.run': {
        requireWritable(name);
        if (!areCommandsEnabled()) throw new Error('Execução de comandos desativada (MCP_RUNTIME_ALLOW_COMMANDS=false).');
        const command = String(args.command || '').trim();
        if (!command) throw new Error('command é obrigatório');
        const cwd = safeResolve(projectRoot, args.cwd || '.');
        const timeoutMs = clamp(Number(args.timeoutMs || 20000), 1000, 120000);
        const isWin = process.platform === 'win32';
        const proc = isWin
          ? spawnSync('cmd.exe', ['/c', command], { cwd, encoding: 'utf-8', timeout: timeoutMs, maxBuffer: 8 * 1024 * 1024 })
          : spawnSync('bash', ['-lc', command], { cwd, encoding: 'utf-8', timeout: timeoutMs, maxBuffer: 8 * 1024 * 1024 });
        const result = {
          ok: true,
          command,
          cwd: path.relative(projectRoot, cwd).replace(/\\/g, '/'),
          code: typeof proc.status === 'number' ? proc.status : null,
          signal: proc.signal || null,
          stdout: String(proc.stdout || '').slice(0, 60000),
          stderr: String(proc.stderr || '').slice(0, 60000),
        };
        audit(`cmd.run ${command}`, { cwd: result.cwd, code: result.code });
        return result;
      }
      case 'simulator.run': {
        const route = String(args.route || '/health');
        const method = String(args.method || 'GET').toUpperCase();
        const url = `http://127.0.0.1:${port}${route.startsWith('/') ? route : `/${route}`}`;
        const init = { method, headers: { 'content-type': 'application/json' } };
        if (method !== 'GET' && method !== 'HEAD') init.body = JSON.stringify(args.body || {});
        const response = await fetch(url, init);
        const text = await response.text();
        let body = null;
        try { body = JSON.parse(text); } catch { body = text; }
        return { ok: true, url, method, status: response.status, body };
      }
      case 'prompts.list': {
        const db = getDb() || {};
        const config = db.config || {};
        const prompts = [
          { id: 'klausPrompt', value: config.klausPrompt || null },
          { id: 'prospectingAlfaPrompt', value: config.prospectingAlfaPrompt || null },
          { id: 'prospectingCustomPrompt', value: config.prospectingCustomPrompt || null },
          { id: 'attendantPrompt', value: config.attendantPrompt || null },
        ];
        return { ok: true, prompts: prompts.map((p) => ({ id: p.id, preview: String(p.value || '').slice(0, 240) })) };
      }
      case 'prompt.get': {
        const id = String(args.id || '');
        if (!id) throw new Error('id é obrigatório');
        const db = getDb() || {};
        const config = db.config || {};
        const map = {
          klausPrompt: config.klausPrompt || null,
          prospectingAlfaPrompt: config.prospectingAlfaPrompt || null,
          prospectingCustomPrompt: config.prospectingCustomPrompt || null,
          attendantPrompt: config.attendantPrompt || null,
        };
        return { ok: true, id, value: Object.prototype.hasOwnProperty.call(map, id) ? map[id] : null };
      }
      case 'support.state': {
        return {
          ok: true,
          active: true,
          auditEntries: supportAudit.length,
          readOnly: isReadOnly(),
          commandsEnabled: areCommandsEnabled(),
        };
      }
      case 'support.audit': {
        const limit = clamp(Number(args.limit || 50), 1, 200);
        return { ok: true, items: supportAudit.slice(0, limit) };
      }
      case 'support.scan': {
        const report = getSupportScanReport ? getSupportScanReport() : 'Support scan indisponível neste build.';
        audit('support.scan');
        return { ok: true, report };
      }
      case 'whatsapp.control': {
        requireWritable(name);
        const action = String(args.action || 'restart');
        if (action === 'start') {
          if (typeof whatsappControl.start !== 'function') throw new Error('Ação start não disponível.');
          return await whatsappControl.start();
        }
        if (action === 'stop') {
          if (typeof whatsappControl.stop !== 'function') throw new Error('Ação stop não disponível.');
          return await whatsappControl.stop();
        }
        if (action === 'restart') {
          if (typeof whatsappControl.restart !== 'function') throw new Error('Ação restart não disponível.');
          return await whatsappControl.restart();
        }
        throw new Error('action inválido; use start, stop ou restart.');
      }
      default:
        throw new Error(`Ferramenta MCP não encontrada: ${name}`);
    }
  }

  const toolDefinitions = [
    {
      name: 'health.get',
      description: 'Lê a saúde atual do app, do runtime MCP e do estado principal do Klaus.',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'registry.get',
      description: 'Lista módulos, rotas HTTP e o catálogo de ferramentas expostas pelo runtime.',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'state.get',
      description: 'Retorna snapshot do estado atual da aplicação, banco, WhatsApp e activity logs.',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'state.reload',
      description: 'Reavalia o estado atual e opcionalmente limpa traces acumulados.',
      inputSchema: { type: 'object', properties: { clearTraces: { type: 'boolean' } } },
    },
    {
      name: 'runtime.reload',
      description: 'Alias para state.reload; útil para clientes que esperam uma ferramenta de reload.',
      inputSchema: { type: 'object', properties: { clearTraces: { type: 'boolean' } } },
    },
    {
      name: 'fs.list',
      description: 'Lista arquivos e pastas do projeto a partir de um caminho relativo.',
      inputSchema: { type: 'object', properties: { path: { type: 'string' }, maxDepth: { type: 'number' } } },
    },
    {
      name: 'fs.read',
      description: 'Lê um arquivo texto inteiro ou por faixa de linhas.',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          encoding: { type: 'string' },
          startLine: { type: 'number' },
          endLine: { type: 'number' },
        },
        required: ['path'],
      },
    },
    {
      name: 'fs.write',
      description: 'Escreve ou sobrescreve um arquivo texto dentro do projeto.',
      inputSchema: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } }, required: ['path', 'content'] },
    },
    {
      name: 'fs.patch',
      description: 'Aplica substituição simples em um arquivo texto.',
      inputSchema: { type: 'object', properties: { path: { type: 'string' }, search: { type: 'string' }, replace: { type: 'string' }, all: { type: 'boolean' } }, required: ['path', 'search', 'replace'] },
    },
    {
      name: 'fs.mkdir',
      description: 'Cria uma pasta dentro do projeto.',
      inputSchema: { type: 'object', properties: { path: { type: 'string' }, recursive: { type: 'boolean' } }, required: ['path'] },
    },
    {
      name: 'fs.delete',
      description: 'Remove arquivo ou pasta do projeto.',
      inputSchema: { type: 'object', properties: { path: { type: 'string' }, recursive: { type: 'boolean' } }, required: ['path'] },
    },
    {
      name: 'log.read',
      description: 'Lê logs do app (klaus, support, jarvis ou mcp).',
      inputSchema: { type: 'object', properties: { target: { type: 'string' }, lines: { type: 'number' }, path: { type: 'string' } } },
    },
    {
      name: 'trace.list',
      description: 'Lista as últimas requisições HTTP e chamadas MCP registradas pelo runtime.',
      inputSchema: { type: 'object', properties: { limit: { type: 'number' } } },
    },
    {
      name: 'db.read',
      description: 'Lê o banco JSON atual do Klaus.',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'db.write',
      description: 'Sobrescreve o banco JSON atual do Klaus.',
      inputSchema: { type: 'object', properties: { data: { type: 'object' } }, required: ['data'] },
    },
    {
      name: 'config.get',
      description: 'Lê .env e .env.local com opção de incluir valores reais.',
      inputSchema: { type: 'object', properties: { includeSecrets: { type: 'boolean' } } },
    },
    {
      name: 'config.patch',
      description: 'Aplica patch simples em .env ou .env.local.',
      inputSchema: { type: 'object', properties: { patch: { type: 'object' }, target: { type: 'string' } }, required: ['patch'] },
    },
    {
      name: 'cmd.run',
      description: 'Executa comando shell dentro do projeto.',
      inputSchema: { type: 'object', properties: { command: { type: 'string' }, cwd: { type: 'string' }, timeoutMs: { type: 'number' } }, required: ['command'] },
    },
    {
      name: 'simulator.run',
      description: 'Executa uma chamada HTTP local ao próprio app para smoke tests.',
      inputSchema: { type: 'object', properties: { route: { type: 'string' }, method: { type: 'string' }, body: { type: 'object' } } },
    },
    {
      name: 'prompts.list',
      description: 'Lista os prompts principais salvos no banco de configuração.',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'prompt.get',
      description: 'Lê um prompt específico salvo no banco.',
      inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    },
    {
      name: 'support.state',
      description: 'Retorna o estado do modo suporte MCP.',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'support.audit',
      description: 'Lista o histórico de auditoria de mutações feitas via MCP.',
      inputSchema: { type: 'object', properties: { limit: { type: 'number' } } },
    },
    {
      name: 'support.scan',
      description: 'Executa o relatório de scan interno do Klaus Support IA.',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'whatsapp.control',
      description: 'Controla o cliente WhatsApp interno (start, stop ou restart).',
      inputSchema: { type: 'object', properties: { action: { type: 'string', enum: ['start', 'stop', 'restart'] } }, required: ['action'] },
    },
  ];

  app.use((req, res, next) => {
    const startedAt = Date.now();
    res.on('finish', () => {
      pushTrace({
        at: nowIso(),
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        durationMs: Date.now() - startedAt,
        kind: req.path === '/mcp' ? 'mcp' : 'http',
      });
    });
    next();
  });

  app.get('/mcp', (req, res) => {
    const auth = checkAuth(req);
    if (!auth.ok) return res.status(auth.status).json({ ok: false, error: auth.message });
    res.setHeader('Mcp-Session-Id', sessionId);
    res.json({
      ok: true,
      server: 'klaus-os-mcp-runtime',
      version: '1.0.0',
      transport: 'streamable-http-jsonrpc',
      endpoint: '/mcp',
      auth: isAuthEnabled() ? 'bearer-or-x-mcp-token' : 'disabled',
      tools: toolDefinitions.map((tool) => tool.name),
    });
  });

  app.post('/mcp', async (req, res) => {
    const auth = checkAuth(req);
    if (!auth.ok) return res.status(auth.status).json({ ok: false, error: auth.message });
    res.setHeader('Mcp-Session-Id', sessionId);

    const handleRpc = async (rpc) => {
      const id = Object.prototype.hasOwnProperty.call(rpc || {}, 'id') ? rpc.id : null;
      const method = String(rpc?.method || '');
      const params = rpc?.params || {};

      try {
        if (method === 'initialize') {
          audit('rpc.initialize');
          return makeMcpResponse(id, {
            protocolVersion: params?.protocolVersion || '2025-03-26',
            capabilities: {
              tools: { listChanged: false },
            },
            serverInfo: {
              name: 'klaus-os-mcp-runtime',
              version: '1.0.0',
            },
            instructions: 'Use as ferramentas para ler, editar, configurar e inspecionar o Klaus OS em runtime. Proteja o token MCP e não exponha este endpoint sem autenticação.',
          });
        }

        if (method === 'notifications/initialized') {
          audit('rpc.notifications/initialized');
          return null;
        }

        if (method === 'ping') {
          return makeMcpResponse(id, {});
        }

        if (method === 'tools/list') {
          return makeMcpResponse(id, { tools: toolDefinitions });
        }

        if (method === 'tools/call') {
          const toolName = String(params?.name || '');
          const args = params?.arguments || {};
          const startedAt = Date.now();
          try {
            const result = await executeTool(toolName, args);
            audit(`tool ${toolName}`, { args });
            return makeMcpResponse(id, {
              content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
              structuredContent: result,
              isError: false,
              _meta: { durationMs: Date.now() - startedAt },
            });
          } catch (error) {
            const message = error?.message || String(error);
            audit(`tool_error ${toolName}`, { args, message });
            return makeMcpResponse(id, {
              content: [{ type: 'text', text: JSON.stringify({ ok: false, error: message }, null, 2) }],
              structuredContent: { ok: false, error: message },
              isError: true,
              _meta: { durationMs: Date.now() - startedAt },
            });
          }
        }

        return makeMcpError(id, -32601, `Método JSON-RPC/MCP não suportado: ${method}`);
      } catch (error) {
        return makeMcpError(id, -32000, error?.message || String(error));
      }
    };

    const body = req.body;
    if (Array.isArray(body)) {
      const results = [];
      for (const item of body) {
        const result = await handleRpc(item);
        if (result) results.push(result);
      }
      return res.json(results);
    }

    const result = await handleRpc(body || {});
    if (result === null) return res.status(204).end();
    return res.json(result);
  });

  audit('runtime.online', { endpoint: '/mcp', authEnabled: isAuthEnabled(), readOnly: isReadOnly(), commandsEnabled: areCommandsEnabled() });

  return {
    endpoint: '/mcp',
    sessionId,
    getTraces: () => traces.slice(),
    getAudit: () => supportAudit.slice(),
  };
}
