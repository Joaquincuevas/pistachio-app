import { useState } from 'react';
import { GitBranch, LayoutGrid } from 'lucide-react';
import { MallaGraph } from '@/components/malla/MallaGraph';
import { MallaGrid } from '@/components/malla/MallaGrid';
import { MallaProgress } from '@/components/malla/MallaProgress';
import { MencionSwitcher } from '@/components/malla/MencionSwitcher';
import { PageTransition } from '@/components/ui/PageTransition';
import { Skeleton } from '@/components/ui/Skeleton';
import { useActivePlan } from '@/hooks/useActivePlan';
import { cn } from '@/lib/utils';

type ViewMode = 'grid' | 'graph';

const modes: { value: ViewMode; label: string; icon: typeof LayoutGrid }[] = [
  { value: 'grid', label: 'Grid', icon: LayoutGrid },
  { value: 'graph', label: 'Grafo', icon: GitBranch },
];

/** Pantalla estrella: la malla del plan de estudios, en grid o grafo. */
export function Dashboard() {
  const { specialty, plan, loading } = useActivePlan();

  // El grafo brilla en pantallas grandes; en mobile parte en grid.
  const [mode, setMode] = useState<ViewMode>(() =>
    window.matchMedia('(min-width: 768px)').matches ? 'graph' : 'grid',
  );

  if (loading) {
    return (
      <div className="px-4 pt-4 md:px-8 md:pt-8">
        <Skeleton className="h-8 w-44" />
        <Skeleton className="mt-2 h-4 w-64" />
        <Skeleton className="mt-5 h-20 rounded-card" />
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-card" />
          ))}
        </div>
      </div>
    );
  }

  if (!specialty || !plan) return null;

  const header = (
    <div className="shrink-0 px-4 pt-4 md:px-8 md:pt-8">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-text-primary md:text-3xl">
            Mi malla
          </h1>
          <p className="mt-0.5 truncate text-sm text-text-secondary">
            {specialty.fullName} · {plan.name}
          </p>
        </div>

        {/* Toggle grid / grafo */}
        <div
          role="group"
          aria-label="Modo de visualización"
          className="flex shrink-0 rounded-btn border border-border bg-white p-1 shadow-subtle"
        >
          {modes.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              aria-pressed={mode === value}
              onClick={() => setMode(value)}
              className={cn(
                'flex h-9 items-center gap-1.5 rounded-[9px] px-3 text-xs font-medium transition-colors',
                mode === value
                  ? 'bg-accent-light text-accent-hover'
                  : 'text-text-secondary hover:text-text-primary',
              )}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3">
        <MencionSwitcher />
      </div>

      <div className="mt-4">
        <MallaProgress plan={plan} />
      </div>
    </div>
  );

  if (mode === 'graph') {
    return (
      <PageTransition className="flex h-full flex-col">
        {header}
        <div className="mt-4 min-h-0 flex-1">
          <MallaGraph plan={plan} />
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      {header}
      <div className="px-4 pt-4 md:px-8">
        <MallaGrid plan={plan} />
      </div>
    </PageTransition>
  );
}
