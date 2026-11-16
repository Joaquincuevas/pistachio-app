import { useMemo } from 'react';
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

  const base = specialties.find((s) => s.id === specialtyId);
  const plan = base?.plans.find((p) => p.id === planId);
  // El nombre de la especialidad puede cambiar entre versiones del plan
  // (ICA se llama Ambiental en PE 2022 y Química en PE 2025).
  const specialty = useMemo(
    () =>
      base && plan && (plan.specialtyName || plan.specialtyFullName)
        ? {
            ...base,
            name: plan.specialtyName ?? base.name,
            fullName: plan.specialtyFullName ?? base.fullName,
          }
        : base,
    [base, plan],
  );

  return { specialty, plan, loading: status === 'idle' || status === 'loading' };
}
