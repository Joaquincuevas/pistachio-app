import { useState } from 'react';
import { GitBranch, LayoutGrid } from 'lucide-react';
import { MallaGraph } from '@/components/malla/MallaGraph';
import { MallaGrid } from '@/components/malla/MallaGrid';
import { MallaProgress } from '@/components/malla/MallaProgress';
import { PageTransition } from '@/components/ui/PageTransition';
import { getSpecialty } from '@/data/curriculum';
import { cn } from '@/lib/utils';
import { useCurriculumStore } from '@/stores/useCurriculumStore';

type ViewMode = 'grid' | 'graph';

const modes: { value: ViewMode; label: string; icon: typeof LayoutGrid }[] = [
  { value: 'grid', label: 'Grid', icon: LayoutGrid },
  { value: 'graph', label: 'Grafo', icon: GitBranch },
];

/** Pantalla estrella: la malla, en vista grid o grafo de dependencias. */
export function Dashboard() {
  const specialtyId = useCurriculumStore((s) => s.specialtyId);
  const specialty = getSpecialty(specialtyId);

  // El grafo brilla en pantallas grandes; en mobile parte en grid.
  const [mode, setMode] = useState<ViewMode>(() =>
    window.matchMedia('(min-width: 768px)').matches ? 'graph' : 'grid',
  );

  if (!specialty) return null;

  const header = (
    <div className="shrink-0 px-4 pt-4 md:px-8 md:pt-8">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl text-text-primary md:text-3xl">Mi malla</h1>
          <p className="mt-0.5 truncate text-sm text-text-secondary">
            {specialty.emoji} Ingeniería Civil {specialty.name}
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

      <div className="mt-4">
        <MallaProgress specialty={specialty} />
      </div>
    </div>
  );

  if (mode === 'graph') {
    return (
      <PageTransition className="flex h-full flex-col">
        {header}
        <div className="mt-4 min-h-0 flex-1">
          <MallaGraph specialty={specialty} />
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      {header}
      <div className="px-4 pt-4 md:px-8">
        <MallaGrid specialty={specialty} />
      </div>
    </PageTransition>
  );
}
