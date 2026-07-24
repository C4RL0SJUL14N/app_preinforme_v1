import { config } from './config.js';
import { createToken, getBearerToken, hashPassword, normalizeString, parseToken } from './utils.js';

export function createSession(user, extras = {}) {
  const issuedAt = Date.now();
  return createToken({
    userId: user.id,
    isAdmin: user.isAdmin === 'TRUE',
    firstName: user.firstName,
    lastName: user.lastName,
    issuedAt,
    expiresAt: issuedAt + config.sessionTtlHours * 60 * 60 * 1000,
    ...extras
  });
}

export function authenticateUser(teachers, login, password) {
  const teacher = teachers.find((item) => item.id === normalizeString(login) && item.active !== 'FALSE');
  if (!teacher) return null;
  const incoming = hashPassword(password, config.passwordSalt);
  return incoming === teacher.passwordHash ? teacher : null;
}

export function getSessionFromRequest(req) {
  const token = getBearerToken(req);
  const session = parseToken(token);
  if (!session || !Number.isFinite(session.expiresAt) || Date.now() >= session.expiresAt) {
    return null;
  }
  return session;
}
