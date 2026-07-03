import express, { type NextFunction, type Request, type Response } from 'express';
import cookieParser from 'cookie-parser';
import QRCode from 'qrcode';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { db } from './db.js';
import {
  clearFailedLogins,
  createSession,
  destroyOtherSessions,
  destroySession,
  getSessionUser,
  hashPassword,
  loginAllowed,
  registerFailedLogin,
  verifyPassword,
  type SessionUser,
} from './auth.js';
import { generateTotpSecret, otpauthUri, verifyTotp } from './totp.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const IS_PROD = process.env.NODE_ENV === 'production';
// En dev el puerto es fijo (3001, el proxy de Vite apunta ahí); PORT solo
// se respeta en producción, donde lo inyecta la plataforma de hosting.
const PORT = Number(process.env.API_PORT ?? (IS_PROD ? process.env.PORT : undefined) ?? 3001);
const COOKIE = 'pistachio_sid';

const app = express();
app.use(express.json());
app.use(cookieParser());

// ─── Schemas ────────────────────────────────────────────────────

const emailSchema = z
  .string()
  .email('Ingresa un correo válido')
  .refine((e) => /@(mi)?uandes\.cl$/i.test(e), 'Usa tu correo institucional U. Andes');

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Ingresa tu nombre').max(60),
  email: emailSchema,
  password: z.string().min(8, 'Mínimo 8 caracteres').max(128),
});

const loginSchema = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
});

const twoFaLoginSchema = z.object({
  challengeId: z.string().min(1),
  code: z.string().min(6).max(7),
});

const statusSchema = z.object({
  status: z.enum(['completed', 'in-progress', 'pending']),
});

const planSchema = z.object({
  specialtyId: z.string().min(1),
  planId: z.string().min(1),
});

const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, 'Ingresa tu contraseña actual'),
  newPassword: z.string().min(8, 'Mínimo 8 caracteres').max(128),
});

const passwordConfirmSchema = z.object({
  password: z.string().min(1, 'Ingresa tu contraseña'),
});

const totpCodeSchema = z.object({
  code: z.string().min(6).max(7),
});

// ─── Helpers ────────────────────────────────────────────────────

function publicUser(u: SessionUser) {
  return {
    user: {
      id: u.id,
      name: u.name,
      email: u.email,
      createdAt: u.created_at,
      twoFactorEnabled: u.totp_enabled === 1,
    },
    settings: { specialtyId: u.specialty_id, planId: u.plan_id },
  };
}

function setSessionCookie(res: Response, token: string) {
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: IS_PROD,
    maxAge: 30 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

interface AuthedRequest extends Request {
  sessionUser?: SessionUser;
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const user = getSessionUser(req.cookies?.[COOKIE]);
  if (!user) {
    res.status(401).json({ error: 'Sesión no válida. Inicia sesión de nuevo.' });
    return;
  }
  req.sessionUser = user;
  next();
}

function getUserById(id: number): SessionUser {
  return db
    .prepare(
      `SELECT id, name, email, created_at, specialty_id, plan_id, totp_enabled
       FROM users WHERE id = ?`,
    )
    .get(id) as SessionUser;
}

function getPasswordHash(userId: number): string {
  const row = db.prepare(`SELECT password_hash FROM users WHERE id = ?`).get(userId) as {
    password_hash: string;
  };
  return row.password_hash;
}

// ─── Auth ───────────────────────────────────────────────────────

app.post('/api/auth/register', (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' });
    return;
  }
  const { name, email, password } = parsed.data;
  const normalized = email.trim().toLowerCase();

  const exists = db.prepare(`SELECT 1 FROM users WHERE email = ?`).get(normalized);
  if (exists) {
    res.status(409).json({ error: 'Ya existe una cuenta con este correo. Intenta iniciar sesión.' });
    return;
  }

  const info = db
    .prepare(`INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)`)
    .run(name, normalized, hashPassword(password));

  const user = getUserById(Number(info.lastInsertRowid));
  setSessionCookie(res, createSession(user.id));
  res.status(201).json(publicUser(user));
});

/**
 * Desafíos 2FA pendientes tras un login con contraseña correcta.
 * Viven 5 minutos y admiten 5 intentos de código.
 */
const twoFaChallenges = new Map<string, { userId: number; expiresAt: number; attempts: number }>();

