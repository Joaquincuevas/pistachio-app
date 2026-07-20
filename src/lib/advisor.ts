import type { Course, CourseStatus, Plan } from '@/types';
import { collectUnlocks } from './utils';

/**
 * Motor de recomendación de ramos: reglas exactas sobre la malla (grafo de
 * prerrequisitos + créditos + semestre en que se dicta). Sin IA ni API: es
 * determinístico, explicable y funciona offline. La "verdad" es el catálogo.
 */

export type Term = 1 | 2;

export interface CourseAdvice {
  course: Course;
  /** Se puede tomar el semestre elegido (prereqs + créditos + se dicta + pendiente). */
  eligible: boolean;
  /** Se dicta en el semestre (par/impar) consultado. */
  offeredThisTerm: boolean;
  /** Prerrequisitos aún no cumplidos (para explicar por qué está bloqueado). */
  missingPrereqs: Course[];
  /** Créditos que faltan para cumplir el requisito de créditos, si aplica. */
  creditsShort: number;
  /** Cuántos ramos desbloquea (directa y transitivamente): mide su prioridad. */
  unlocks: number;
}

export interface Recommendation {
  picks: CourseAdvice[];
  totalSct: number;
}

const isCompleted = (progress: Record<string, CourseStatus>, id: string) =>
  progress[id] === 'completed';

/** Suma de créditos SCT de los ramos ya cursados. */
export function completedCredits(plan: Plan, progress: Record<string, CourseStatus>): number {
  return plan.courses.reduce(
    (sum, c) => (progress[c.id] === 'completed' ? sum + c.credits : sum),
    0,
  );
}

const offeredIn = (course: Course, term: Term) =>
  !course.offered || course.offered.length === 0 || course.offered.includes(term);

/**
 * Analiza cada ramo del plan y devuelve su elegibilidad para el semestre `term`.
 * Un ramo es elegible si está pendiente, se dicta ese semestre, cumple el
 * requisito de créditos y todos sus prerrequisitos están satisfechos. Un
 * prerrequisito marcado como concurrente ("en paralelo") se satisface si ya
 * está cursado o si podría tomarse ese mismo semestre.
 */
export function analyzePlan(
  plan: Plan,
  progress: Record<string, CourseStatus>,
  term: Term,
): CourseAdvice[] {
  const byId = new Map(plan.courses.map((c) => [c.id, c]));
  const credits = completedCredits(plan, progress);

  const creditMet = (c: Course) => c.creditReq == null || credits >= c.creditReq;

  // ¿El ramo podría tomarse este semestre en paralelo? (aprox. de 1 nivel para
  // resolver requisitos concurrentes sin recursión infinita).
  const takeableInParallel = (c: Course): boolean =>
    offeredIn(c, term) && creditMet(c) && c.prerequisites.every((p) => isCompleted(progress, p.id));

  const prereqSatisfied = (p: { id: string; concurrent: boolean }): boolean => {
    if (isCompleted(progress, p.id)) return true;
    if (!p.concurrent) return false;
    const pc = byId.get(p.id);
    return pc ? takeableInParallel(pc) : false;
  };

  return plan.courses.map((course) => {
    const missingPrereqs = course.prerequisites
      .filter((p) => !prereqSatisfied(p))
      .map((p) => byId.get(p.id))
      .filter((c): c is Course => Boolean(c));
    const creditsShort =
      course.creditReq != null ? Math.max(0, course.creditReq - credits) : 0;
    const offeredThisTerm = offeredIn(course, term);
    const pending = (progress[course.id] ?? 'pending') === 'pending';
    const eligible =
      pending && offeredThisTerm && creditsShort === 0 && missingPrereqs.length === 0;

    return {
      course,
      eligible,
      offeredThisTerm,
      missingPrereqs,
      creditsShort,
      unlocks: collectUnlocks(course.id, plan.courses).size,
    };
  });
}

/** Ramos que ya se pueden tomar, ordenados por prioridad (desbloquean más). */
export function eligibleCourses(advice: CourseAdvice[]): CourseAdvice[] {
  return advice
    .filter((a) => a.eligible)
    .sort(
      (a, b) =>
        b.unlocks - a.unlocks ||
        a.course.semester - b.course.semester ||
        b.course.credits - a.course.credits,
    );
}

/**
 * Arma una carga equilibrada para el próximo semestre: prioriza los ramos que
 * desbloquean más (ruta crítica), respetando un tope de créditos y de ramos.
 */
export function recommendSemester(
  advice: CourseAdvice[],
  maxSct = 30,
  maxCourses = 6,
): Recommendation {
  const picks: CourseAdvice[] = [];
  let totalSct = 0;
  for (const a of eligibleCourses(advice)) {
    if (picks.length >= maxCourses) break;
    if (totalSct + a.course.credits > maxSct) continue;
    picks.push(a);
    totalSct += a.course.credits;
  }
  return { picks, totalSct };
}

