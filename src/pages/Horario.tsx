import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CalendarDays, Check, Plus, RefreshCw, Trash2, X } from 'lucide-react';
import { WeekGrid } from '@/components/schedule/WeekGrid';
import { ScheduleUpload } from '@/components/schedule/ScheduleUpload';
import { PageTransition } from '@/components/ui/PageTransition';
import { Skeleton } from '@/components/ui/Skeleton';
import { useActivePlan } from '@/hooks/useActivePlan';
import { analyzePlan, eligibleCourses, type Term } from '@/lib/advisor';
import {
  buildAutoSchedule,
  DAYS_SHORT,
  minutesToHHMM,
  offeredCountForPlan,
  sectionsConflict,
  type Section,
} from '@/lib/schedule';
import { cn } from '@/lib/utils';
import { useCurriculumStore } from '@/stores/useCurriculumStore';
import { useScheduleStore } from '@/stores/useScheduleStore';

const EMPTY: Record<string, never> = {};

const sectionSummary = (s: Section) =>
  s.meetings.length
    ? s.meetings
        .map((m) => `${DAYS_SHORT[m.day]} ${minutesToHHMM(m.start)}–${minutesToHHMM(m.end)}`)
        .join(' · ')
    : 'Sin horario publicado';

export function Horario() {
  const { plan, loading } = useActivePlan();
  const progressMap = useCurriculumStore((s) => s.progress);
  const offering = useScheduleStore((s) => s.offering);
  const selection = useScheduleStore((s) => s.selection);
  const setSelection = useScheduleStore((s) => s.setSelection);
  const pickSection = useScheduleStore((s) => s.pickSection);
  const removeCourse = useScheduleStore((s) => s.removeCourse);
  const clearOffering = useScheduleStore((s) => s.clearOffering);

  const statuses = plan ? (progressMap[plan.id] ?? EMPTY) : EMPTY;
  const term: Term = offering?.term.endsWith('10') ? 1 : 2;
  const [adding, setAdding] = useState(false);
  const built = useRef(false);

  // Al cargar por primera vez un horario, propone un armado automático sin topes.
  useEffect(() => {
    if (plan && offering && !built.current && Object.keys(selection).length === 0) {
      built.current = true;
      const auto = buildAutoSchedule(plan, statuses, offering, term);
      setSelection(Object.fromEntries(auto.courses.map((c) => [c.code, c.section.nrc])));
    }
  }, [plan, offering, selection, statuses, term, setSelection]);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-4 md:px-8 md:py-8">
        <Skeleton className="h-8 w-44" />
        <Skeleton className="mt-4 h-40 rounded-card" />
      </div>
    );
  }
  if (!plan) return null;

  // ─── Sin horario cargado: pantalla de subida ───
  if (!offering) {
    return (
      <PageTransition className="mx-auto max-w-2xl px-4 py-6 md:px-8 md:py-10">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-light">
            <CalendarDays className="h-5 w-5 text-accent" aria-hidden />
          </span>
          <h1 className="text-2xl font-semibold tracking-tight text-text-primary">Toma de ramos</h1>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-text-secondary">
          Sube el Excel de horario que la Facultad publica en Canvas. Cruzándolo con tu malla, el
          asistente te dice qué ramos puedes tomar el próximo semestre y te arma un horario sin
          topes.
        </p>
        <div className="mt-6">
          <ScheduleUpload />
        </div>
      </PageTransition>
    );
  }

  // ─── Derivados de la selección actual ───
  const selected = Object.entries(selection)
    .map(([code, nrc]) => {
      const options = offering.byCourse[code] ?? [];
      const section = options.find((s) => s.nrc === nrc) ?? options[0];
      const planCourse = plan.courses.find((c) => c.id === code);
      return section
        ? {
            code,
            title: planCourse?.name ?? section.title,
            credits: planCourse?.credits ?? 0,
            section,
            options,
          }
        : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const totalSct = selected.reduce((sum, c) => sum + c.credits, 0);

  // Ramos que se pisan entre sí.
  const conflictCodes = new Set<string>();
  for (let i = 0; i < selected.length; i++) {
    for (let j = i + 1; j < selected.length; j++) {
      if (sectionsConflict(selected[i].section, selected[j].section)) {
        conflictCodes.add(selected[i].code);
        conflictCodes.add(selected[j].code);
      }
    }
  }

  const gridItems = selected.map((c) => ({ code: c.code, short: c.code, section: c.section }));

  // Ramos elegibles que se dictan y aún no están en la selección.
  const addable = eligibleCourses(analyzePlan(plan, statuses, term)).filter(
    (a) => offering.byCourse[a.course.id]?.length && !selection[a.course.id],
  );

  const rebuild = () => {
    const auto = buildAutoSchedule(plan, statuses, offering, term);
    setSelection(Object.fromEntries(auto.courses.map((c) => [c.code, c.section.nrc])));
  };

  return (
    <PageTransition className="mx-auto max-w-3xl px-4 py-4 md:px-8 md:py-8">
      {/* Encabezado */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-text-primary">Toma de ramos</h1>
          <p className="mt-1 text-sm text-text-secondary">
            {offering.label} · {offeredCountForPlan(plan, offering)} ramos de tu plan se dictan
          </p>
        </div>
        <div className="flex gap-2">
          <ScheduleUpload compact />
          <button
            type="button"
            onClick={clearOffering}
            aria-label="Quitar horario"
            className="flex h-9 w-9 items-center justify-center rounded-btn border border-border text-text-secondary transition-colors hover:border-danger/40 hover:text-danger"
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>

      {/* Resumen + acciones */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-card border border-border bg-white px-4 py-3">
        <div className="text-sm">
          <span className="font-semibold text-text-primary">{selected.length} ramos</span>
          <span className="text-text-secondary"> · {totalSct} SCT</span>
        </div>
        <div className="flex items-center gap-2">
          {conflictCodes.size > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-danger-light px-2.5 py-1 text-xs font-medium text-danger">
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
              Hay topes de horario
            </span>
          ) : (
            selected.length > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-light px-2.5 py-1 text-xs font-medium text-accent-hover">
                <Check className="h-3.5 w-3.5" aria-hidden />
                Sin topes
              </span>
            )
          )}
          <button
            type="button"
            onClick={rebuild}
            className="inline-flex items-center gap-1.5 rounded-btn border border-border px-2.5 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:text-text-primary"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            Rearmar
          </button>
        </div>
      </div>

      {/* Cuadrícula semanal */}
      {selected.length > 0 && (
        <div className="mt-5">
          <WeekGrid items={gridItems} />
        </div>
      )}

      {/* Ramos elegidos */}
      <div className="mt-6 flex flex-col gap-2.5">
        {selected.length === 0 && (
          <p className="rounded-card border border-dashed border-border-strong px-4 py-6 text-center text-sm text-text-secondary">
            No tienes ramos en tu horario. Agrega desde el botón de abajo o toca “Rearmar”.
          </p>
        )}
        {selected.map((c) => {
          const conflict = conflictCodes.has(c.code);
          return (
            <div
              key={c.code}
              className={cn(
                'rounded-card border bg-white p-4',
                conflict ? 'border-danger/50' : 'border-border',
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-text-primary">{c.title}</p>
                  <p className="text-xs text-text-secondary">
                    {c.code} · {c.credits} SCT · Sección {c.section.section}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removeCourse(c.code)}
                  aria-label={`Quitar ${c.title}`}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-text-secondary hover:bg-surface"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>

              <p className="mt-2 text-xs text-text-secondary">{sectionSummary(c.section)}</p>

              {c.options.length > 1 && (
                <select
                  value={c.section.nrc}
                  onChange={(e) => pickSection(c.code, e.target.value)}
                  aria-label={`Cambiar sección de ${c.title}`}
                  className="mt-3 w-full rounded-btn border border-border bg-white px-3 py-2 text-xs text-text-primary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                >
                  {c.options.map((s) => (
                    <option key={s.nrc} value={s.nrc}>
                      Sección {s.section} — {sectionSummary(s)}
                    </option>
                  ))}
                </select>
              )}
            </div>
          );
        })}
      </div>

      {/* Agregar ramo */}
      <div className="mt-4">
        {!adding ? (
          <button
            type="button"
            onClick={() => setAdding(true)}
            disabled={addable.length === 0}
            className="inline-flex items-center gap-2 rounded-btn border border-border bg-white px-3.5 py-2 text-sm font-medium text-text-primary transition-colors hover:border-accent/40 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Agregar ramo {addable.length > 0 && `(${addable.length} disponibles)`}
          </button>
        ) : (
          <div className="rounded-card border border-border bg-white p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-text-secondary">
                Ramos que puedes tomar y se dictan
              </p>
              <button
                type="button"
                onClick={() => setAdding(false)}
                aria-label="Cerrar"
                className="flex h-7 w-7 items-center justify-center rounded-full text-text-secondary hover:bg-surface"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <div className="mt-2 flex max-h-64 flex-col gap-1 overflow-y-auto">
              {addable.length === 0 ? (
                <p className="px-1 py-2 text-sm text-text-secondary">No quedan ramos por agregar.</p>
              ) : (
                addable.map((a) => {
                  const first = offering.byCourse[a.course.id][0];
                  return (
                    <button
                      key={a.course.id}
                      type="button"
                      onClick={() => {
                        pickSection(a.course.id, first.nrc);
                        setAdding(false);
                      }}
                      className="flex items-center justify-between gap-3 rounded-btn px-3 py-2 text-left hover:bg-surface"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm text-text-primary">
                          {a.course.name}
                        </span>
                        <span className="block text-xs text-text-secondary">
                          {a.course.id} · {a.course.credits} SCT
                        </span>
                      </span>
                      <Plus className="h-4 w-4 shrink-0 text-accent" aria-hidden />
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      <p className="mt-6 text-xs leading-relaxed text-text-tertiary">
        El horario se procesa en tu dispositivo a partir del Excel oficial. Verifica siempre los
        cupos y requisitos en el sistema de la Universidad antes de inscribir.
      </p>
    </PageTransition>
  );
}
