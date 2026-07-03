import { useMemo, useState } from 'react';
import { Search as SearchIcon, SearchX, X } from 'lucide-react';
import { CourseCard } from '@/components/malla/CourseCard';
import { PageTransition } from '@/components/ui/PageTransition';
import { getSpecialty } from '@/data/curriculum';
import { cn, STATUS_LABELS } from '@/lib/utils';
import { useCurriculumStore } from '@/stores/useCurriculumStore';
import type { CourseStatus } from '@/types';

const EMPTY_PROGRESS: Record<string, never> = {};

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'h-9 shrink-0 rounded-full border px-3.5 text-xs font-medium transition-colors',
        active
          ? 'border-accent bg-accent-light text-accent-hover'
          : 'border-border bg-white text-text-secondary hover:border-accent/40 hover:text-text-primary',
      )}
    >
      {children}
    </button>
  );
}

function toggle<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

/** Búsqueda con filtrado en tiempo real por nombre/código, semestre, créditos y estado. */
export function Search() {
  const specialtyId = useCurriculumStore((s) => s.specialtyId);
  const progressMap = useCurriculumStore((s) => s.progress);
  const selectCourse = useCurriculumStore((s) => s.selectCourse);
  const openStatusMenu = useCurriculumStore((s) => s.openStatusMenu);

  const specialty = getSpecialty(specialtyId);
  const statuses = specialty ? (progressMap[specialty.id] ?? EMPTY_PROGRESS) : EMPTY_PROGRESS;

  const [query, setQuery] = useState('');
  const [semesterFilter, setSemesterFilter] = useState<Set<number>>(new Set());
  const [creditsFilter, setCreditsFilter] = useState<Set<number>>(new Set());
  const [statusFilter, setStatusFilter] = useState<Set<CourseStatus>>(new Set());

  const creditOptions = useMemo(
    () => [...new Set(specialty?.courses.map((c) => c.credits) ?? [])].sort((a, b) => a - b),
    [specialty],
  );
  const semesterOptions = useMemo(
    () => [...new Set(specialty?.courses.map((c) => c.semester) ?? [])].sort((a, b) => a - b),
    [specialty],
  );

  const results = useMemo(() => {
    if (!specialty) return [];
    const q = query.trim().toLowerCase();
    return specialty.courses.filter((course) => {
      if (q && !course.name.toLowerCase().includes(q) && !course.id.toLowerCase().includes(q)) {
        return false;
      }
      if (semesterFilter.size > 0 && !semesterFilter.has(course.semester)) return false;
      if (creditsFilter.size > 0 && !creditsFilter.has(course.credits)) return false;
      if (statusFilter.size > 0 && !statusFilter.has(statuses[course.id] ?? 'pending')) {
        return false;
      }
      return true;
    });
  }, [specialty, query, semesterFilter, creditsFilter, statusFilter, statuses]);

  if (!specialty) return null;

  const hasFilters =
    query !== '' || semesterFilter.size > 0 || creditsFilter.size > 0 || statusFilter.size > 0;

  return (
    <PageTransition className="mx-auto max-w-4xl px-4 py-4 md:px-8 md:py-8">
      <h1 className="font-display text-2xl text-text-primary md:text-3xl">Buscar ramos</h1>

      {/* Input de búsqueda */}
      <div className="relative mt-4">
        <SearchIcon
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary"
          aria-hidden
        />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Nombre o código, ej: Cálculo o MAT1101"
          aria-label="Buscar ramos por nombre o código"
          className="h-12 w-full rounded-input border border-border bg-white pl-10 pr-10 text-base text-text-primary placeholder:text-text-secondary/60 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label="Limpiar búsqueda"
            className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-text-secondary hover:bg-surface"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        )}
      </div>

      {/* Filtros por estado */}
      <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
        {(Object.keys(STATUS_LABELS) as CourseStatus[]).map((status) => (
          <FilterChip
            key={status}
            active={statusFilter.has(status)}
            onClick={() => setStatusFilter((prev) => toggle(prev, status))}
          >
            {STATUS_LABELS[status]}
          </FilterChip>
        ))}
        <span className="mx-1 my-auto h-5 w-px shrink-0 bg-border" aria-hidden />
        {creditOptions.map((credits) => (
          <FilterChip
            key={credits}
            active={creditsFilter.has(credits)}
            onClick={() => setCreditsFilter((prev) => toggle(prev, credits))}
          >
            {credits} cr
          </FilterChip>
        ))}
      </div>

      {/* Filtros por semestre */}
      <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto pb-1">
        {semesterOptions.map((semester) => (
          <FilterChip
            key={semester}
            active={semesterFilter.has(semester)}
            onClick={() => setSemesterFilter((prev) => toggle(prev, semester))}
          >
            S{semester}
          </FilterChip>
        ))}
      </div>

      {/* Resultados */}
      <p className="mt-5 text-xs text-text-secondary" aria-live="polite">
        {results.length} {results.length === 1 ? 'ramo' : 'ramos'}
        {hasFilters ? ' encontrados' : ' en tu malla'}
      </p>

      {results.length === 0 ? (
        <div className="mt-10 flex flex-col items-center gap-3 py-10 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface">
            <SearchX className="h-6 w-6 text-text-secondary" aria-hidden />
          </div>
          <p className="text-sm font-medium text-text-primary">Sin resultados</p>
          <p className="max-w-xs text-sm text-text-secondary">
            Prueba con otro nombre o código, o quita algunos filtros.
          </p>
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-1 gap-3 pb-10 sm:grid-cols-2">
          {results.map((course) => (
            <CourseCard
              key={course.id}
              course={course}
              status={statuses[course.id] ?? 'pending'}
              onOpen={selectCourse}
              onStatusMenu={(courseId, x, y) => openStatusMenu({ courseId, x, y })}
            />
          ))}
        </div>
      )}
    </PageTransition>
  );
}
