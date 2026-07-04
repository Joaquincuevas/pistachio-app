import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { computeProgress } from '@/lib/utils';
import { useCurriculumStore } from '@/stores/useCurriculumStore';
import type { Plan } from '@/types';

/** Barra de progreso global: ramos completados, porcentaje y créditos SCT. */
export function MallaProgress({ plan }: { plan: Plan }) {
  const progressMap = useCurriculumStore((s) => s.progress);

  const stats = useMemo(
    () => computeProgress(plan, progressMap[plan.id] ?? {}),
    [plan, progressMap],
  );

  return (
    <div className="rounded-card border border-border bg-white p-5 shadow-subtle">
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-tertiary">
            Avance de la malla
          </p>
          <p className="mt-2 flex items-baseline gap-1.5">
            <span className="text-3xl font-semibold tracking-tight tabular-nums text-text-primary">
              {stats.completedCourses}
            </span>
            <span className="text-lg font-medium tabular-nums text-text-tertiary">
              / {stats.totalCourses}
            </span>
            <span className="ml-0.5 text-sm text-text-secondary">ramos</span>
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-2xl font-semibold tracking-tight tabular-nums text-accent">
            {stats.percent}%
          </p>
          <p className="mt-0.5 text-xs tabular-nums text-text-secondary">
            {stats.completedCredits} / {stats.totalCredits} SCT
          </p>
        </div>
      </div>
      <div
        role="progressbar"
        aria-valuenow={stats.percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Avance de la malla"
        className="mt-4 h-2 overflow-hidden rounded-full bg-surface"
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
