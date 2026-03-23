import { getApiBaseUrl } from './runtimeBase';

const BASE_URL = getApiBaseUrl();

export async function askCore(text: string) {
  const res = await fetch(`${BASE_URL}/api/ai/dispatch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ channel: 'panel', from: 'panel:master', text })
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data?.text || '';
}
