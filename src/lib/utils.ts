import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { Course, CourseStatus, Plan, ProgressStats } from '@/types';

/** Combina clases de Tailwind resolviendo conflictos (helper estándar). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const STATUS_LABELS: Record<CourseStatus, string> = {
  completed: 'Cursado',
  'in-progress': 'En progreso',
  pending: 'Pendiente',
};

export const STATUS_COLORS: Record<CourseStatus, string> = {
  completed: '#6BA876',
  'in-progress': '#4A90E2',
  pending: '#C9C9C6',
};

export function computeProgress(
  plan: Plan,
  progress: Record<string, CourseStatus>,
): ProgressStats {
  let completedCourses = 0;
  let inProgressCourses = 0;
  let completedCredits = 0;
  let totalCredits = 0;

  for (const course of plan.courses) {
    totalCredits += course.credits;
    const status = progress[course.id] ?? 'pending';
    if (status === 'completed') {
      completedCourses += 1;
      completedCredits += course.credits;
    } else if (status === 'in-progress') {
      inProgressCourses += 1;
    }
  }

  const totalCourses = plan.courses.length;
  return {
    totalCourses,
    completedCourses,
    inProgressCourses,
    totalCredits,
    completedCredits,
    percent: totalCourses === 0 ? 0 : Math.round((completedCourses / totalCourses) * 100),
  };
}

/** Prácticas (pre-profesional / profesional): se muestran al pie de la malla. */
export function isPractice(course: Course): boolean {
  return course.slotCategory === 'Práctica';
}

/** Agrupa los ramos por semestre; dentro de cada semestre, ramos antes que slots. */
export function groupBySemester(courses: Course[]): Map<number, Course[]> {
  const map = new Map<number, Course[]>();
  const sorted = [...courses].sort(
    (a, b) =>
      a.semester - b.semester ||
      Number(a.isSlot) - Number(b.isSlot) ||
      a.id.localeCompare(b.id),
  );
  for (const course of sorted) {
    const list = map.get(course.semester) ?? [];
    list.push(course);
    map.set(course.semester, list);
  }
  return map;
}

/** Conjunto de prerrequisitos (directos y transitivos) de un ramo dentro del plan. */
export function collectPrerequisites(courseId: string, courses: Course[]): Set<string> {
  const byId = new Map(courses.map((c) => [c.id, c]));
  const result = new Set<string>();
  const visit = (id: string) => {
    const course = byId.get(id);
    if (!course) return;
    for (const prereq of course.prerequisites) {
      if (!result.has(prereq.id)) {
        result.add(prereq.id);
        visit(prereq.id);
      }
    }
  };
  visit(courseId);
  return result;
}

/** Conjunto de ramos que este ramo desbloquea (directa y transitivamente). */
export function collectUnlocks(courseId: string, courses: Course[]): Set<string> {
  const result = new Set<string>();
  const visit = (id: string) => {
    for (const course of courses) {
      if (course.prerequisites.some((p) => p.id === id) && !result.has(course.id)) {
        result.add(course.id);
        visit(course.id);
      }
    }
  };
  visit(courseId);
  return result;
}

export const PISTACHIO_FACT =
  'Botánicamente hablando, el pistacho no es un fruto seco, sino una fruta de hueso (una drupa). Es pariente directo de los mangos y... de la hiedra venenosa.';
