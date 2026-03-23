const state = {
  plans: [],
  settings: null,
  me: null,
};

async function api(route, options = {}) {
  const res = await fetch(route, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || 'Erro na operação.');
  return data;
}

function money(value) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function setNotice(el, message, type = '') {
  if (!el) return;
  el.className = `notice ${type}`.trim();
  el.textContent = message || '';
}

function qs(selector, root = document) {
  return root.querySelector(selector);
}

function qsa(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}

async function loadSession() {
  try {
    const data = await api('/api/site/auth/me');
    state.me = data.user || null;
  } catch {
    state.me = null;
  }
  reflectSession();
}

function reflectSession() {
  qsa('[data-auth-state]').forEach((el) => {
    const mode = el.getAttribute('data-auth-state');
    if (mode === 'logged-in') el.style.display = state.me ? '' : 'none';
    if (mode === 'logged-out') el.style.display = state.me ? 'none' : '';
  });
  qsa('[data-user-name]').forEach((el) => { el.textContent = state.me?.name || 'Cliente'; });
  qsa('[data-user-plan]').forEach((el) => { el.textContent = state.me?.planId || 'Sem plano'; });
}

async function loadPlans() {
  try {
    const data = await api('/api/site/plans');
    state.plans = data.plans || [];
    state.settings = data.settings || {};
    renderPlans();
  } catch (err) {
    console.error(err);
  }
}

function renderPlans() {
  const wraps = qsa('[data-plans]');
  wraps.forEach((wrap) => {
    wrap.innerHTML = '';
    state.plans.forEach((plan, index) => {
      const article = document.createElement('article');
      article.className = `pricing-card ${index === 1 ? 'featured' : ''}`;
      article.innerHTML = `
        <div class="badge">${index === 1 ? 'Mais vendido' : 'Plano'}</div>
        <h3>${plan.name}</h3>
        <p>${plan.description}</p>
        <div class="price">${money(plan.price)} <small>/ implantação</small></div>
        <ul class="list-clean">
          ${(plan.features || []).map((f) => `<li>${f}</li>`).join('')}
        </ul>
        <div style="display:flex; gap:12px; flex-wrap:wrap; margin-top:20px;">
          <a class="btn btn-primary" href="${state.settings?.whatsappCta || '#'}" target="_blank" rel="noreferrer">Falar com o Klaus</a>
          <button class="btn btn-secondary" data-buy-plan="${plan.id}">Comprar agora</button>
        </div>
      `;
      wrap.appendChild(article);
    });
  });

  qsa('[data-buy-plan]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const planId = btn.getAttribute('data-buy-plan');
      if (!state.me) {
        window.location.href = `/cadastro?plan=${encodeURIComponent(planId)}`;
        return;
      }
      try {
        await api('/api/site/orders/checkout', {
          method: 'POST',
          body: JSON.stringify({ planId }),
        });
        window.location.href = '/portal';
      } catch (err) {
        alert(err.message || 'Não foi possível concluir a compra.');
      }
    });
  });
}

function bindLeadForm() {
  const form = qs('[data-lead-form]');
  if (!form) return;
  const notice = qs('[data-lead-notice]');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(form).entries());
    try {
      await api('/api/site/leads', { method: 'POST', body: JSON.stringify(payload) });
      setNotice(notice, 'Pedido recebido. O Klaus vai falar com você em seguida.', 'success');
      form.reset();
    } catch (err) {
      setNotice(notice, err.message || 'Não foi possível enviar agora.', 'error');
    }
  });
}

function bindRegister() {
  const form = qs('[data-register-form]');
  if (!form) return;
  const notice = qs('[data-register-notice]');
  const params = new URLSearchParams(window.location.search);
  const planHint = params.get('plan');
  if (planHint) {
    const hidden = qs('input[name="planId"]', form);
    if (hidden) hidden.value = planHint;
  }
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(form).entries());
    try {
      await api('/api/site/auth/register', { method: 'POST', body: JSON.stringify(payload) });
      await loadSession();
      if (payload.planId) {
        await api('/api/site/orders/checkout', { method: 'POST', body: JSON.stringify({ planId: payload.planId }) });
      }
      window.location.href = '/portal';
    } catch (err) {
      setNotice(notice, err.message || 'Não foi possível criar sua conta.', 'error');
    }
  });
}

function bindLogin() {
  const form = qs('[data-login-form]');
  if (!form) return;
  const notice = qs('[data-login-notice]');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(form).entries());
    try {
      await api('/api/site/auth/login', { method: 'POST', body: JSON.stringify(payload) });
      await loadSession();
      window.location.href = '/portal';
    } catch (err) {
      setNotice(notice, err.message || 'Login inválido.', 'error');
    }
  });
}

function bindLogout() {
  qsa('[data-logout]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await api('/api/site/auth/logout', { method: 'POST' }).catch(() => null);
      state.me = null;
      reflectSession();
      window.location.href = '/';
    });
  });
}

async function loadPortal() {
  const wrap = qs('[data-portal-root]');
  if (!wrap) return;
  if (!state.me) {
    window.location.href = '/login';
    return;
  }
  try {
    const data = await api('/api/site/portal/data');
    const user = data.user;
    const orders = data.orders || [];
    const plan = data.plan;
    wrap.innerHTML = `
      <div class="portal-card">
        <div class="badge">Portal do cliente</div>
        <h3>Olá, ${user.name}.</h3>
        <p>Seu acesso foi liberado automaticamente após a compra local/demo. Esta área já está pronta para evoluir para assinatura real com webhook financeiro no futuro.</p>
        <div class="portal-stats" style="margin-top:20px;">
          <div class="portal-stat"><strong>${user.accessGranted ? 'Ativo' : 'Pendente'}</strong><span class="small">Acesso</span></div>
          <div class="portal-stat"><strong>${plan ? plan.name : 'Sem plano'}</strong><span class="small">Plano atual</span></div>
          <div class="portal-stat"><strong>${orders.length}</strong><span class="small">Pedidos</span></div>
        </div>
      </div>
      <div class="portal-card" style="margin-top:18px;">
        <h3>Dados da conta</h3>
        <p><strong>E-mail:</strong> ${user.email}</p>
        <p><strong>Telefone:</strong> ${user.phone || 'Não informado'}</p>
        <p><strong>Empresa:</strong> ${user.company || 'Não informada'}</p>
        <p><strong>Criado em:</strong> ${new Date(user.createdAt).toLocaleString('pt-BR')}</p>
      </div>
      <div class="portal-card" style="margin-top:18px;">
        <h3>Pedidos</h3>
        ${orders.length ? orders.map((o) => `<div class="notice" style="margin-bottom:12px;"><strong>${o.planName}</strong><br>Status: ${o.status}<br>Valor: ${money(o.amount)}<br>Data: ${new Date(o.createdAt).toLocaleString('pt-BR')}</div>`).join('') : '<p class="small">Nenhum pedido ainda.</p>'}
      </div>
    `;
  } catch (err) {
    wrap.innerHTML = `<div class="notice error">${err.message || 'Não foi possível carregar o portal.'}</div>`;
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadSession();
  await loadPlans();
  bindLeadForm();
  bindRegister();
  bindLogin();
  bindLogout();
  await loadPortal();
});