app.post('/api/auth/login', (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Ingresa tu correo y contraseña' });
    return;
  }
  const email = parsed.data.email.trim().toLowerCase();

  if (!loginAllowed(email)) {
    res.status(429).json({ error: 'Demasiados intentos. Espera unos minutos e intenta de nuevo.' });
    return;
  }

  const row = db
    .prepare(
      `SELECT id, name, email, created_at, specialty_id, plan_id, totp_enabled, password_hash
       FROM users WHERE email = ?`,
    )
    .get(email) as (SessionUser & { password_hash: string }) | undefined;

  if (!row || !verifyPassword(parsed.data.password, row.password_hash)) {
    registerFailedLogin(email);
    res.status(401).json({ error: 'Correo o contraseña incorrectos.' });
    return;
  }

  clearFailedLogins(email);

  // Con 2FA activo la sesión recién se crea al validar el código.
  if (row.totp_enabled === 1) {
    const challengeId = randomBytes(16).toString('base64url');
    twoFaChallenges.set(challengeId, {
      userId: row.id,
      expiresAt: Date.now() + 5 * 60 * 1000,
      attempts: 0,
    });
    res.json({ twoFactorRequired: true, challengeId });
    return;
  }

  setSessionCookie(res, createSession(row.id));
  res.json(publicUser(row));
});

app.post('/api/auth/2fa', (req, res) => {
  const parsed = twoFaLoginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Código inválido' });
    return;
  }
  const challenge = twoFaChallenges.get(parsed.data.challengeId);
  if (!challenge || challenge.expiresAt < Date.now()) {
    twoFaChallenges.delete(parsed.data.challengeId);
    res.status(401).json({ error: 'El código expiró. Inicia sesión de nuevo.' });
    return;
  }
  challenge.attempts += 1;
  if (challenge.attempts > 5) {
    twoFaChallenges.delete(parsed.data.challengeId);
    res.status(429).json({ error: 'Demasiados intentos. Inicia sesión de nuevo.' });
    return;
  }

  const secretRow = db
    .prepare(`SELECT totp_secret FROM users WHERE id = ?`)
    .get(challenge.userId) as { totp_secret: string | null };
  if (!secretRow.totp_secret || !verifyTotp(secretRow.totp_secret, parsed.data.code)) {
    res.status(401).json({ error: 'Código incorrecto. Intenta de nuevo.' });
    return;
  }

  twoFaChallenges.delete(parsed.data.challengeId);
  setSessionCookie(res, createSession(challenge.userId));
  res.json(publicUser(getUserById(challenge.userId)));
});

app.post('/api/auth/logout', (req, res) => {
  destroySession(req.cookies?.[COOKIE]);
  res.clearCookie(COOKIE, { path: '/' });
  res.status(204).end();
});

app.get('/api/auth/me', requireAuth, (req: AuthedRequest, res) => {
  res.json(publicUser(req.sessionUser!));
});

// ─── Cuenta: contraseña, 2FA, eliminación ───────────────────────

app.put('/api/me/password', requireAuth, (req: AuthedRequest, res) => {
  const parsed = passwordChangeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' });
    return;
  }
  const user = req.sessionUser!;
  if (!verifyPassword(parsed.data.currentPassword, getPasswordHash(user.id))) {
    res.status(401).json({ error: 'La contraseña actual no es correcta.' });
    return;
  }
  db.prepare(`UPDATE users SET password_hash = ? WHERE id = ?`).run(
    hashPassword(parsed.data.newPassword),
    user.id,
  );
  // Cambiar la clave invalida cualquier otra sesión abierta.
  destroyOtherSessions(user.id, req.cookies?.[COOKIE]);
  res.json({ ok: true });
});

app.post('/api/me/2fa/setup', requireAuth, async (req: AuthedRequest, res) => {
  const user = req.sessionUser!;
  if (user.totp_enabled === 1) {
    res.status(409).json({ error: 'La verificación en dos pasos ya está activa.' });
    return;
  }
  const secret = generateTotpSecret();
  // Secreto pendiente: recién cuenta como activo al verificar un código.
  db.prepare(`UPDATE users SET totp_secret = ?, totp_enabled = 0 WHERE id = ?`).run(
    secret,
    user.id,
  );
  const uri = otpauthUri(user.email, secret);
  const qr = await QRCode.toDataURL(uri, { margin: 1, width: 220 });
  res.json({ secret, uri, qr });
});

