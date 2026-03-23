import React, { useMemo, useRef, useState } from 'react';
import { getApiBaseUrl } from '../../services/runtimeBase';

type ChatMsg = {
  role: 'user' | 'assistant';
  content: string;
  ts: number;
};

type ConfirmRequest = {
  actionId: string;
  token: string;
  summary: string;
};

type SupportResponse = {
  text: string;
  confirm?: ConfirmRequest;
};

const API_BASE = getApiBaseUrl();

function nowTs() {
  return Date.now();
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = String(reader.result || '');
      // res: data:<mime>;base64,<...>
      const idx = res.indexOf('base64,');
      if (idx >= 0) return resolve(res.slice(idx + 7));
      // fallback (rare)
      const comma = res.indexOf(',');
      resolve(comma >= 0 ? res.slice(comma + 1) : res);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

const SupportAIModule: React.FC = () => {
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      role: 'assistant',
      content:
        'Sou o *Suporte IA* do Klaus 3.0. Eu posso: diagnosticar, ler arquivos do projeto, buscar erros, propor patches e aplicar mudanças (com confirmação quando for algo destrutivo).\n\nDiga o que você quer fazer agora.',
      ts: nowTs(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);

  const sessionId = useMemo(() => `panel:support`, []);
  const listRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    setTimeout(() => {
      const el = listRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    }, 50);
  };

  const send = async (payload?: { confirmAction?: ConfirmRequest }) => {
    const text = (payload?.confirmAction ? `CONFIRM ${payload.confirmAction.actionId} ${payload.confirmAction.token}` : input).trim();
    if (!text) return;

    const userMsg: ChatMsg = { role: 'user', content: text, ts: nowTs() };
    setMessages((m) => [...m, userMsg]);
    setInput('');
    setIsSending(true);
    setConfirm(null);

    try {
      const imgB64 = imageFile ? await fileToBase64(imageFile) : undefined;
      const body: any = {
        sessionId,
        message: text,
      };
      if (imgB64) body.imageBase64 = imgB64;

      const r = await fetch(`${API_BASE}/api/support/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data: SupportResponse = await r.json();

      const aiMsg: ChatMsg = { role: 'assistant', content: data.text || 'Ok.', ts: nowTs() };
      setMessages((m) => [...m, aiMsg]);

      if (data.confirm) setConfirm(data.confirm);

      setImageFile(null);
      scrollToBottom();
    } catch (e: any) {
      setMessages((m) => [
        ...m,
        { role: 'assistant', content: `⚠️ Falha ao falar com o Suporte IA: ${e?.message || e}`, ts: nowTs() },
      ]);
    } finally {
      setIsSending(false);
      scrollToBottom();
    }
  };

  const clearSupportMemory = async () => {
    const ok = window.confirm('Apagar memória do Suporte IA (30 dias) desta sessão?');
    if (!ok) return;
    try {
      await fetch(`${API_BASE}/api/support/clear-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
      setMessages((m) => [
        ...m,
        { role: 'assistant', content: '✅ Memória do Suporte IA apagada para esta sessão.', ts: nowTs() },
      ]);
    } catch (e: any) {
      setMessages((m) => [
        ...m,
        { role: 'assistant', content: `⚠️ Não consegui apagar a memória: ${e?.message || e}`, ts: nowTs() },
      ]);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black tracking-tight">Suporte IA</h2>
          <p className="text-slate-400 mt-2 text-sm">
            Agente de diagnóstico e desenvolvimento. Ele consegue ler/alterar arquivos do projeto, consultar logs e mexer no banco —
            sempre com confirmação para ações destrutivas.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => {
              setInput('/scan');
              // envia já
              setTimeout(() => send(), 0);
            }}
            className="px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest bg-slate-900/60 border border-slate-800 hover:bg-slate-900"
          >
            Scan agora
          </button>
          <button
            onClick={clearSupportMemory}
            className="px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest bg-slate-900/60 border border-slate-800 hover:bg-slate-900"
          >
            Limpar memória (30d)
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-slate-950 border border-slate-800/40 rounded-3xl overflow-hidden">
          <div className="p-4 border-b border-slate-800/40 flex items-center justify-between">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Chat do Suporte IA</div>
            <div className="text-[10px] font-mono text-slate-600">session: {sessionId}</div>
          </div>

          <div ref={listRef} className="h-[520px] overflow-y-auto p-6 space-y-4">
            {messages.map((m, idx) => (
              <div key={idx} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[90%] rounded-3xl px-5 py-4 border text-sm leading-relaxed whitespace-pre-wrap ${
                    m.role === 'user'
                      ? 'bg-emerald-600/10 border-emerald-500/20 text-emerald-200'
                      : 'bg-slate-900/40 border-slate-800/40 text-slate-100'
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
          </div>

          {confirm && (
            <div className="p-6 border-t border-slate-800/40 bg-slate-950">
              <div className="rounded-3xl border border-amber-500/30 bg-amber-500/10 p-5">
                <div className="text-[10px] font-black uppercase tracking-widest text-amber-300">Confirmação necessária</div>
                <p className="text-sm text-amber-100 mt-2 whitespace-pre-wrap">{confirm.summary}</p>
                <div className="mt-4 flex gap-3">
                  <button
                    className="px-4 py-2 rounded-2xl bg-amber-500/20 border border-amber-400/30 text-amber-100 text-[10px] font-black uppercase tracking-widest hover:bg-amber-500/30"
                    onClick={() => send({ confirmAction: confirm })}
                    disabled={isSending}
                  >
                    Confirmar
                  </button>
                  <button
                    className="px-4 py-2 rounded-2xl bg-slate-900/60 border border-slate-800 text-slate-200 text-[10px] font-black uppercase tracking-widest hover:bg-slate-900"
                    onClick={() => setConfirm(null)}
                    disabled={isSending}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="p-6 border-t border-slate-800/40 bg-slate-950">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                  className="text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-2xl file:border-0 file:bg-slate-900/60 file:text-slate-200 file:text-[10px] file:font-black file:uppercase file:tracking-widest hover:file:bg-slate-900"
                />
                {imageFile && <span className="text-xs text-slate-500 truncate">📷 {imageFile.name}</span>}
              </div>

              <div className="flex gap-3">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Descreva o problema. Ex: 'ache o bug do orçamento e corrija', 'adicione uma rota nova', 'otimize o WhatsApp', etc."
                  className="flex-1 min-h-[56px] max-h-[140px] rounded-3xl bg-slate-900/30 border border-slate-800/40 px-5 py-4 text-sm outline-none focus:border-emerald-500/30"
                />
                <button
                  onClick={() => send()}
                  disabled={isSending}
                  className="px-6 py-4 rounded-3xl bg-emerald-600/20 border border-emerald-500/20 text-emerald-200 text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600/30 disabled:opacity-60"
                >
                  {isSending ? 'Enviando…' : 'Enviar'}
                </button>
              </div>

              <p className="text-[11px] text-slate-500">
                Dica: peça coisas objetivas ("procure por X", "abra o arquivo Y e explique", "faça patch Z"). Mudanças destrutivas exigem confirmação.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-slate-950 border border-slate-800/40 rounded-3xl p-6">
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Capacidades do Suporte IA</div>
          <ul className="mt-4 space-y-3 text-sm text-slate-300">
            <li>• Busca no código e leitura por trechos (com linhas).</li>
            <li>• Diagnóstico e recomendação de correções.</li>
            <li>• Patches e substituições em arquivos (sem truques).</li>
            <li>• Leitura/limpeza de logs do sistema.</li>
            <li>• Operações no banco local (com confirmação).</li>
            <li>• Execução de comandos (CMD/Terminal) no contexto do projeto (com confirmação).</li>
            <li>• Memória persistente 30 dias (focada em suporte).</li>
            <li>• Multimodal: você pode mandar print/erro (imagem).</li>
          </ul>

          <div className="mt-6 rounded-3xl bg-slate-900/30 border border-slate-800/40 p-5">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Boas práticas</div>
            <p className="text-sm text-slate-300 mt-2">
              Use o Suporte IA para manter o Klaus estável. Quando pedir alterações de código, peça também o "porquê" e o "impacto".
              A IA pode aplicar mudanças — mas ela sempre deve explicar e pedir confirmação se houver risco.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SupportAIModule;
