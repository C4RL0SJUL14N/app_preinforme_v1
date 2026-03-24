import fs from 'node:fs';
import path from 'node:path';

let envLoaded = false;

function loadLocalEnvFile() {
  if (envLoaded) {
    return;
  }
  envLoaded = true;

  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) {
    return;
  }

  const content = fs.readFileSync(envPath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }
    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }
    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

export function getEnv(name, fallback = '') {
  loadLocalEnvFile();
  const value = process.env[name];
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }
  return fallback;
}

export const config = {
  supabaseUrl: getEnv('SUPABASE_URL'),
  supabaseKey: getEnv('SUPABASE_SERVICE_ROLE_KEY') || getEnv('SUPABASE_ANON_KEY') || getEnv('SUPABASE_PUBLISHABLE_KEY'),
  passwordSalt: getEnv('APP_PASSWORD_SALT', 'preinformes-salt'),
  cacheTtlMs: Number.parseInt(getEnv('CACHE_TTL_MS', '60000'), 10),
  defaultInstitutionId: getEnv('DEFAULT_INSTITUTION_ID', '_0001'),
  defaultSedeId: getEnv('DEFAULT_SEDE_ID', '_0001')
};

export function validateConfig() {
  const missing = [];
  if (!config.supabaseUrl) missing.push('SUPABASE_URL');
  if (!config.supabaseKey) missing.push('SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY');
  if (missing.length > 0) {
    const error = new Error(`Missing environment variables: ${missing.join(', ')}`);
    error.statusCode = 500;
    throw error;
  }
}
