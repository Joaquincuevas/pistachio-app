import Database from 'better-sqlite3';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export const db = new Database(path.join(here, 'pistachio.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT NOT NULL,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    specialty_id  TEXT,
    plan_id       TEXT,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS specialties (
    id        TEXT PRIMARY KEY,
    name      TEXT NOT NULL,
    full_name TEXT NOT NULL,
    emoji     TEXT NOT NULL,
    tagline   TEXT NOT NULL,
    sort      INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS plans (
    id           TEXT PRIMARY KEY,
    specialty_id TEXT NOT NULL REFERENCES specialties(id) ON DELETE CASCADE,
    name         TEXT NOT NULL,
    sort         INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS courses (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    is_slot       INTEGER NOT NULL DEFAULT 0,
    slot_category TEXT,
    hours_json    TEXT,
    req_text      TEXT,
    skills        TEXT,
    offered       TEXT NOT NULL DEFAULT '[]'
  );

  CREATE TABLE IF NOT EXISTS plan_courses (
    plan_id    TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
    course_id  TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    semester   INTEGER NOT NULL,
    credits    INTEGER NOT NULL,
    credit_req INTEGER,
    PRIMARY KEY (plan_id, course_id)
  );

  CREATE TABLE IF NOT EXISTS prerequisites (
    plan_id    TEXT NOT NULL,
    course_id  TEXT NOT NULL,
    prereq_id  TEXT NOT NULL,
    concurrent INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (plan_id, course_id, prereq_id)
  );

  CREATE TABLE IF NOT EXISTS progress (
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_id    TEXT NOT NULL,
    course_id  TEXT NOT NULL,
    status     TEXT NOT NULL CHECK (status IN ('completed', 'in-progress', 'pending')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, plan_id, course_id)
  );

  CREATE TABLE IF NOT EXISTS meta (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

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
    emoji: string;
    tagline: string;
    plans: { id: string; name: string; courses: CatalogCourse[] }[];
  }[];
}

/**
 * Siembra el catálogo desde catalog.json (generado por scripts/parse-catalog.py).
 * Se re-siembra automáticamente cuando el JSON cambia (hash distinto), sin tocar
 * usuarios ni progreso.
 */
function seedCatalog() {
  const raw = readFileSync(path.join(here, 'data', 'catalog.json'), 'utf-8');
  const hash = createHash('sha256').update(raw).digest('hex');
  const current = db.prepare(`SELECT value FROM meta WHERE key = 'catalog_hash'`).get() as
    | { value: string }
    | undefined;
  if (current?.value === hash) return;

  const catalog = JSON.parse(raw) as Catalog;

  const seed = db.transaction(() => {
    db.exec(`
      DELETE FROM prerequisites;
      DELETE FROM plan_courses;
      DELETE FROM courses;
      DELETE FROM plans;
      DELETE FROM specialties;
    `);

    const insSpec = db.prepare(
      `INSERT INTO specialties (id, name, full_name, emoji, tagline, sort) VALUES (?, ?, ?, ?, ?, ?)`,
    );
    const insPlan = db.prepare(
      `INSERT INTO plans (id, specialty_id, name, sort) VALUES (?, ?, ?, ?)`,
    );
    // Upsert sin DELETE: los ramos del plan común se repiten entre planes y un
    // OR REPLACE dispararía el ON DELETE CASCADE de plan_courses.
    const insCourse = db.prepare(
      `INSERT INTO courses (id, name, is_slot, slot_category, hours_json, req_text, skills, offered)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (id) DO NOTHING`,
    );
    const insPlanCourse = db.prepare(
      `INSERT INTO plan_courses (plan_id, course_id, semester, credits, credit_req) VALUES (?, ?, ?, ?, ?)`,
    );
    const insPrereq = db.prepare(
      `INSERT OR IGNORE INTO prerequisites (plan_id, course_id, prereq_id, concurrent) VALUES (?, ?, ?, ?)`,
    );

    catalog.specialties.forEach((spec, si) => {
      insSpec.run(spec.id, spec.name, spec.fullName, spec.emoji, spec.tagline, si);
      spec.plans.forEach((plan, pi) => {
        insPlan.run(plan.id, spec.id, plan.name, pi);
        for (const course of plan.courses) {
          insCourse.run(
            course.id,
            course.name,
            course.isSlot ? 1 : 0,
            course.slotCategory,
            course.hours ? JSON.stringify(course.hours) : null,
            course.reqText,
            course.skills,
            JSON.stringify(course.offered),
          );
          insPlanCourse.run(plan.id, course.id, course.semester, course.credits, course.creditReq);
          for (const prereq of course.prerequisites) {
            insPrereq.run(plan.id, course.id, prereq.id, prereq.concurrent ? 1 : 0);
          }
        }
      });
    });

    db.prepare(`INSERT OR REPLACE INTO meta (key, value) VALUES ('catalog_hash', ?)`).run(hash);
  });

  seed();
  console.log(`[db] catálogo sembrado desde ${catalog.source}`);
}

seedCatalog();
