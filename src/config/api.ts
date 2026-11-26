const DEFAULT_API_URL = 'https://animefit-2.onrender.com';
const DEFAULT_WS_URL = 'wss://animefit-2.onrender.com';

function normalizeBaseUrl(raw: string | undefined, fallback: string): string {
  const trimmed = (raw || '').trim().replace(/\/+$/, '');
  return trimmed || fallback;
}

function deriveWsUrlFromApiUrl(apiUrl: string): string {
  try {
    const parsed = new URL(apiUrl);
    const wsProtocol = parsed.protocol === 'http:' ? 'ws:' : 'wss:';
    return `${wsProtocol}//${parsed.host}${parsed.pathname}`.replace(/\/+$/, '');
  } catch {
    return DEFAULT_WS_URL;
  }
}

export const API_BASE_URL = normalizeBaseUrl(
  import.meta.env.VITE_API_URL,
  DEFAULT_API_URL
);

export const WS_BASE_URL = normalizeBaseUrl(
  import.meta.env.VITE_WS_URL,
  import.meta.env.VITE_API_URL
    ? deriveWsUrlFromApiUrl(API_BASE_URL)
    : DEFAULT_WS_URL
);

export function apiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}

export function wsUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${WS_BASE_URL}${normalizedPath}`;
}
