import pg from 'pg';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import catalog from './data/catalog.json' with { type: 'json' };

const here = path.dirname(fileURLToPath(import.meta.url));

/** Mínimo común entre `pg` (Supabase) y `pglite` (dev embebido). */
interface Queryable {
  query(sql: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}

/**
 * En producción usa Postgres de Supabase (DATABASE_URL, el pooler de
 * transacciones). En dev, un Postgres embebido en proceso (pglite) — mismo
 * dialecto SQL, sin instalar nada. El import de pglite es dinámico y con
 * especificador variable para que NO entre al bundle serverless de Vercel.
 */
async function initDb(): Promise<Queryable> {
  if (process.env.DATABASE_URL) {
    const pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      max: 3,
      ssl: { rejectUnauthorized: false },
    });
    return { query: (sql, params) => pool.query(sql, params) };
  }
  const spec = '@electric-sql/pglite';
  const { PGlite } = (await import(spec)) as typeof import('@electric-sql/pglite');
  const lite = new PGlite(path.join(here, 'pgdata'));
  await lite.waitReady;
  return { query: (sql, params) => lite.query(sql, params) as Promise<{ rows: Record<string, unknown>[] }> };
}

let _db: Queryable | null = null;
function impl(): Queryable {
  if (!_db) throw new Error('DB no inicializada — llama ensureReady() primero.');
  return _db;
}

/** Convierte los placeholders `?` (estilo SQLite) a `$1, $2, …` de Postgres. */
function toPg(sql: string): string {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

// ─── Helpers de acceso ───────────────────────────────────────────

export async function get<T>(sql: string, args: unknown[] = []): Promise<T | undefined> {
  const rs = await impl().query(toPg(sql), args);
  return rs.rows[0] as T | undefined;
}

export async function all<T>(sql: string, args: unknown[] = []): Promise<T[]> {
  const rs = await impl().query(toPg(sql), args);
  return rs.rows as unknown as T[];
}

export async function run(sql: string, args: unknown[] = []) {
  return impl().query(toPg(sql), args);
}

/** INSERT masivo multi-fila (una query por tabla), troceado por límite de params. */
async function insertRows(table: string, cols: string[], rows: unknown[][], suffix = '') {
  if (rows.length === 0) return;
  const perChunk = Math.max(1, Math.floor(40000 / cols.length));
  for (let i = 0; i < rows.length; i += perChunk) {
    const chunk = rows.slice(i, i + perChunk);
    const params: unknown[] = [];
    const tuples = chunk.map((row) => {
      const ph = row.map((val) => {
        params.push(val);
        return `$${params.length}`;
      });
      return `(${ph.join(', ')})`;
    });
    await impl().query(
      `INSERT INTO ${table} (${cols.join(', ')}) VALUES ${tuples.join(', ')} ${suffix}`,
      params,
    );
  }
}

// ─── Esquema (Postgres) ──────────────────────────────────────────

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS users (
    id            SERIAL PRIMARY KEY,
    name          TEXT NOT NULL,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    specialty_id  TEXT,
    plan_id       TEXT,
    totp_secret   TEXT,
    totp_enabled  INTEGER NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS two_fa_challenges (
    id         TEXT PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    attempts   INTEGER NOT NULL DEFAULT 0,
    expires_at TIMESTAMPTZ NOT NULL
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
  // Menciones: un plan de mención referencia su plan base (NULL = plan base).
  `ALTER TABLE plans ADD COLUMN IF NOT EXISTS mention_of TEXT`,
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
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
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
    plans: { id: string; name: string; mentionOf?: string | null; courses: CatalogCourse[] }[];
  }[];
}

async function seedCatalog(): Promise<void> {
  const data = catalog as Catalog;
  const hash = createHash('sha256').update(JSON.stringify(data)).digest('hex');
  const current = await get<{ value: string }>(`SELECT value FROM meta WHERE key = 'catalog_hash'`);
  if (current?.value === hash) return;

  // Limpia el catálogo previo (no toca usuarios ni progreso).
  for (const table of ['prerequisites', 'plan_courses', 'courses', 'plans', 'specialties']) {
    await impl().query(`DELETE FROM ${table}`);
  }

  const specRows: unknown[][] = [];
  const planRows: unknown[][] = [];
  const courseById = new Map<string, unknown[]>();
  const planCourseRows: unknown[][] = [];
  const prereqSet = new Set<string>();
  const prereqRows: unknown[][] = [];

  data.specialties.forEach((spec, si) => {
    specRows.push([spec.id, spec.name, spec.fullName, spec.icon, spec.tagline, si]);
    spec.plans.forEach((plan, pi) => {
      planRows.push([plan.id, spec.id, plan.name, pi, plan.mentionOf ?? null]);
      for (const course of plan.courses) {
        if (!courseById.has(course.id)) {
          courseById.set(course.id, [
            course.id,
            course.name,
            course.isSlot ? 1 : 0,
            course.slotCategory,
            course.hours ? JSON.stringify(course.hours) : null,
            course.reqText,
            course.skills,
            JSON.stringify(course.offered),
          ]);
        }
        planCourseRows.push([plan.id, course.id, course.semester, course.credits, course.creditReq]);
        for (const prereq of course.prerequisites) {
          const key = `${plan.id}:${course.id}:${prereq.id}`;
          if (!prereqSet.has(key)) {
            prereqSet.add(key);
            prereqRows.push([plan.id, course.id, prereq.id, prereq.concurrent ? 1 : 0]);
          }
        }
      }
    });
  });

  await insertRows('specialties', ['id', 'name', 'full_name', 'icon', 'tagline', 'sort'], specRows);
  await insertRows('plans', ['id', 'specialty_id', 'name', 'sort', 'mention_of'], planRows);
  await insertRows(
    'courses',
    ['id', 'name', 'is_slot', 'slot_category', 'hours_json', 'req_text', 'skills', 'offered'],
    [...courseById.values()],
    'ON CONFLICT DO NOTHING',
  );
  await insertRows(
    'plan_courses',
    ['plan_id', 'course_id', 'semester', 'credits', 'credit_req'],
    planCourseRows,
  );
  await insertRows(
    'prerequisites',
    ['plan_id', 'course_id', 'prereq_id', 'concurrent'],
    prereqRows,
    'ON CONFLICT DO NOTHING',
  );

  await run(
    `INSERT INTO meta (key, value) VALUES ('catalog_hash', ?)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [hash],
  );
  console.log(`[db] catálogo sembrado desde ${data.source}`);
}

// ─── Inicialización perezosa y memoizada ─────────────────────────

let readyPromise: Promise<void> | null = null;

/** Conecta, crea el esquema y siembra el catálogo una vez por instancia. */
export function ensureReady(): Promise<void> {
  if (!readyPromise) {
    readyPromise = (async () => {
      _db = await initDb();
      for (const sql of SCHEMA_STATEMENTS) await _db.query(sql);
      await seedCatalog();
    })().catch((err) => {
      readyPromise = null; // permite reintentar en la próxima request
      throw err;
    });
  }
  return readyPromise;
}