app.post('/api/me/2fa/enable', requireAuth, (req: AuthedRequest, res) => {
  const parsed = totpCodeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Ingresa el código de 6 dígitos' });
    return;
  }
  const user = req.sessionUser!;
  const row = db.prepare(`SELECT totp_secret FROM users WHERE id = ?`).get(user.id) as {
    totp_secret: string | null;
  };
  if (!row.totp_secret) {
    res.status(400).json({ error: 'Primero genera el código QR.' });
    return;
  }
  if (!verifyTotp(row.totp_secret, parsed.data.code)) {
    res.status(401).json({ error: 'Código incorrecto. Revisa tu app de autenticación.' });
    return;
  }
  db.prepare(`UPDATE users SET totp_enabled = 1 WHERE id = ?`).run(user.id);
  res.json({ ok: true });
});

app.post('/api/me/2fa/disable', requireAuth, (req: AuthedRequest, res) => {
  const parsed = passwordConfirmSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Ingresa tu contraseña' });
    return;
  }
  const user = req.sessionUser!;
  if (!verifyPassword(parsed.data.password, getPasswordHash(user.id))) {
    res.status(401).json({ error: 'Contraseña incorrecta.' });
    return;
  }
  db.prepare(`UPDATE users SET totp_secret = NULL, totp_enabled = 0 WHERE id = ?`).run(user.id);
  res.json({ ok: true });
});

app.delete('/api/me', requireAuth, (req: AuthedRequest, res) => {
  const parsed = passwordConfirmSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Ingresa tu contraseña para confirmar' });
    return;
  }
  const user = req.sessionUser!;
  if (!verifyPassword(parsed.data.password, getPasswordHash(user.id))) {
    res.status(401).json({ error: 'Contraseña incorrecta.' });
    return;
  }
  // Sesiones y progreso caen en cascada (FK ON DELETE CASCADE).
  db.prepare(`DELETE FROM users WHERE id = ?`).run(user.id);
  res.clearCookie(COOKIE, { path: '/' });
  res.status(204).end();
});

// ─── Catálogo (público, es información institucional) ──────────

let catalogCache: unknown = null;

app.get('/api/catalog', (_req, res) => {
  if (!catalogCache) {
    const specialties = db
      .prepare(`SELECT id, name, full_name, icon, tagline FROM specialties ORDER BY sort`)
      .all() as { id: string; name: string; full_name: string; icon: string; tagline: string }[];

    const plans = db
      .prepare(`SELECT id, specialty_id, name FROM plans ORDER BY sort`)
      .all() as { id: string; specialty_id: string; name: string }[];

    const courseRows = db
      .prepare(
        `SELECT pc.plan_id, pc.semester, pc.credits, pc.credit_req,
                c.id, c.name, c.is_slot, c.slot_category, c.hours_json, c.req_text, c.skills, c.offered
         FROM plan_courses pc JOIN courses c ON c.id = pc.course_id`,
      )
      .all() as {
      plan_id: string; semester: number; credits: number; credit_req: number | null;
      id: string; name: string; is_slot: number; slot_category: string | null;
      hours_json: string | null; req_text: string | null; skills: string | null; offered: string;
    }[];

    const prereqRows = db
      .prepare(`SELECT plan_id, course_id, prereq_id, concurrent FROM prerequisites`)
      .all() as { plan_id: string; course_id: string; prereq_id: string; concurrent: number }[];

    const prereqsByPlanCourse = new Map<string, { id: string; concurrent: boolean }[]>();
    for (const p of prereqRows) {
      const key = `${p.plan_id}:${p.course_id}`;
      const list = prereqsByPlanCourse.get(key) ?? [];
      list.push({ id: p.prereq_id, concurrent: p.concurrent === 1 });
      prereqsByPlanCourse.set(key, list);
    }

    const coursesByPlan = new Map<string, unknown[]>();
    for (const r of courseRows) {
      const list = coursesByPlan.get(r.plan_id) ?? [];
      list.push({
        id: r.id,
        name: r.name,
        credits: r.credits,
        semester: r.semester,
        prerequisites: prereqsByPlanCourse.get(`${r.plan_id}:${r.id}`) ?? [],
        creditReq: r.credit_req,
        hours: r.hours_json ? JSON.parse(r.hours_json) : null,
        reqText: r.req_text,
        skills: r.skills,
        offered: JSON.parse(r.offered) as number[],
        isSlot: r.is_slot === 1,
        slotCategory: r.slot_category,
      });
      coursesByPlan.set(r.plan_id, list);
    }

    catalogCache = {
      specialties: specialties.map((s) => ({
        id: s.id,
        name: s.name,
        fullName: s.full_name,
        icon: s.icon,
        tagline: s.tagline,
        plans: plans
          .filter((p) => p.specialty_id === s.id)
          .map((p) => ({ id: p.id, name: p.name, courses: coursesByPlan.get(p.id) ?? [] })),
      })),
    };
  }
  res.json(catalogCache);
});

