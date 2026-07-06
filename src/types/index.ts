/** Estado de avance de un ramo dentro del plan del estudiante. */
export type CourseStatus = 'completed' | 'in-progress' | 'pending';

export interface Prerequisite {
  /** Código del ramo requerido, ej: "ING1202". */
  id: string;
  /** true si el catálogo permite cursarlo en paralelo ("(p)"). */
  concurrent: boolean;
}

/** Desglose de horas semanales según el catálogo oficial. */
export interface CourseHours {
  clases: number;
  ayudantias: number;
  laboratorio: number;
  trabajos: number;
  presentaciones: number;
  lecturas: number;
  estudio: number;
  total: number;
}

export interface Course {
  /** Código institucional (ej: "ICC3204") o id de slot (ej: "ELE1"). */
  id: string;
  name: string;
  /** Créditos SCT-Chile. */
  credits: number;
  /** Semestre sugerido en la malla (1-11). */
  semester: number;
  prerequisites: Prerequisite[];
  /** Requisito de créditos aprobados (ej: 276 para Proyecto de Título 1). */
  creditReq: number | null;
  hours: CourseHours | null;
  /** Texto de requisitos tal como aparece en el catálogo. */
  reqText: string | null;
  /** Habilidades transversales del catálogo (ej: "Ic(Oa)"). */
  skills: string | null;
  /** Semestres del año en que se dicta: 1 y/o 2. */
  offered: number[];
  /** true para cupos genéricos: Teología, Minor, Electivos, Concentración. */
  isSlot: boolean;
  slotCategory: string | null;
}

export interface Plan {
  id: string;
  name: string;
  /** Si es un plan de mención, el id del plan base al que pertenece; null/undefined si es base. */
  mentionOf?: string | null;
  courses: Course[];
}

export interface Specialty {
  id: string;
  name: string;
  fullName: string;
  /** Identificador del icono de línea (ver SpecialtyIcon). */
  icon: string;
  tagline: string;
  plans: Plan[];
}

export interface User {
  id: number;
  name: string;
  email: string;
  createdAt: string;
  twoFactorEnabled: boolean;
}

export interface UserSettings {
  specialtyId: string | null;
  planId: string | null;
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
