import type { CourseStatus, Plan } from '@/types';
import { analyzePlan, eligibleCourses, type Term } from './advisor';

/**
 * Horario oficial del próximo semestre (el Excel que la Facultad sube a Canvas).
 * Se parsea en el navegador: el alumno sube su archivo y todo se maneja local,
 * sin servidor ni API. Cruzándolo con la malla, el asistente recomienda ramos
 * que de verdad se dictan y arma un horario sin topes.
 */

export const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'] as const;
export const DAYS_SHORT = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie'] as const;

/** Tipos de reunión que ocupan un bloque semanal (clase / ayudantía, presencial u online). */
const WEEKLY_TYPES = new Set(['CLAS', 'OLIN', 'AYUD', 'AYON']);

export interface Meeting {
  /** 0 = lunes … 4 = viernes. */
  day: number;
  /** Minutos desde medianoche. */
  start: number;
  end: number;
  type: string;
  room: string;
}

export interface Section {
  /** Identificador único de la sección en el sistema (Banner). */
  nrc: string;
  /** Código del ramo, ej. "IOC5206" (coincide con el id del catálogo). */
  code: string;
  title: string;
  section: string;
  professor: string;
  meetings: Meeting[];
}

export interface Offering {
  /** Código del período, ej. "202620". */
  term: string;
  label: string;
  uploadedAt: string;
  fileName: string;
  sections: Section[];
  /** Secciones agrupadas por código de ramo. */
  byCourse: Record<string, Section[]>;
}

const norm = (v: unknown) => (v == null ? '' : String(v).trim());

/** "8:30-10:20" → { start: 510, end: 620 }. Devuelve null si no calza. */
function parseTimeRange(raw: string): { start: number; end: number } | null {
  const m = raw.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const start = Number(m[1]) * 60 + Number(m[2]);
  const end = Number(m[3]) * 60 + Number(m[4]);
  return end > start ? { start, end } : null;
}

export function minutesToHHMM(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
}

/** Etiqueta legible del período a partir del código Banner (202620 → 2.º sem 2026). */
function termLabel(term: string): string {
  const m = term.match(/(\d{4})(\d{2})/);
  if (!m) return term;
  const half = m[2] === '20' ? '2.º' : m[2] === '10' ? '1.er' : m[2];
  return `${half} semestre ${m[1]}`;
}

/**
 * Parsea el Excel de horario (hoja "HORARIO") en el navegador. Carga SheetJS de
 * forma diferida para no engordar el bundle inicial.
 */
export async function parseHorario(data: ArrayBuffer, fileName: string): Promise<Offering> {
  const XLSX = await import('xlsx');
  const wb = XLSX.read(data, { type: 'array' });
  const sheetName = wb.SheetNames.find((n) => n.toUpperCase().includes('HORARIO')) ?? wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null, raw: false });

  const headerRow = rows.findIndex(
    (r) => Array.isArray(r) && r.includes('NRC') && r.includes('MATERIA') && r.includes('SECC.'),
  );
  if (headerRow < 0) {
    throw new Error('No reconozco este archivo. Sube el Excel de horario oficial de la Facultad.');
  }
  const header = rows[headerRow] as unknown[];
  const col: Record<string, number> = {};
  header.forEach((c, i) => {
    if (c != null) col[String(c).trim()] = i;
  });
  const need = ['NRC', 'MATERIA', 'CURSO', 'SECC.', 'TITULO', 'TIPO DE REUNION'];
  for (const k of need) {
    if (col[k] == null) throw new Error('El archivo no tiene el formato esperado del horario.');
  }
  const dayCols = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes'].map((d) => col[d]);

  const sections = new Map<string, Section>();
  for (let r = headerRow + 1; r < rows.length; r++) {
    const row = rows[r] as unknown[];
    if (!Array.isArray(row)) continue;
    const nrc = norm(row[col['NRC']]);
    if (!nrc) continue;
    const code = (norm(row[col['MATERIA']]) + norm(row[col['CURSO']])).toUpperCase();
    if (!sections.has(nrc)) {
      sections.set(nrc, {
        nrc,
        code,
        title: norm(row[col['TITULO']]),
        section: norm(row[col['SECC.']]),
        professor: norm(row[col['PROFESOR']]),
        meetings: [],
      });
    }
    const type = norm(row[col['TIPO DE REUNION']]).toUpperCase();
    if (!WEEKLY_TYPES.has(type)) continue;
    const room = col['SALA'] != null ? norm(row[col['SALA']]) : '';
    for (let d = 0; d < 5; d++) {
      const ci = dayCols[d];
      if (ci == null) continue;
      const range = parseTimeRange(norm(row[ci]));
      if (range) sections.get(nrc)!.meetings.push({ day: d, ...range, type, room });
    }
  }

  const list = [...sections.values()];
  const byCourse: Record<string, Section[]> = {};
  for (const s of list) {
    (byCourse[s.code] ??= []).push(s);
  }

  const term = (fileName.match(/(\d{6})/)?.[1]) ?? '';
  return {
    term,
    label: term ? termLabel(term) : 'Próximo semestre',
    uploadedAt: new Date().toISOString(),
    fileName,
    sections: list,
    byCourse,
  };
}

