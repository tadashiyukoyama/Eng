import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = Number(process.env.SITE_PORT || 8080);
const DB_PATH = path.join(__dirname, 'data', 'site-db.json');
const SESSION_COOKIE = 'klaus_site_session';

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use((req, _res, next) => {
  const raw = String(req.headers?.cookie || '');
  const parsed = Object.fromEntries(
    raw
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const idx = part.indexOf('=');
        if (idx === -1) return [part, ''];
        return [part.slice(0, idx), decodeURIComponent(part.slice(idx + 1))];
      })
  );
  req.cookies = parsed;
  next();
});
app.use('/assets', express.static(path.join(__dirname, 'assets')));

function readDb() {
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  } catch {
    return { users: [], orders: [], leads: [], settings: {}, plans: [] };
  }
}

function writeDb(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
}

function safeId(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeEmail(email = '') {
  return String(email).trim().toLowerCase();
}

function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    company: user.company,
    role: user.role,
    planId: user.planId,
    accessGranted: !!user.accessGranted,
    createdAt: user.createdAt,
  };
}

function getUserFromRequest(req) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) return null;
  const db = readDb();
  return db.users.find((u) => u.sessionToken === token) || null;
}

function requireAuth(req, res, next) {
  const user = getUserFromRequest(req);
  if (!user) return res.status(401).json({ ok: false, error: 'Não autenticado.' });
  req.user = user;
  next();
}

app.get('/api/site/health', (_req, res) => {
  res.json({ ok: true, site: 'Klaus Public Site', port: PORT, ts: Date.now() });
});

app.get('/api/site/plans', (_req, res) => {
  const db = readDb();
  res.json({ ok: true, plans: db.plans || [], settings: db.settings || {} });
});

app.post('/api/site/leads', (req, res) => {
  const db = readDb();
  const lead = {
    id: safeId('lead'),
    name: String(req.body?.name || '').trim(),
    email: normalizeEmail(req.body?.email || ''),
    phone: String(req.body?.phone || '').trim(),
    company: String(req.body?.company || '').trim(),
    interest: String(req.body?.interest || '').trim(),
    message: String(req.body?.message || '').trim(),
    createdAt: new Date().toISOString(),
    source: 'site',
  };
  db.leads = Array.isArray(db.leads) ? db.leads : [];
  db.leads.unshift(lead);
  writeDb(db);
  res.json({ ok: true, lead });
});

app.post('/api/site/auth/register', (req, res) => {
  const db = readDb();
  db.users = Array.isArray(db.users) ? db.users : [];
  const email = normalizeEmail(req.body?.email || '');
  if (!email) return res.status(400).json({ ok: false, error: 'E-mail obrigatório.' });
  if (db.users.some((u) => normalizeEmail(u.email) === email)) {
    return res.status(409).json({ ok: false, error: 'Já existe uma conta com esse e-mail.' });
  }
  const user = {
    id: safeId('user'),
    name: String(req.body?.name || '').trim(),
    email,
    phone: String(req.body?.phone || '').trim(),
    company: String(req.body?.company || '').trim(),
    password: String(req.body?.password || ''),
    role: 'customer',
    planId: null,
    accessGranted: false,
    createdAt: new Date().toISOString(),
    sessionToken: safeId('sess'),
  };
  db.users.push(user);
  writeDb(db);
  res.cookie(SESSION_COOKIE, user.sessionToken, { httpOnly: false, sameSite: 'lax' });
  res.json({ ok: true, user: publicUser(user) });
});

app.post('/api/site/auth/login', (req, res) => {
  const db = readDb();
  const email = normalizeEmail(req.body?.email || '');
  const password = String(req.body?.password || '');
  const user = (db.users || []).find((u) => normalizeEmail(u.email) === email && String(u.password || '') === password);
  if (!user) return res.status(401).json({ ok: false, error: 'Credenciais inválidas.' });
  user.sessionToken = safeId('sess');
  writeDb(db);
  res.cookie(SESSION_COOKIE, user.sessionToken, { httpOnly: false, sameSite: 'lax' });
  res.json({ ok: true, user: publicUser(user) });
});

app.post('/api/site/auth/logout', (req, res) => {
  const db = readDb();
  const token = req.cookies?.[SESSION_COOKIE];
  const user = (db.users || []).find((u) => u.sessionToken === token);
  if (user) user.sessionToken = null;
  writeDb(db);
  res.clearCookie(SESSION_COOKIE);
  res.json({ ok: true });
});

app.get('/api/site/auth/me', (req, res) => {
  const user = getUserFromRequest(req);
  res.json({ ok: true, user: publicUser(user) });
});

app.post('/api/site/orders/checkout', requireAuth, (req, res) => {
  const db = readDb();
  db.orders = Array.isArray(db.orders) ? db.orders : [];
  db.users = Array.isArray(db.users) ? db.users : [];
  const planId = String(req.body?.planId || '').trim();
  const plan = (db.plans || []).find((p) => String(p.id) === planId);
  if (!plan) return res.status(404).json({ ok: false, error: 'Plano não encontrado.' });

  const order = {
    id: safeId('order'),
    userId: req.user.id,
    planId: plan.id,
    planName: plan.name,
    amount: Number(plan.price || 0),
    status: 'paid_local_demo',
    createdAt: new Date().toISOString(),
    paymentMethod: 'local_demo',
  };
  db.orders.unshift(order);

  const user = db.users.find((u) => u.id === req.user.id);
  if (user) {
    user.planId = plan.id;
    user.accessGranted = true;
  }

  writeDb(db);
  res.json({ ok: true, order, user: publicUser(user) });
});

app.get('/api/site/portal/data', requireAuth, (req, res) => {
  const db = readDb();
  const orders = (db.orders || []).filter((o) => o.userId === req.user.id);
  const plan = (db.plans || []).find((p) => p.id === req.user.planId) || null;
  res.json({ ok: true, user: publicUser(req.user), orders, plan });
});

app.get('/api/site/admin/export', (_req, res) => {
  const db = readDb();
  res.json({ ok: true, data: db });
});

const staticPages = [
  'index.html',
  'login.html',
  'cadastro.html',
  'portal.html',
  'termos.html',
  'privacidade.html',
  'cookies.html',
  'contato.html',
  'sobre.html',
  'casos.html',
  'oferta-starter.html',
  'oferta-premium.html',
  'exclusao-dados.html'
];

for (const file of staticPages) {
  const route = file === 'index.html' ? '/' : `/${file.replace('.html', '')}`;
  app.get(route, (_req, res) => res.sendFile(path.join(__dirname, file)));
}

app.use((_req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Klaus Public Site rodando em http://localhost:${PORT}`);
});
