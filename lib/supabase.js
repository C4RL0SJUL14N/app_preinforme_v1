import { config, validateConfig } from './config.js';

function buildUrl(tableName, query = {}) {
  const url = new URL(`/rest/v1/${tableName}`, config.supabaseUrl);
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value);
    }
  }
  return url;
}

async function parseResponse(response) {
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    const error = new Error(body || `Supabase error (${response.status})`);
    error.statusCode = response.status;
    throw error;
  }

  if (response.status === 204) {
    return null;
  }

  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

export async function supabaseRequest(tableName, { method = 'GET', query = {}, body, prefer = '' } = {}) {
  validateConfig();
  const response = await fetch(buildUrl(tableName, query), {
    method,
    headers: {
      apikey: config.supabaseKey,
      Authorization: `Bearer ${config.supabaseKey}`,
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(prefer ? { Prefer: prefer } : {})
    },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });

  return parseResponse(response);
}