// ─── Detección de topes y armado de horario ─────────────────────

const overlap = (a: Meeting, b: Meeting) =>
  a.day === b.day && a.start < b.end && b.start < a.end;

/** ¿Dos secciones chocan en algún bloque semanal? */
export function sectionsConflict(a: Section, b: Section): boolean {
  return a.meetings.some((m) => b.meetings.some((n) => overlap(m, n)));
}

export interface ScheduledCourse {
  code: string;
  title: string;
  credits: number;
  section: Section;
  /** Otras secciones del mismo ramo, para poder cambiar. */
  options: Section[];
}

export interface AutoSchedule {
  courses: ScheduledCourse[];
  totalSct: number;
  /** Ramos elegibles y ofrecidos que no cupieron sin tope de horario. */
  unschedulable: { code: string; title: string }[];
}

/** ¿La sección `s` choca con alguna de las ya elegidas? */
export function conflictsWith(s: Section, chosen: Section[]): boolean {
  return chosen.some((c) => c.nrc !== s.nrc && sectionsConflict(s, c));
}

/**
 * Arma automáticamente un horario sin topes: toma los ramos que el alumno puede
 * y que de verdad se dictan (según el Excel), priorizados por cuánto desbloquean,
 * y elige para cada uno una sección que no choque con las ya agregadas.
 */
export function buildAutoSchedule(
  plan: Plan,
  statuses: Record<string, CourseStatus>,
  offering: Offering,
  term: Term,
  maxSct = 30,
): AutoSchedule {
  const advice = eligibleCourses(analyzePlan(plan, statuses, term));
  const courses: ScheduledCourse[] = [];
  const unschedulable: { code: string; title: string }[] = [];
  const chosen: Section[] = [];
  let totalSct = 0;

  for (const a of advice) {
    const options = offering.byCourse[a.course.id];
    if (!options || options.length === 0) continue; // no se dicta el próximo semestre
    if (totalSct + a.course.credits > maxSct) continue;

    const withMeetings = options.filter((s) => s.meetings.length > 0);
    const pool = withMeetings.length > 0 ? withMeetings : options;
    const pick = pool.find((s) => !conflictsWith(s, chosen));
    if (!pick) {
      unschedulable.push({ code: a.course.id, title: a.course.name });
      continue;
    }
    courses.push({
      code: a.course.id,
      title: a.course.name,
      credits: a.course.credits,
      section: pick,
      options: pool,
    });
    chosen.push(pick);
    totalSct += a.course.credits;
  }

  return { courses, totalSct, unschedulable };
}

/** Cuántos ramos del plan del alumno se dictan el próximo semestre. */
export function offeredCountForPlan(plan: Plan, offering: Offering): number {
  return plan.courses.filter((c) => !c.isSlot && offering.byCourse[c.id]?.length).length;
}