// ─── Especialidad / plan del usuario ────────────────────────────

app.put('/api/me/plan', requireAuth, (req: AuthedRequest, res) => {
  const parsed = planSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Plan inválido' });
    return;
  }
  const { specialtyId, planId } = parsed.data;
  const plan = db
    .prepare(`SELECT 1 FROM plans WHERE id = ? AND specialty_id = ?`)
    .get(planId, specialtyId);
  if (!plan) {
    res.status(404).json({ error: 'El plan no existe' });
    return;
  }
  db.prepare(`UPDATE users SET specialty_id = ?, plan_id = ? WHERE id = ?`).run(
    specialtyId,
    planId,
    req.sessionUser!.id,
  );
  res.json({ settings: { specialtyId, planId } });
});

// ─── Progreso ───────────────────────────────────────────────────

/** Prerrequisitos transitivos de un ramo dentro de un plan. */
function transitivePrereqs(planId: string, courseId: string): string[] {
  const rows = db
    .prepare(`SELECT course_id, prereq_id FROM prerequisites WHERE plan_id = ?`)
    .all(planId) as { course_id: string; prereq_id: string }[];
  const byCourse = new Map<string, string[]>();
  for (const row of rows) {
    const list = byCourse.get(row.course_id) ?? [];
    list.push(row.prereq_id);
    byCourse.set(row.course_id, list);
  }
  const result = new Set<string>();
  const queue = [...(byCourse.get(courseId) ?? [])];
  while (queue.length > 0) {
    const id = queue.pop()!;
    if (result.has(id)) continue;
    result.add(id);
    queue.push(...(byCourse.get(id) ?? []));
  }
  return [...result];
}

app.get('/api/progress/:planId', requireAuth, (req: AuthedRequest, res) => {
  const rows = db
    .prepare(`SELECT course_id, status FROM progress WHERE user_id = ? AND plan_id = ?`)
    .all(req.sessionUser!.id, req.params.planId) as { course_id: string; status: string }[];
  const statuses: Record<string, string> = {};
  for (const row of rows) statuses[row.course_id] = row.status;
  res.json({ statuses });
});

app.put('/api/progress/:planId/:courseId', requireAuth, (req: AuthedRequest, res) => {
  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Estado inválido' });
    return;
  }
  const { planId, courseId } = req.params;
  const userId = req.sessionUser!.id;
  const inPlan = db
    .prepare(`SELECT 1 FROM plan_courses WHERE plan_id = ? AND course_id = ?`)
    .get(planId, courseId);
  if (!inPlan) {
    res.status(404).json({ error: 'El ramo no pertenece a este plan' });
    return;
  }

  const upsert = db.prepare(
    `INSERT INTO progress (user_id, plan_id, course_id, status, updated_at)
     VALUES (?, ?, ?, ?, datetime('now'))
     ON CONFLICT (user_id, plan_id, course_id)
     DO UPDATE SET status = excluded.status, updated_at = excluded.updated_at`,
  );

  const changed: Record<string, string> = {};

  if (parsed.data.status === 'pending') {
    // Pendiente es el estado por defecto: basta borrar la fila.
    db.prepare(`DELETE FROM progress WHERE user_id = ? AND plan_id = ? AND course_id = ?`).run(
      userId, planId, courseId,
    );
    changed[courseId] = 'pending';
  } else if (parsed.data.status === 'completed') {
    // Marcar cursado arrastra en cascada todos sus prerrequisitos.
    const cascade = db.transaction(() => {
      upsert.run(userId, planId, courseId, 'completed');
      changed[courseId] = 'completed';
      for (const prereqId of transitivePrereqs(planId, courseId)) {
        upsert.run(userId, planId, prereqId, 'completed');
        changed[prereqId] = 'completed';
      }
    });
    cascade();
  } else {
    upsert.run(userId, planId, courseId, parsed.data.status);
    changed[courseId] = parsed.data.status;
  }

  res.json({ ok: true, statuses: changed });
});

// ─── Estáticos en producción (deploy de un solo proceso) ────────

const dist = path.join(here, '..', 'dist');
if (IS_PROD && existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.listen(PORT, () => {
  console.log(`[api] Pistachio API en http://localhost:${PORT}`);
});
