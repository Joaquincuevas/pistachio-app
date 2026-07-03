import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { computeProgress } from '@/lib/utils';
import { useCurriculumStore } from '@/stores/useCurriculumStore';
import type { Specialty } from '@/types';

/** Barra de progreso global: ramos completados, porcentaje y créditos. */
export function MallaProgress({ specialty }: { specialty: Specialty }) {
  const progressMap = useCurriculumStore((s) => s.progress);

  const stats = useMemo(
    () => computeProgress(specialty, progressMap[specialty.id] ?? {}),
    [specialty, progressMap],
  );

  return (
    <div className="rounded-card border border-border bg-white p-4 shadow-subtle">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-sm text-text-primary">
          Has completado{' '}
          <span className="font-semibold">
            {stats.completedCourses} de {stats.totalCourses}
          </span>{' '}
          ramos <span className="text-text-secondary">({stats.percent}%)</span>
        </p>
        <p className="text-xs text-text-secondary">
          {stats.completedCredits} / {stats.totalCredits} créditos aprobados
        </p>
      </div>
      <div
        role="progressbar"
        aria-valuenow={stats.percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Avance de la malla"
        className="mt-3 h-2 overflow-hidden rounded-full bg-border/70"
      >
        <motion.div
          className="h-full rounded-full bg-accent"
          initial={false}
          animate={{ width: `${stats.percent}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}
