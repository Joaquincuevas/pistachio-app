import { createClient, type InArgs, type InStatement } from '@libsql/client';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import catalog from './data/catalog.json' with { type: 'json' };

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * Cliente libSQL. En producción (Vercel) usa Turso (TURSO_DATABASE_URL +
 * TURSO_AUTH_TOKEN); en dev / hosts con disco cae a un archivo SQLite local.
 * El mismo código y las mismas queries SQLite funcionan en ambos lados.
 */
export const db = process.env.TURSO_DATABASE_URL
  ? createClient({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
    })
  : createClient({ url: `file:${path.join(here, 'pistachio.db')}` });

// ─── Helpers de acceso (mimetizan prepare().get / all / run) ─────

export async function get<T>(sql: string, args: InArgs = []): Promise<T | undefined> {
  const rs = await db.execute({ sql, args });
  return rs.rows[0] as T | undefined;
}

export async function all<T>(sql: string, args: InArgs = []): Promise<T[]> {
  const rs = await db.execute({ sql, args });
  return rs.rows as unknown as T[];
}

export async function run(sql: string, args: InArgs = []) {
  return db.execute({ sql, args });
}

/** Statements atómicos en una sola ida y vuelta (transacción implícita). */
export async function batch(stmts: InStatement[], mode: 'write' | 'read' = 'write') {
  return db.batch(stmts, mode);
}

// ─── Esquema ─────────────────────────────────────────────────────

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT NOT NULL,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    specialty_id  TEXT,
    plan_id       TEXT,
    totp_secret   TEXT,
    totp_enabled  INTEGER NOT NULL DEFAULT 0,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS two_fa_challenges (
    id         TEXT PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    attempts   INTEGER NOT NULL DEFAULT 0,
    expires_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS specialties (
    id        TEXT PRIMARY KEY,
    name      TEXT NOT NULL,
    full_name TEXT NOT NULL,
    icon      TEXT NOT NULL,
    tagline   TEXT NOT NULL,
    sort      INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS plans (
    id           TEXT PRIMARY KEY,
    specialty_id TEXT NOT NULL REFERENCES specialties(id) ON DELETE CASCADE,
    name         TEXT NOT NULL,
    sort         INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS courses (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    is_slot       INTEGER NOT NULL DEFAULT 0,
    slot_category TEXT,
    hours_json    TEXT,
    req_text      TEXT,
    skills        TEXT,
    offered       TEXT NOT NULL DEFAULT '[]'
  )`,
  `CREATE TABLE IF NOT EXISTS plan_courses (
    plan_id    TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
    course_id  TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    semester   INTEGER NOT NULL,
    credits    INTEGER NOT NULL,
    credit_req INTEGER,
    PRIMARY KEY (plan_id, course_id)
  )`,
  `CREATE TABLE IF NOT EXISTS prerequisites (
    plan_id    TEXT NOT NULL,
    course_id  TEXT NOT NULL,
    prereq_id  TEXT NOT NULL,
    concurrent INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (plan_id, course_id, prereq_id)
  )`,
  `CREATE TABLE IF NOT EXISTS progress (
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_id    TEXT NOT NULL,
    course_id  TEXT NOT NULL,
    status     TEXT NOT NULL CHECK (status IN ('completed', 'in-progress', 'pending')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, plan_id, course_id)
  )`,
  `CREATE TABLE IF NOT EXISTS meta (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`,
];

// ─── Seed del catálogo ───────────────────────────────────────────

interface CatalogCourse {
  id: string;
  name: string;
  credits: number;
  semester: number;
  prerequisites: { id: string; concurrent: boolean }[];
  creditReq: number | null;
  hours: Record<string, number> | null;
  reqText: string | null;
  skills: string | null;
  offered: number[];
  isSlot: boolean;
  slotCategory: string | null;
}

interface Catalog {
  source: string;
  specialties: {
    id: string;
    name: string;
    fullName: string;
    icon: string;
    tagline: string;
    plans: { id: string; name: string; courses: CatalogCourse[] }[];
  }[];
}

/** Ejecuta statements en tandas atómicas (evita batches gigantes). */
async function batchInChunks(statements: InStatement[], size = 400) {
  for (let i = 0; i < statements.length; i += size) {
    await db.batch(statements.slice(i, i + size), 'write');
  }
}

async function seedCatalog(): Promise<void> {
  const data = catalog as Catalog;
  const hash = createHash('sha256').update(JSON.stringify(data)).digest('hex');
  const current = await get<{ value: string }>(`SELECT value FROM meta WHERE key = 'catalog_hash'`);
  if (current?.value === hash) return;

  // Limpia el catálogo previo (no toca usuarios ni progreso).
  await batchInChunks([
    { sql: 'DELETE FROM prerequisites', args: [] },
    { sql: 'DELETE FROM plan_courses', args: [] },
    { sql: 'DELETE FROM courses', args: [] },
    { sql: 'DELETE FROM plans', args: [] },
    { sql: 'DELETE FROM specialties', args: [] },
  ]);

  const stmts: InStatement[] = [];
  data.specialties.forEach((spec, si) => {
    stmts.push({
      sql: `INSERT INTO specialties (id, name, full_name, icon, tagline, sort) VALUES (?, ?, ?, ?, ?, ?)`,
      args: [spec.id, spec.name, spec.fullName, spec.icon, spec.tagline, si],
    });
    spec.plans.forEach((plan, pi) => {
      stmts.push({
        sql: `INSERT INTO plans (id, specialty_id, name, sort) VALUES (?, ?, ?, ?)`,
        args: [plan.id, spec.id, plan.name, pi],
      });
      for (const course of plan.courses) {
        stmts.push({
          sql: `INSERT OR IGNORE INTO courses (id, name, is_slot, slot_category, hours_json, req_text, skills, offered)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            course.id,
            course.name,
            course.isSlot ? 1 : 0,
            course.slotCategory,
            course.hours ? JSON.stringify(course.hours) : null,
            course.reqText,
            course.skills,
            JSON.stringify(course.offered),
          ],
        });
        stmts.push({
          sql: `INSERT INTO plan_courses (plan_id, course_id, semester, credits, credit_req) VALUES (?, ?, ?, ?, ?)`,
          args: [plan.id, course.id, course.semester, course.credits, course.creditReq],
        });
        for (const prereq of course.prerequisites) {
          stmts.push({
            sql: `INSERT OR IGNORE INTO prerequisites (plan_id, course_id, prereq_id, concurrent) VALUES (?, ?, ?, ?)`,
            args: [plan.id, course.id, prereq.id, prereq.concurrent ? 1 : 0],
          });
        }
      }
    });
  });

  await batchInChunks(stmts);
  await run(`INSERT OR REPLACE INTO meta (key, value) VALUES ('catalog_hash', ?)`, [hash]);
  console.log(`[db] catálogo sembrado desde ${data.source}`);
}

// ─── Inicialización perezosa y memoizada ─────────────────────────

let readyPromise: Promise<void> | null = null;

/** Crea el esquema y siembra el catálogo una sola vez por instancia. */
export function ensureReady(): Promise<void> {
  if (!readyPromise) {
    readyPromise = (async () => {
      for (const sql of SCHEMA_STATEMENTS) await db.execute(sql);
      await seedCatalog();
    })().catch((err) => {
      readyPromise = null; // permite reintentar en la próxima request
      throw err;
    });
  }
  return readyPromise;
}
