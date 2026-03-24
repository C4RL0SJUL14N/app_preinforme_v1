import { config } from './config.js';

const cacheStore = new Map();

export function getCache(key) {
  const entry = cacheStore.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cacheStore.delete(key);
    return null;
  }
  return entry.value;
}

export function setCache(key, value, ttlMs = config.cacheTtlMs) {
  cacheStore.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export function clearCache(prefix = '') {
  for (const key of cacheStore.keys()) {
    if (!prefix || key.startsWith(prefix)) cacheStore.delete(key);
  }
}
