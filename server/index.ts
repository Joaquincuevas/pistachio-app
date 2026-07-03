import express, { type NextFunction, type Request, type Response } from 'express';
import cookieParser from 'cookie-parser';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { db } from './db.js';
import {
  clearFailedLogins,
  createSession,
  destroySession,
  getSessionUser,
  hashPassword,
  loginAllowed,
  registerFailedLogin,
  verifyPassword,
  type SessionUser,
} from './auth.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const IS_PROD = process.env.NODE_ENV === 'production';
// En dev el puerto es fijo (3001, el proxy de Vite apunta ahí); PORT solo
// se respeta en producción, donde lo inyecta la plataforma de hosting.
const PORT = Number(process.env.API_PORT ?? (IS_PROD ? process.env.PORT : undefined) ?? 3001);
const COOKIE = 'pistachio_sid';

const app = express();
app.use(express.json());
app.use(cookieParser());

// ─── Helpers ────────────────────────────────────────────────────

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

const statusSchema = z.object({
  status: z.enum(['completed', 'in-progress', 'pending']),
});

const planSchema = z.object({
  specialtyId: z.string().min(1),
  planId: z.string().min(1),
});

function publicUser(u: SessionUser) {
  return {
    user: { id: u.id, name: u.name, email: u.email, createdAt: u.created_at },
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
      `SELECT id, name, email, created_at, specialty_id, plan_id, password_hash
       FROM users WHERE email = ?`,
    )
    .get(email) as (SessionUser & { password_hash: string }) | undefined;

  if (!row || !verifyPassword(parsed.data.password, row.password_hash)) {
    registerFailedLogin(email);
    res.status(401).json({ error: 'Correo o contraseña incorrectos.' });
    return;
  }

  clearFailedLogins(email);
  setSessionCookie(res, createSession(row.id));
  res.json(publicUser(row));
});

app.post('/api/auth/logout', (req, res) => {
  destroySession(req.cookies?.[COOKIE]);
  res.clearCookie(COOKIE, { path: '/' });
  res.status(204).end();
});

app.get('/api/auth/me', requireAuth, (req: AuthedRequest, res) => {
  res.json(publicUser(req.sessionUser!));
});

function getUserById(id: number): SessionUser {
  return db
    .prepare(`SELECT id, name, email, created_at, specialty_id, plan_id FROM users WHERE id = ?`)
    .get(id) as SessionUser;
}

// ─── Catálogo (público, es información institucional) ──────────

let catalogCache: unknown = null;

app.get('/api/catalog', (_req, res) => {
  if (!catalogCache) {
    const specialties = db
      .prepare(`SELECT id, name, full_name, emoji, tagline FROM specialties ORDER BY sort`)
      .all() as { id: string; name: string; full_name: string; emoji: string; tagline: string }[];

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
        emoji: s.emoji,
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
  const inPlan = db
    .prepare(`SELECT 1 FROM plan_courses WHERE plan_id = ? AND course_id = ?`)
    .get(planId, courseId);
  if (!inPlan) {
    res.status(404).json({ error: 'El ramo no pertenece a este plan' });
    return;
  }
  if (parsed.data.status === 'pending') {
    // Pendiente es el estado por defecto: basta borrar la fila.
    db.prepare(`DELETE FROM progress WHERE user_id = ? AND plan_id = ? AND course_id = ?`).run(
      req.sessionUser!.id, planId, courseId,
    );
  } else {
    db.prepare(
      `INSERT INTO progress (user_id, plan_id, course_id, status, updated_at)
       VALUES (?, ?, ?, ?, datetime('now'))
       ON CONFLICT (user_id, plan_id, course_id)
       DO UPDATE SET status = excluded.status, updated_at = excluded.updated_at`,
    ).run(req.sessionUser!.id, planId, courseId, parsed.data.status);
  }
  res.json({ ok: true });
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
