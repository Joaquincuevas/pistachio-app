import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  CalendarPlus,
  Check,
  Copy,
  ImageDown,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { WeekGrid } from '@/components/schedule/WeekGrid';
import { ScheduleUpload } from '@/components/schedule/ScheduleUpload';
import { PageTransition } from '@/components/ui/PageTransition';
import { Skeleton } from '@/components/ui/Skeleton';
import { useActivePlan } from '@/hooks/useActivePlan';
import { adviceFor, analyzePlan, eligibleCourses, type Term } from '@/lib/advisor';
import {
  buildAutoSchedule,
  DAYS_SHORT,
  listOfferedCourses,
  minutesToHHMM,
  offeredCountForPlan,
  sectionsConflict,
  type Section,
} from '@/lib/schedule';
import {
  buildIcs,
  buildNrcCsv,
  copyToClipboard,
  downloadCanvasPng,
  downloadText,
  renderScheduleCanvas,
  type ScheduleItem,
} from '@/lib/scheduleExport';
import { cn } from '@/lib/utils';
import { useCurriculumStore } from '@/stores/useCurriculumStore';
import { useScheduleStore } from '@/stores/useScheduleStore';
import { useToastStore } from '@/stores/useToastStore';

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
  const show = useToastStore((s) => s.show);

  const statuses = plan ? (progressMap[plan.id] ?? EMPTY) : EMPTY;
  const term: Term = offering?.term.endsWith('10') ? 1 : 2;
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState('');
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

  const advice = analyzePlan(plan, statuses, term);

  // Ramos elegibles según la malla que se dictan y aún no están en la selección.
  const addable = eligibleCourses(advice).filter(
    (a) => offering.byCourse[a.course.id]?.length && !selection[a.course.id],
  );

  // Búsqueda libre sobre TODO el horario subido: los cupos "slot" de la malla
  // (Electivo, Minor, Concentración Tecnológica…) se satisfacen con cualquier
  // ramo real del horario cuyo código no coincide con el id del slot, así que
  // el matching exacto de "addable" nunca los va a encontrar. Esto también
  // cubre minors dictados por otra facultad, que ni siquiera están en la malla.
  const q = query.trim().toLowerCase();
  const browsable = listOfferedCourses(offering)
    .filter((c) => !selection[c.code])
    .filter((c) => !q || c.title.toLowerCase().includes(q) || c.code.toLowerCase().includes(q))
    .map((c) => {
      const planCourse = plan.courses.find((pc) => pc.id === c.code);
      const a = planCourse ? adviceFor(advice, planCourse.id) : undefined;
      const status = planCourse ? (statuses[planCourse.id] ?? 'pending') : 'pending';
      return {
        code: c.code,
        title: planCourse?.name ?? c.title,
        credits: planCourse?.credits ?? null,
        inPlan: Boolean(planCourse),
        status,
        blocked: Boolean(a && !a.eligible),
      };
    })
    .filter((c) => c.status !== 'completed' && c.status !== 'in-progress')
    .slice(0, 40);

  const rebuild = () => {
    const auto = buildAutoSchedule(plan, statuses, offering, term);
    setSelection(Object.fromEntries(auto.courses.map((c) => [c.code, c.section.nrc])));
  };

  const exportItems: ScheduleItem[] = selected;

  const copyNrc = async (nrc: string, label: string) => {
    try {
      await copyToClipboard(nrc);
      show(`NRC ${nrc} copiado (${label}).`);
    } catch {
      show('No se pudo copiar. Cópialo manualmente.', 'error');
    }
  };

  const copyAllNrcs = async () => {
    try {
      await copyToClipboard(buildNrcCsv(exportItems));
      show(`${exportItems.length} NRC copiados, listos para la toma de ramos.`);
    } catch {
      show('No se pudo copiar. Cópialos manualmente desde cada ramo.', 'error');
    }
  };

  const downloadIcs = () => {
    const ics = buildIcs(exportItems, offering);
    downloadText(`horario-${offering.term || 'pistachio'}.ics`, ics, 'text/calendar');
    show('Calendario descargado. Ábrelo para importarlo a tu app de calendario.');
  };

  const downloadImage = () => {
    const canvas = renderScheduleCanvas(exportItems, offering.label);
    downloadCanvasPng(canvas, `horario-${offering.term || 'pistachio'}.png`);
    show('Imagen del horario descargada.');
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

      {/* Exportar: copiar NRC para la toma de ramos, calendario, imagen */}
      {selected.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={copyAllNrcs}
            className="inline-flex items-center gap-1.5 rounded-btn border border-border bg-white px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:border-accent/40 hover:text-text-primary"
          >
            <Copy className="h-3.5 w-3.5" aria-hidden />
            Copiar NRC
          </button>
          <button
            type="button"
            onClick={downloadIcs}
            className="inline-flex items-center gap-1.5 rounded-btn border border-border bg-white px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:border-accent/40 hover:text-text-primary"
          >
            <CalendarPlus className="h-3.5 w-3.5" aria-hidden />
            Calendario (.ics)
          </button>
          <button
            type="button"
            onClick={downloadImage}
            className="inline-flex items-center gap-1.5 rounded-btn border border-border bg-white px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:border-accent/40 hover:text-text-primary"
          >
            <ImageDown className="h-3.5 w-3.5" aria-hidden />
            Imagen
          </button>
        </div>
      )}

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
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => copyNrc(c.section.nrc, c.title)}
                    aria-label={`Copiar NRC de ${c.title}`}
                    title={`Copiar NRC ${c.section.nrc}`}
                    className="flex h-7 items-center gap-1 rounded-full px-2 text-xs font-medium text-text-secondary hover:bg-surface hover:text-accent-hover"
                  >
                    <Copy className="h-3.5 w-3.5" aria-hidden />
                    {c.section.nrc}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeCourse(c.code)}
                    aria-label={`Quitar ${c.title}`}
                    className="flex h-7 w-7 items-center justify-center rounded-full text-text-secondary hover:bg-surface"
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                </div>
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
            className="inline-flex items-center gap-2 rounded-btn border border-border bg-white px-3.5 py-2 text-sm font-medium text-text-primary transition-colors hover:border-accent/40"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Agregar ramo {addable.length > 0 && `(${addable.length} sugeridos)`}
          </button>
        ) : (
          <div className="rounded-card border border-border bg-white p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-text-secondary">Agregar ramo</p>
              <button
                type="button"
                onClick={() => {
                  setAdding(false);
                  setQuery('');
                }}
                aria-label="Cerrar"
                className="flex h-7 w-7 items-center justify-center rounded-full text-text-secondary hover:bg-surface"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>

            {/* Sugeridos según la malla (elegibles y sin topes evidentes) */}
            {!q && addable.length > 0 && (
              <div className="mt-2">
                <p className="px-1 text-[11px] font-medium uppercase tracking-wide text-text-tertiary">
                  Sugeridos según tu malla
                </p>
                <div className="mt-1 flex flex-col gap-1">
                  {addable.map((a) => {
                    const first = offering.byCourse[a.course.id][0];
                    return (
                      <button
                        key={a.course.id}
                        type="button"
                        onClick={() => {
                          pickSection(a.course.id, first.nrc);
                          setAdding(false);
                          setQuery('');
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
                  })}
                </div>
              </div>
            )}

            {/* Búsqueda libre: cubre electivos, minors y cualquier ramo del horario
                que la malla no pueda calzar automáticamente por código exacto. */}
            <div className="mt-3">
              <p className="px-1 text-[11px] font-medium uppercase tracking-wide text-text-tertiary">
                Buscar en el horario
              </p>
              <div className="relative mt-1">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-secondary"
                  aria-hidden
                />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Nombre o código, ej: Electivo, Minor, IOC4101"
                  aria-label="Buscar cualquier ramo del horario"
                  className="h-10 w-full rounded-btn border border-border bg-white pl-9 pr-3 text-sm text-text-primary placeholder:text-text-secondary/60 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                />
              </div>
              <div className="mt-1 flex max-h-64 flex-col gap-1 overflow-y-auto">
                {browsable.length === 0 ? (
                  <p className="px-1 py-2 text-sm text-text-secondary">
                    {q ? 'Sin resultados.' : 'No quedan más ramos por agregar en el horario subido.'}
                  </p>
                ) : (
                  browsable.map((c) => (
                    <button
                      key={c.code}
                      type="button"
                      onClick={() => {
                        const first = offering.byCourse[c.code][0];
                        pickSection(c.code, first.nrc);
                        setAdding(false);
                        setQuery('');
                      }}
                      className="flex items-center justify-between gap-3 rounded-btn px-3 py-2 text-left hover:bg-surface"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm text-text-primary">{c.title}</span>
                        <span className="block text-xs text-text-secondary">
                          {c.code} · {c.credits != null ? `${c.credits} SCT` : 'fuera de tu malla'}
                          {c.blocked && ' · requisitos pendientes'}
                        </span>
                      </span>
                      <Plus className="h-4 w-4 shrink-0 text-accent" aria-hidden />
                    </button>
                  ))
                )}
              </div>
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
