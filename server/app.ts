import express, { type NextFunction, type Request, type Response } from 'express';
import cookieParser from 'cookie-parser';
import QRCode from 'qrcode';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { all, batch, ensureReady, get, run } from './db.js';
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

const IS_PROD = process.env.NODE_ENV === 'production';
const COOKIE = 'pistachio_sid';

export const app = express();
app.use(express.json());
app.use(cookieParser());

// La base se inicializa/siembra una vez; cada request espera a que esté lista.
app.use(async (_req, res, next) => {
  try {
    await ensureReady();
    next();
  } catch (err) {
    console.error('[db] init falló', err);
    res.status(503).json({ error: 'Base de datos no disponible. Intenta en unos segundos.' });
  }
});

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

async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const user = await getSessionUser(req.cookies?.[COOKIE]);
  if (!user) {
    res.status(401).json({ error: 'Sesión no válida. Inicia sesión de nuevo.' });
    return;
  }
  req.sessionUser = user;
  next();
}

async function getUserById(id: number): Promise<SessionUser> {
  return (await get<SessionUser>(
    `SELECT id, name, email, created_at, specialty_id, plan_id, totp_enabled
     FROM users WHERE id = ?`,
    [id],
  )) as SessionUser;
}

async function getPasswordHash(userId: number): Promise<string> {
  const row = await get<{ password_hash: string }>(
    `SELECT password_hash FROM users WHERE id = ?`,
    [userId],
  );
  return row!.password_hash;
}

// ─── Salud ──────────────────────────────────────────────────────

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

// ─── Auth ───────────────────────────────────────────────────────

app.post('/api/auth/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' });
    return;
  }
  const { name, email, password } = parsed.data;
  const normalized = email.trim().toLowerCase();

  const exists = await get(`SELECT 1 FROM users WHERE email = ?`, [normalized]);
  if (exists) {
    res.status(409).json({ error: 'Ya existe una cuenta con este correo. Intenta iniciar sesión.' });
    return;
  }

  const info = await run(`INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)`, [
    name,
    normalized,
    hashPassword(password),
  ]);

  const user = await getUserById(Number(info.lastInsertRowid));
  setSessionCookie(res, await createSession(user.id));
  res.status(201).json(publicUser(user));
});

app.post('/api/auth/login', async (req, res) => {
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

  const row = await get<SessionUser & { password_hash: string }>(
    `SELECT id, name, email, created_at, specialty_id, plan_id, totp_enabled, password_hash
     FROM users WHERE email = ?`,
    [email],
  );

  if (!row || !verifyPassword(parsed.data.password, row.password_hash)) {
    registerFailedLogin(email);
    res.status(401).json({ error: 'Correo o contraseña incorrectos.' });
    return;
  }

  clearFailedLogins(email);

  // Con 2FA activo la sesión recién se crea al validar el código. El desafío
  // se guarda en la base (no en memoria) para funcionar en serverless.
  if (row.totp_enabled === 1) {
    const challengeId = randomBytes(16).toString('base64url');
    await run(`DELETE FROM two_fa_challenges WHERE expires_at < datetime('now')`);
    await run(
      `INSERT INTO two_fa_challenges (id, user_id, expires_at)
       VALUES (?, ?, datetime('now', '+5 minutes'))`,
      [challengeId, row.id],
    );
    res.json({ twoFactorRequired: true, challengeId });
    return;
  }

  setSessionCookie(res, await createSession(row.id));
  res.json(publicUser(row));
});

app.post('/api/auth/2fa', async (req, res) => {
  const parsed = twoFaLoginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Código inválido' });
    return;
  }
  const challenge = await get<{ user_id: number; attempts: number }>(
    `SELECT user_id, attempts FROM two_fa_challenges
     WHERE id = ? AND expires_at >= datetime('now')`,
    [parsed.data.challengeId],
  );
  if (!challenge) {
    res.status(401).json({ error: 'El código expiró. Inicia sesión de nuevo.' });
    return;
  }
  if (challenge.attempts + 1 > 5) {
    await run(`DELETE FROM two_fa_challenges WHERE id = ?`, [parsed.data.challengeId]);
    res.status(429).json({ error: 'Demasiados intentos. Inicia sesión de nuevo.' });
    return;
  }
  await run(`UPDATE two_fa_challenges SET attempts = attempts + 1 WHERE id = ?`, [
    parsed.data.challengeId,
  ]);

  const secretRow = await get<{ totp_secret: string | null }>(
    `SELECT totp_secret FROM users WHERE id = ?`,
    [challenge.user_id],
  );
  if (!secretRow?.totp_secret || !verifyTotp(secretRow.totp_secret, parsed.data.code)) {
    res.status(401).json({ error: 'Código incorrecto. Intenta de nuevo.' });
    return;
  }

  await run(`DELETE FROM two_fa_challenges WHERE id = ?`, [parsed.data.challengeId]);
  setSessionCookie(res, await createSession(challenge.user_id));
  res.json(publicUser(await getUserById(challenge.user_id)));
});

