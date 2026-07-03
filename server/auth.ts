import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { db } from './db.js';

/**
 * Hashing de contraseñas con scrypt (node:crypto): sin dependencias externas,
 * resistente a fuerza bruta por diseño (memoria + CPU). Formato: salt:hash (hex).
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  return timingSafeEqual(Buffer.from(hash, 'hex'), candidate);
}

const SESSION_DAYS = 30;

/** En la cookie viaja el token crudo; en la base solo se guarda su SHA-256. */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function createSession(userId: number): string {
  const token = randomBytes(32).toString('base64url');
  db.prepare(
    `INSERT INTO sessions (token_hash, user_id, expires_at)
     VALUES (?, ?, datetime('now', '+${SESSION_DAYS} days'))`,
  ).run(hashToken(token), userId);
  return token;
}

export interface SessionUser {
  id: number;
  name: string;
  email: string;
  created_at: string;
  specialty_id: string | null;
  plan_id: string | null;
}

export function getSessionUser(token: string | undefined): SessionUser | null {
  if (!token) return null;
  // Limpieza oportunista de sesiones vencidas.
  db.prepare(`DELETE FROM sessions WHERE expires_at < datetime('now')`).run();
  const row = db
    .prepare(
      `SELECT u.id, u.name, u.email, u.created_at, u.specialty_id, u.plan_id
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.expires_at >= datetime('now')`,
    )
    .get(hashToken(token)) as SessionUser | undefined;
  return row ?? null;
}

export function destroySession(token: string | undefined): void {
  if (!token) return;
  db.prepare(`DELETE FROM sessions WHERE token_hash = ?`).run(hashToken(token));
}

/** Límite de intentos de login por email (mitiga fuerza bruta básica). */
const attempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 8;
const WINDOW_MS = 10 * 60 * 1000;

export function loginAllowed(email: string): boolean {
  const entry = attempts.get(email);
  if (!entry || entry.resetAt < Date.now()) return true;
  return entry.count < MAX_ATTEMPTS;
}

export function registerFailedLogin(email: string): void {
  const now = Date.now();
  const entry = attempts.get(email);
  if (!entry || entry.resetAt < now) {
    attempts.set(email, { count: 1, resetAt: now + WINDOW_MS });
  } else {
    entry.count += 1;
  }
}

export function clearFailedLogins(email: string): void {
  attempts.delete(email);
}
