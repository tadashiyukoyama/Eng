import { apiUrl } from './runtimeBase';

// Core Service (OpenAI Responses) - chamado pelo painel
// Mantém o nome do arquivo para evitar refator grande.

let lastError: string | null = null;

export const askKlaus = async (
  moduleName: string,
  prompt: string,
  systemInstruction: string,
  onAction?: (action: string, args: any) => void,
) => {
  try {
    const res = await fetch(apiUrl('/api/ai/dispatch'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel: 'panel',
        from: 'panel:master',
        module: moduleName,
        text: `${systemInstruction}\n\n${prompt}`,
      }),
    });

    if (!res.ok) {
      const t = await res.text();
      lastError = t;
      return `⚠️ Erro no Core: ${t}`;
    }

    const data = await res.json();
    // As ações já são executadas no servidor e persistidas no db.json
    // O painel vai receber atualização via polling (lastDbUpdate).
    if (Array.isArray(data?.actions) && onAction) {
      data.actions.forEach((a: any) => onAction(a.name, a.args));
    }

    return data?.text || 'Ok.';
  } catch (e: any) {
    lastError = e?.message || String(e);
    return `⚠️ Falha ao chamar o Core local: ${lastError}`;
  }
};

export const resetKlausMemory = async () => {
  try {
    await fetch(apiUrl('/api/system/clear-sessions'), { method: 'POST' });
  } catch {
    // silencioso
  }
};
