import crypto from 'node:crypto';

export function nowIso() {
  return new Date().toISOString();
}

export function normalizeString(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

export function normalizeComparableText(value) {
  return normalizeString(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

export function includesComparableText(items, expected) {
  const normalizedExpected = normalizeComparableText(expected);
  return ensureArray(items).some((item) => normalizeComparableText(item) === normalizedExpected);
}

export function normalizeCell(value) {
  return normalizeString(value);
}

export function normalizeRichText(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const textOnly = raw
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|li|ul|ol|h[1-6])>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
  return textOnly ? raw : '';
}

export function normalizeBooleanString(value) {
  const normalized = normalizeString(value).toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'si' || normalized === 'yes' ? 'TRUE' : 'FALSE';
}

export function normalizeId(value, prefix = 'id') {
  const base = normalizeString(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  return base || `${prefix}-${crypto.randomUUID()}`;
}

export function hashPassword(password, salt) {
  return crypto.createHash('sha256').update(`${normalizeString(password)}::${salt}`).digest('hex');
}

export function createToken(payload) {
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = crypto.createHmac('sha256', process.env.APP_PASSWORD_SALT || 'preinformes-salt').update(body).digest('base64url');
  return `${body}.${signature}`;
}

export function parseToken(token) {
  try {
    const [body, signature] = normalizeString(token).split('.');
    const expected = crypto.createHmac('sha256', process.env.APP_PASSWORD_SALT || 'preinformes-salt').update(body).digest('base64url');
    if (!body || !signature || signature !== expected) return null;
    return JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

export function jsonResponse(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

export async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (chunks.length === 0) return {};
  const text = Buffer.concat(chunks).toString('utf8');
  return text ? JSON.parse(text) : {};
}

export function getBearerToken(req) {
  const authHeader = normalizeString(req.headers.authorization);
  if (!authHeader.toLowerCase().startsWith('bearer ')) return '';
  return authHeader.slice(7).trim();
}

export function parseJsonSafe(value, fallback) {
  try {
    return JSON.parse(normalizeString(value) || 'null') ?? fallback;
  } catch {
    return fallback;
  }
}

export function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

export function dedupeBy(items, keySelector) {
  const seen = new Set();
  return items.filter((item) => {
    const key = keySelector(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function toCsv(rows) {
  if (!rows.length) {
    return '';
  }
  const headers = Object.keys(rows[0]);
  const escapeValue = (value) => {
    const text = normalizeString(value);
    if (/[",\n]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };
  return [headers.join(','), ...rows.map((row) => headers.map((header) => escapeValue(row[header])).join(','))].join('\n');
}
