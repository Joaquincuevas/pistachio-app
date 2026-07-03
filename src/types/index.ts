/** Estado de avance de un ramo dentro de la malla del estudiante. */
export type CourseStatus = 'completed' | 'in-progress' | 'pending';

export interface Course {
  /** Código institucional del ramo, ej: "MAT1101". */
  id: string;
  name: string;
  /** Semestre sugerido en la malla (1-10). */
  semester: number;
  credits: number;
  /** Ids de los ramos que deben estar aprobados antes de tomar este. */
  prerequisites: string[];
  description: string;
  objectives: string[];
}

export interface Specialty {
  id: string;
  name: string;
  emoji: string;
  tagline: string;
  courses: Course[];
}

export interface User {
  name: string;
  email: string;
  /** ISO date de creación de la cuenta. */
  createdAt: string;
}

export interface ProgressStats {
  totalCourses: number;
  completedCourses: number;
  inProgressCourses: number;
  totalCredits: number;
  completedCredits: number;
  /** Porcentaje de ramos completados (0-100). */
  percent: number;
}