/** El ramo elegible más importante de destrabar (mayor desbloqueo). */
export function topPriority(advice: CourseAdvice[]): CourseAdvice | null {
  return eligibleCourses(advice)[0] ?? null;
}

/** Consulta puntual: ¿puedo tomar este ramo el semestre `term`? */
export function adviceFor(advice: CourseAdvice[], courseId: string): CourseAdvice | undefined {
  return advice.find((a) => a.course.id === courseId);
}

/**
 * Cadena completa de prerrequisitos (transitivos) que aún faltan para un ramo,
 * ordenada por semestre sugerido (lo más temprano primero).
 */
export function collectMissing(
  courseId: string,
  courses: Course[],
  progress: Record<string, CourseStatus>,
): Course[] {
  const byId = new Map(courses.map((c) => [c.id, c]));
  const missing = new Map<string, Course>();
  const visit = (id: string) => {
    const course = byId.get(id);
    if (!course) return;
    for (const p of course.prerequisites) {
      if (progress[p.id] === 'completed' || missing.has(p.id)) continue;
      const pc = byId.get(p.id);
      if (!pc) continue;
      missing.set(p.id, pc);
      visit(p.id);
    }
  };
  visit(courseId);
  return [...missing.values()].sort((a, b) => a.semester - b.semester || a.id.localeCompare(b.id));
}

// ─── Ruta a titularte (planificación multi-semestre) ─────────────

export interface PlannedSemester {
  /** 1 = el próximo semestre, 2 = el siguiente… */
  index: number;
  term: Term;
  courses: Course[];
  totalSct: number;
}

export interface GraduationPlan {
  semesters: PlannedSemester[];
  /** Total de semestres que faltan para titularse. */
  totalSemesters: number;
  /** Ramos que no se lograron ubicar (datos incompletos o requisitos imposibles). */
  unplaceable: Course[];
  /** Ramos pendientes al empezar la proyección. */
  remainingCourses: number;
}

/**
 * Proyecta TODOS los semestres que faltan hasta titularse.
 *
 * Simula la malla hacia adelante: en cada semestre toma los ramos elegibles
 * (prerrequisitos cumplidos, créditos suficientes y que se dicten ese semestre)
 * priorizando los que más desbloquean, los marca como cursados y avanza al
 * semestre siguiente alternando 1.º/2.º. Es la misma lógica de elegibilidad que
 * usa el resto del asistente, así que la proyección nunca viola un requisito.
 *
 * Los ramos "en curso" se cuentan como aprobados: terminan este semestre.
 */
export function planToGraduation(
  plan: Plan,
  progress: Record<string, CourseStatus>,
  startTerm: Term,
  maxSct = 30,
  maxCourses = 6,
  maxSemesters = 20,
): GraduationPlan {
  // Estado simulado: lo cursado y lo que está por terminar cuentan como listo.
  const sim: Record<string, CourseStatus> = {};
  for (const c of plan.courses) {
    const st = progress[c.id];
    if (st === 'completed' || st === 'in-progress') sim[c.id] = 'completed';
  }

  const pendingAtStart = plan.courses.filter((c) => sim[c.id] !== 'completed');
  const semesters: PlannedSemester[] = [];
  let term = startTerm;

  for (let index = 1; index <= maxSemesters; index++) {
    if (plan.courses.every((c) => sim[c.id] === 'completed')) break;

    const picks: Course[] = [];
    let totalSct = 0;
    for (const a of eligibleCourses(analyzePlan(plan, sim, term))) {
      if (picks.length >= maxCourses) break;
      if (totalSct + a.course.credits > maxSct) continue;
      picks.push(a.course);
      totalSct += a.course.credits;
    }

    // Sin ramos elegibles: o ya terminó, o lo que queda no se puede ubicar.
    if (picks.length === 0) {
      // Puede que este semestre no se dicte nada elegible pero el siguiente sí:
      // probamos el otro semestre antes de rendirnos.
      const other = term === 1 ? 2 : 1;
      const otherPicks = eligibleCourses(analyzePlan(plan, sim, other));
      if (otherPicks.length === 0) break;
      term = other;
      index--;
      continue;
    }

    for (const c of picks) sim[c.id] = 'completed';
    semesters.push({ index: semesters.length + 1, term, courses: picks, totalSct });
    term = term === 1 ? 2 : 1;
  }

  return {
    semesters,
    totalSemesters: semesters.length,
    unplaceable: plan.courses.filter((c) => sim[c.id] !== 'completed'),
    remainingCourses: pendingAtStart.length,
  };
}

/** Semestre académico por defecto según la fecha (2.º sem ~ jun-nov en Chile). */
export function defaultTerm(date = new Date()): Term {
  const m = date.getMonth();
  return m >= 5 && m <= 10 ? 2 : 1;
}