app.post('/api/auth/logout', async (req, res) => {
  await destroySession(req.cookies?.[COOKIE]);
  res.clearCookie(COOKIE, { path: '/' });
  res.status(204).end();
});

app.get('/api/auth/me', requireAuth, (req: AuthedRequest, res) => {
  res.json(publicUser(req.sessionUser!));
});

// ─── Cuenta: contraseña, 2FA, eliminación ───────────────────────

app.put('/api/me/password', requireAuth, async (req: AuthedRequest, res) => {
  const parsed = passwordChangeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' });
    return;
  }
  const user = req.sessionUser!;
  if (!verifyPassword(parsed.data.currentPassword, await getPasswordHash(user.id))) {
    res.status(401).json({ error: 'La contraseña actual no es correcta.' });
    return;
  }
  await run(`UPDATE users SET password_hash = ? WHERE id = ?`, [
    hashPassword(parsed.data.newPassword),
    user.id,
  ]);
  await destroyOtherSessions(user.id, req.cookies?.[COOKIE]);
  res.json({ ok: true });
});

app.post('/api/me/2fa/setup', requireAuth, async (req: AuthedRequest, res) => {
  const user = req.sessionUser!;
  if (user.totp_enabled === 1) {
    res.status(409).json({ error: 'La verificación en dos pasos ya está activa.' });
    return;
  }
  const secret = generateTotpSecret();
  await run(`UPDATE users SET totp_secret = ?, totp_enabled = 0 WHERE id = ?`, [secret, user.id]);
  const uri = otpauthUri(user.email, secret);
  const qr = await QRCode.toDataURL(uri, { margin: 1, width: 220 });
  res.json({ secret, uri, qr });
});

app.post('/api/me/2fa/enable', requireAuth, async (req: AuthedRequest, res) => {
  const parsed = totpCodeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Ingresa el código de 6 dígitos' });
    return;
  }
  const user = req.sessionUser!;
  const row = await get<{ totp_secret: string | null }>(
    `SELECT totp_secret FROM users WHERE id = ?`,
    [user.id],
  );
  if (!row?.totp_secret) {
    res.status(400).json({ error: 'Primero genera el código QR.' });
    return;
  }
  if (!verifyTotp(row.totp_secret, parsed.data.code)) {
    res.status(401).json({ error: 'Código incorrecto. Revisa tu app de autenticación.' });
    return;
  }
  await run(`UPDATE users SET totp_enabled = 1 WHERE id = ?`, [user.id]);
  res.json({ ok: true });
});

app.post('/api/me/2fa/disable', requireAuth, async (req: AuthedRequest, res) => {
  const parsed = passwordConfirmSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Ingresa tu contraseña' });
    return;
  }
  const user = req.sessionUser!;
  if (!verifyPassword(parsed.data.password, await getPasswordHash(user.id))) {
    res.status(401).json({ error: 'Contraseña incorrecta.' });
    return;
  }
  await run(`UPDATE users SET totp_secret = NULL, totp_enabled = 0 WHERE id = ?`, [user.id]);
  res.json({ ok: true });
});

app.delete('/api/me', requireAuth, async (req: AuthedRequest, res) => {
  const parsed = passwordConfirmSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Ingresa tu contraseña para confirmar' });
    return;
  }
  const user = req.sessionUser!;
  if (!verifyPassword(parsed.data.password, await getPasswordHash(user.id))) {
    res.status(401).json({ error: 'Contraseña incorrecta.' });
    return;
  }
  await run(`DELETE FROM users WHERE id = ?`, [user.id]);
  res.clearCookie(COOKIE, { path: '/' });
  res.status(204).end();
});

// ─── Catálogo (público) ─────────────────────────────────────────

let catalogCache: unknown = null;

