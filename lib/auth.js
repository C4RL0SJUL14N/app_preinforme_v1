import { config } from './config.js';
import { createToken, getBearerToken, hashPassword, normalizeString, parseToken } from './utils.js';

export function createSession(user) {
  return createToken({
    userId: user.id,
    isAdmin: user.isAdmin === 'TRUE',
    firstName: user.firstName,
    lastName: user.lastName
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
  return parseToken(token);
}
