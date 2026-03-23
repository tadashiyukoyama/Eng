export function getApiBaseUrl() {
  const envBase = (typeof import.meta !== 'undefined' && (import.meta as any)?.env?.VITE_API_BASE_URL)
    ? String((import.meta as any).env.VITE_API_BASE_URL).trim()
    : '';

  if (envBase) return envBase.replace(/\/$/, '');

  if (typeof window === 'undefined') {
    return 'http://localhost:3001';
  }

  const { hostname, origin } = window.location;
  const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1';
  return isLocalHost ? 'http://localhost:3001' : origin.replace(/\/$/, '');
}

export function apiUrl(route: string) {
  const normalized = route.startsWith('/') ? route : `/${route}`;
  return `${getApiBaseUrl()}${normalized}`;
}