app.get('/api/catalog', async (_req, res) => {
  if (!catalogCache) {
    const specialties = await all<{
      id: string; name: string; full_name: string; icon: string; tagline: string;
    }>(`SELECT id, name, full_name, icon, tagline FROM specialties ORDER BY sort`);

    const plans = await all<{ id: string; specialty_id: string; name: string }>(
      `SELECT id, specialty_id, name FROM plans ORDER BY sort`,
    );

    const courseRows = await all<{
      plan_id: string; semester: number; credits: number; credit_req: number | null;
      id: string; name: string; is_slot: number; slot_category: string | null;
      hours_json: string | null; req_text: string | null; skills: string | null; offered: string;
    }>(
      `SELECT pc.plan_id, pc.semester, pc.credits, pc.credit_req,
              c.id, c.name, c.is_slot, c.slot_category, c.hours_json, c.req_text, c.skills, c.offered
       FROM plan_courses pc JOIN courses c ON c.id = pc.course_id`,
    );

    const prereqRows = await all<{
      plan_id: string; course_id: string; prereq_id: string; concurrent: number;
    }>(`SELECT plan_id, course_id, prereq_id, concurrent FROM prerequisites`);

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

app.put('/api/me/plan', requireAuth, async (req: AuthedRequest, res) => {
  const parsed = planSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Plan inválido' });
    return;
  }
  const { specialtyId, planId } = parsed.data;
  const plan = await get(`SELECT 1 FROM plans WHERE id = ? AND specialty_id = ?`, [
    planId,
    specialtyId,
  ]);
  if (!plan) {
    res.status(404).json({ error: 'El plan no existe' });
    return;
  }
  await run(`UPDATE users SET specialty_id = ?, plan_id = ? WHERE id = ?`, [
    specialtyId,
    planId,
    req.sessionUser!.id,
  ]);
  res.json({ settings: { specialtyId, planId } });
});

// ─── Progreso ───────────────────────────────────────────────────

/** Prerrequisitos transitivos de un ramo dentro de un plan. */
async function transitivePrereqs(planId: string, courseId: string): Promise<string[]> {
  const rows = await all<{ course_id: string; prereq_id: string }>(
    `SELECT course_id, prereq_id FROM prerequisites WHERE plan_id = ?`,
    [planId],
  );
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

app.get('/api/progress/:planId', requireAuth, async (req: AuthedRequest, res) => {
  const rows = await all<{ course_id: string; status: string }>(
    `SELECT course_id, status FROM progress WHERE user_id = ? AND plan_id = ?`,
    [req.sessionUser!.id, req.params.planId],
  );
  const statuses: Record<string, string> = {};
  for (const row of rows) statuses[row.course_id] = row.status;
  res.json({ statuses });
});

app.put('/api/progress/:planId/:courseId', requireAuth, async (req: AuthedRequest, res) => {
  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Estado inválido' });
    return;
  }
  const { planId, courseId } = req.params;
  const userId = req.sessionUser!.id;
  const inPlan = await get(`SELECT 1 FROM plan_courses WHERE plan_id = ? AND course_id = ?`, [
    planId,
    courseId,
  ]);
  if (!inPlan) {
    res.status(404).json({ error: 'El ramo no pertenece a este plan' });
    return;
  }

  const upsertSql = `INSERT INTO progress (user_id, plan_id, course_id, status, updated_at)
     VALUES (?, ?, ?, ?, datetime('now'))
     ON CONFLICT (user_id, plan_id, course_id)
     DO UPDATE SET status = excluded.status, updated_at = excluded.updated_at`;

  const changed: Record<string, string> = {};

  if (parsed.data.status === 'pending') {
    await run(`DELETE FROM progress WHERE user_id = ? AND plan_id = ? AND course_id = ?`, [
      userId, planId, courseId,
    ]);
    changed[courseId] = 'pending';
  } else if (parsed.data.status === 'completed') {
    // Marcar cursado arrastra en cascada todos sus prerrequisitos (un batch atómico).
    const ids = [courseId, ...(await transitivePrereqs(planId, courseId))];
    await batch(
      ids.map((id) => ({ sql: upsertSql, args: [userId, planId, id, 'completed'] })),
      'write',
    );
    for (const id of ids) changed[id] = 'completed';
  } else {
    await run(upsertSql, [userId, planId, courseId, parsed.data.status]);
    changed[courseId] = parsed.data.status;
  }

  res.json({ ok: true, statuses: changed });
});

export default app;
