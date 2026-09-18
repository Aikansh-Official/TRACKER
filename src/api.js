const API_URL = import.meta.env.VITE_API_URL || '/api';

const pendingReads = new Map();
const responseCache = new Map();
let generation = 0;
const CACHE_TTL = 20000;

export function clearApiCache() {
  generation++;
  responseCache.clear();
  pendingReads.clear();
}

// Short-lived, bounded memory only: never persist private responses to disk.
export function api(path, options = {}) {
  if ((options.method || 'GET') !== 'GET') {
    clearApiCache();
    return request(path, options).finally(clearApiCache);
  }
  const key = `${options.token || ''}:${localDateKey()}:${path}`;
  const cacheable = options.token && options.cache !== false;
  const cached = responseCache.get(key);
  if (cacheable && cached?.expires > Date.now()) return Promise.resolve(structuredClone(cached.value));
  responseCache.delete(key);
  if (pendingReads.has(key)) return pendingReads.get(key);
  const started = generation;
  const promise = request(path, options).then(value => {
    if (cacheable && started === generation) {
      if (responseCache.size >= 80) responseCache.delete(responseCache.keys().next().value);
      responseCache.set(key, { value: structuredClone(value), expires: Date.now() + CACHE_TTL });
    }
    return value;
  }).finally(() => { if (pendingReads.get(key) === promise) pendingReads.delete(key); });
  pendingReads.set(key, promise);
  return promise;
}

async function request(path, { token, method = 'GET', body } = {}) {
  let response;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);
  try {
    response = await fetch(`${API_URL}${path}`, { signal: controller.signal, method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  } catch {
    throw new Error(controller.signal.aborted ? 'The server is taking longer than expected. Check your connection and try again.' : 'Cannot reach TRACKER. Check your internet connection and try again.');
  } finally {
    clearTimeout(timeout);
  }
  const payload = response.status === 204 ? null : await response.json().catch(() => null);
  if (response.ok && response.status !== 204 && payload === null) throw new Error('The server returned an unexpected response. Please try again shortly.');
  if (!response.ok) {
    if (response.status === 401 && token) {
      clearApiCache();
      window.dispatchEvent(new CustomEvent('tracker:session-expired', { detail: payload?.message }));
    }
    const error = new Error(payload?.message || 'Could not save your changes.');
    error.status = response.status;
    throw error;
  }
  return payload;
}

export const localDateKey = (date = new Date()) => {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 10);
};
