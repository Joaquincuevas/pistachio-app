import { useCatalogStore } from '@/stores/useCatalogStore';
import { useCurriculumStore } from '@/stores/useCurriculumStore';
import type { Plan, Specialty } from '@/types';

interface ActivePlan {
  specialty: Specialty | undefined;
  plan: Plan | undefined;
  /** true mientras el catálogo aún no llega desde la API. */
  loading: boolean;
}

/** Especialidad y plan de estudios activos del usuario, desde el catálogo. */
export function useActivePlan(): ActivePlan {
  const specialtyId = useCurriculumStore((s) => s.specialtyId);
  const planId = useCurriculumStore((s) => s.planId);
  const specialties = useCatalogStore((s) => s.specialties);
  const status = useCatalogStore((s) => s.status);

  const specialty = specialties.find((s) => s.id === specialtyId);
  const plan = specialty?.plans.find((p) => p.id === planId);

  return { specialty, plan, loading: status === 'idle' || status === 'loading' };
}
