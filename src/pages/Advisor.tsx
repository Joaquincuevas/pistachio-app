import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUp, CalendarDays, Check, Lightbulb, Sparkles, TrendingUp } from 'lucide-react';
import { PageTransition } from '@/components/ui/PageTransition';
import { Skeleton } from '@/components/ui/Skeleton';
import { useActivePlan } from '@/hooks/useActivePlan';
import { useAuthStore } from '@/stores/useAuthStore';
import { useCurriculumStore } from '@/stores/useCurriculumStore';
import { useScheduleStore } from '@/stores/useScheduleStore';
import {
  adviceFor,
  analyzePlan,
  collectMissing,
  completedCredits,
  defaultTerm,
  eligibleCourses,
  recommendSemester,
  topPriority,
  type CourseAdvice,
  type Term,
} from '@/lib/advisor';
import { SUGGESTIONS, understand } from '@/lib/nlu';
import { DAYS_SHORT, minutesToHHMM, type Section } from '@/lib/schedule';
import { cn, computeProgress } from '@/lib/utils';
import type { Course } from '@/types';

const EMPTY: Record<string, never> = {};
const ordinal = (t: Term) => (t === 1 ? '1.er' : '2.º');

interface Message {
  id: number;
  role: 'bot' | 'user';
  node: React.ReactNode;
}

/** Línea compacta de un ramo dentro de una respuesta del asistente. */
function CourseLine({ course, reason }: { course: Course; reason?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-btn border border-border bg-white px-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-text-primary">{course.name}</p>
        <p className="text-xs text-text-secondary">
          {course.isSlot ? course.slotCategory : course.id} · {course.credits} SCT
        </p>
      </div>
      {reason && (
        <span className="shrink-0 rounded-full bg-accent-light px-2.5 py-1 text-[11px] font-medium text-accent-hover">
          {reason}
        </span>
      )}
    </div>
  );
}

const reasonFor = (a: CourseAdvice) =>
  a.unlocks > 0 ? `Desbloquea ${a.unlocks}` : 'Avanza tu malla';

const sectionSummary = (s: Section) =>
  s.meetings.length
    ? s.meetings
        .map((m) => `${DAYS_SHORT[m.day]} ${minutesToHHMM(m.start)}–${minutesToHHMM(m.end)}`)
        .join(' · ')
    : 'sin horario publicado';

export function Advisor() {
  const { plan, loading } = useActivePlan();
  const user = useAuthStore((s) => s.user);
  const progressMap = useCurriculumStore((s) => s.progress);
  const offering = useScheduleStore((s) => s.offering);
  const navigate = useNavigate();
  const statuses = plan ? (progressMap[plan.id] ?? EMPTY) : EMPTY;

  const [term, setTerm] = useState<Term>(() => defaultTerm());
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const nextId = useRef(0);
  const endRef = useRef<HTMLDivElement>(null);

  const advice = useMemo(
    () => (plan ? analyzePlan(plan, statuses, term) : []),
    [plan, statuses, term],
  );

  const push = (role: Message['role'], node: React.ReactNode) => {
    setMessages((prev) => [...prev, { id: nextId.current++, role, node }]);
    // Deja que el DOM pinte antes de bajar el scroll.
    window.setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 40);
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-4 md:px-8 md:py-8">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="mt-4 h-24 rounded-card" />
        <Skeleton className="mt-3 h-16 rounded-card" />
      </div>
    );
  }
  if (!plan) return null;

  const stats = computeProgress(plan, statuses);
  const credits = completedCredits(plan, statuses);

  // ─── Respuestas del asistente ───────────────────────────────────

  const answerRecommend = () => {
    const { picks, totalSct } = recommendSemester(advice);
    if (picks.length === 0) {
      push(
        'bot',
        <p>
          Con lo que llevas cursado, no encuentro ramos nuevos para el {ordinal(term)} semestre.
          Puede que te falten prerrequisitos o créditos. Pregúntame por un ramo puntual para ver
          qué te falta.
        </p>,
      );
      return;
    }
    push(
      'bot',
      <div>
        <p>
          Para el {ordinal(term)} semestre te sugiero esta carga de{' '}
          <span className="font-medium text-text-primary">{totalSct} SCT</span>, priorizando lo
          que más te destraba:
        </p>
        <div className="mt-3 flex flex-col gap-2">
          {picks.map((a) => (
            <CourseLine key={a.course.id} course={a.course} reason={reasonFor(a)} />
          ))}
        </div>
        <p className="mt-3 text-xs text-text-secondary">
          Son sugerencias según tus prerrequisitos y créditos. Tú eliges tu carga final.
        </p>
      </div>,
    );
  };

  const answerEligible = () => {
    const list = eligibleCourses(advice);
    if (list.length === 0) {
      push('bot', <p>Por ahora no hay ramos habilitados para el {ordinal(term)} semestre.</p>);
      return;
    }
    push(
      'bot',
      <div>
        <p>
          Tienes <span className="font-medium text-text-primary">{list.length}</span>{' '}
          {list.length === 1 ? 'ramo habilitado' : 'ramos habilitados'} para el {ordinal(term)}{' '}
          semestre:
        </p>
        <div className="mt-3 flex flex-col gap-2">
          {list.map((a) => (
            <CourseLine key={a.course.id} course={a.course} reason={reasonFor(a)} />
          ))}
        </div>
      </div>,
    );
  };

  const answerPriority = () => {
    const top = topPriority(advice);
    if (!top) {
      push('bot', <p>No hay ramos habilitados para priorizar en el {ordinal(term)} semestre.</p>);
      return;
    }
    push(
      'bot',
      <div>
        <p>
          Prioriza <span className="font-medium text-text-primary">{top.course.name}</span>: es el
          ramo habilitado que más te destraba
          {top.unlocks > 0 ? `, desbloquea ${top.unlocks} ramos más adelante.` : '.'}
        </p>
        <div className="mt-3">
          <CourseLine course={top.course} reason={reasonFor(top)} />
        </div>
      </div>,
    );
  };

  const answerProgress = () => {
    const remaining = stats.totalCourses - stats.completedCourses;
    push(
      'bot',
      <div>
        <p>
          Llevas <span className="font-medium text-text-primary">{stats.completedCourses}</span> de{' '}
          {stats.totalCourses} ramos ({stats.percent}%) y{' '}
          <span className="font-medium text-text-primary">{credits}</span> de {stats.totalCredits}{' '}
          SCT.
        </p>
        <p className="mt-2 text-sm text-text-secondary">
          Te quedan {remaining} ramos{stats.inProgressCourses > 0 ? ` (${stats.inProgressCourses} en curso)` : ''}.
          {credits < 170 && ' La Práctica Pre-Profesional se habilita a los 170 SCT.'}
          {credits >= 170 && credits < 282 && ' La Práctica Profesional se habilita a los 282 SCT.'}
        </p>
      </div>,
    );
  };

  const answerCourse = (course: Course) => {
    const a = adviceFor(advice, course.id);
    const status = statuses[course.id] ?? 'pending';

    if (status === 'completed') {
      push('bot', <p>Ya tienes {course.name} cursado. Va listo en tu malla.</p>);
      return;
    }
    if (status === 'in-progress') {
      push('bot', <p>Estás cursando {course.name} en este momento.</p>);
      return;
    }
    if (a?.eligible) {
      const sections = offering?.byCourse[course.id];
      push(
        'bot',
        <div>
          <p>
            Sí, puedes tomar <span className="font-medium text-text-primary">{course.name}</span>{' '}
            el {ordinal(term)} semestre: cumples todos los requisitos.
          </p>
          {sections && sections.length > 0 && (
            <p className="mt-2 text-sm text-text-secondary">
              Según el horario oficial, se dicta con {sections.length}{' '}
              {sections.length === 1 ? 'sección' : 'secciones'}. Pregúntame "¿qué secciones tiene{' '}
              {course.name}?" para verlas.
            </p>
          )}
        </div>,
      );
      return;
    }
    // Bloqueado: explica exactamente qué falta.
    const parts: React.ReactNode[] = [];
    if (a && a.missingPrereqs.length > 0) {
      parts.push(
        <div key="prereqs" className="mt-3">
          <p className="text-xs font-medium uppercase tracking-wide text-text-tertiary">
            Te falta cursar
          </p>
          <div className="mt-2 flex flex-col gap-2">
            {a.missingPrereqs.map((c) => (
              <CourseLine key={c.id} course={c} />
            ))}
          </div>
        </div>,
      );
    }
    if (a && a.creditsShort > 0) {
      parts.push(
        <p key="credits" className="mt-3 text-sm text-text-secondary">
          Necesitas {a.creditsShort} SCT más (llevas {credits} de {course.creditReq}).
        </p>,
      );
    }
    if (a && !a.offeredThisTerm) {
      parts.push(
        <p key="offered" className="mt-3 text-sm text-text-secondary">
          Además, este ramo no se dicta el {ordinal(term)} semestre.
        </p>,
      );
    }
    push(
      'bot',
      <div>
        <p>
          Aún no puedes tomar{' '}
          <span className="font-medium text-text-primary">{course.name}</span>.
        </p>
        {parts}
      </div>,
    );
  };

  const answerMissing = (course: Course) => {
    const status = statuses[course.id] ?? 'pending';
    if (status === 'completed') {
      push('bot', <p>Nada: {course.name} ya está cursado.</p>);
      return;
    }
    const missing = collectMissing(course.id, plan.courses, statuses);
    const a = adviceFor(advice, course.id);
    const creditsShort = a?.creditsShort ?? 0;
    if (missing.length === 0 && creditsShort === 0) {
      push(
        'bot',
        <p>
          No te falta nada para{' '}
          <span className="font-medium text-text-primary">{course.name}</span>: puedes tomarlo
          cuando se dicte.
        </p>,
      );
      return;
    }
    if (missing.length === 0) {
      // Solo faltan créditos (típico de prácticas y proyectos de título).
      push(
        'bot',
        <p>
          Para <span className="font-medium text-text-primary">{course.name}</span> no te faltan
          ramos, solo créditos: necesitas {creditsShort} SCT más (llevas {credits} de{' '}
          {course.creditReq}).
        </p>,
      );
      return;
    }
    push(
      'bot',
      <div>
        <p>
          Para tomar <span className="font-medium text-text-primary">{course.name}</span> te{' '}
          {missing.length === 1 ? 'falta este ramo' : `faltan ${missing.length} ramos`} (incluye la
          cadena completa de prerrequisitos):
        </p>
        <div className="mt-3 flex flex-col gap-2">
          {missing.map((c) => (
            <CourseLine key={c.id} course={c} />
          ))}
        </div>
        {creditsShort > 0 && (
          <p className="mt-3 text-sm text-text-secondary">
            Además necesitas {creditsShort} SCT más de créditos aprobados.
          </p>
        )}
      </div>,
    );
  };

  const answerOffered = (course: Course) => {
    if (!offering) {
      push(
        'bot',
        <div>
          <p>
            Aún no has cargado el horario oficial del próximo semestre, así que no sé qué secciones
            tiene {course.name}.
          </p>
          <button
            type="button"
            onClick={() => navigate('/horario')}
            className="mt-3 inline-flex items-center gap-2 rounded-btn bg-accent px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
          >
            <CalendarDays className="h-4 w-4" aria-hidden />
            Subir horario
          </button>
        </div>,
      );
      return;
    }
    const sections = offering.byCourse[course.id];
    if (!sections || sections.length === 0) {
      push(
        'bot',
        <p>
          Según el horario oficial ({offering.label}),{' '}
          <span className="font-medium text-text-primary">{course.name}</span> no se dicta el
          próximo semestre.
        </p>,
      );
      return;
    }
    push(
      'bot',
      <div>
        <p>
          <span className="font-medium text-text-primary">{course.name}</span> se dicta con{' '}
          {sections.length} {sections.length === 1 ? 'sección' : 'secciones'} ({offering.label}):
        </p>
        <div className="mt-3 flex flex-col gap-2">
          {sections.map((s) => (
            <div key={s.nrc} className="rounded-btn border border-border bg-white px-3 py-2">
              <p className="text-sm font-medium text-text-primary">
                Sección {s.section} · NRC {s.nrc}
              </p>
              <p className="text-xs text-text-secondary">{sectionSummary(s)}</p>
              {s.professor && <p className="text-xs text-text-tertiary">{s.professor}</p>}
            </div>
          ))}
        </div>
      </div>,
    );
  };

  const answerBuildSchedule = () => {
    push(
      'bot',
      <div>
        <p>
          Vamos al planificador: ahí cruzo tu malla con el horario oficial y te armo un horario sin
          topes, sección por sección.
        </p>
        <button
          type="button"
          onClick={() => navigate('/horario')}
          className="mt-3 inline-flex items-center gap-2 rounded-btn bg-accent px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
        >
          <CalendarDays className="h-4 w-4" aria-hidden />
          Ir a Toma de ramos
        </button>
      </div>,
    );
  };

  const answerFallback = () => {
    push(
      'bot',
      <div>
        <p>No estoy seguro de haber entendido. Puedo ayudarte con cosas como:</p>
        <ul className="mt-2 list-inside list-disc text-sm text-text-secondary">
          {SUGGESTIONS.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </div>,
    );
  };

  // ─── Entrada de texto libre (Pistacho IA) ───────────────────────

  const handleText = (raw: string) => {
    const text = raw.trim();
    if (!text) return;
    setDraft('');
    push('user', <span>{text}</span>);

    const result = understand(text, plan);
    switch (result.intent) {
      case 'recommend':
        answerRecommend();
        break;
      case 'eligible':
        answerEligible();
        break;
      case 'priority':
        answerPriority();
        break;
      case 'progress':
        answerProgress();
        break;
      case 'course_can':
        if (result.course) answerCourse(result.course);
        else answerFallback();
        break;
      case 'course_missing':
        if (result.course) answerMissing(result.course);
        else answerFallback();
        break;
      case 'offered':
        if (result.course) answerOffered(result.course);
        else answerFallback();
        break;
      case 'build_schedule':
        answerBuildSchedule();
        break;
      case 'greeting':
        push(
          'bot',
          <p>¡Hola! Pregúntame qué ramos tomar, por un ramo puntual, o pídeme armar tu horario.</p>,
        );
        break;
      default:
        // Último recurso: si nombró un ramo con confianza media, da el veredicto.
        if (result.course && result.courseScore >= 0.5) answerCourse(result.course);
        else answerFallback();
    }
  };

  const quickActions = [
    { label: `¿Qué tomo el ${ordinal(term)} semestre?`, icon: Sparkles, run: () => handleText(`¿Qué tomo el ${ordinal(term)} semestre?`) },
    { label: '¿Qué ya puedo tomar?', icon: Check, run: () => handleText('¿Qué puedo tomar?') },
    { label: '¿Cómo voy?', icon: TrendingUp, run: () => handleText('¿Cómo voy?') },
    { label: '¿Qué priorizo?', icon: Lightbulb, run: () => handleText('¿Qué me conviene priorizar?') },
    { label: 'Ármame el horario', icon: CalendarDays, run: () => handleText('Ármame el horario') },
  ];

  return (
    <PageTransition className="flex h-full flex-col">
      {/* Encabezado */}
      <div className="shrink-0 border-b border-border bg-white px-4 py-4 md:px-8">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-light">
              <Sparkles className="h-5 w-5 text-accent" aria-hidden />
            </span>
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-text-primary">Asistente</h1>
              <p className="text-xs text-text-secondary">
                {stats.completedCourses}/{stats.totalCourses} ramos · {credits} SCT
              </p>
            </div>
          </div>
          {/* Selector de semestre */}
          <div role="group" aria-label="Semestre" className="flex rounded-btn border border-border bg-white p-1">
            {([1, 2] as Term[]).map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={term === t}
                onClick={() => setTerm(t)}
                className={cn(
                  'rounded-[9px] px-3 py-1.5 text-xs font-medium transition-colors',
                  term === t ? 'bg-accent-light text-accent-hover' : 'text-text-secondary hover:text-text-primary',
                )}
              >
                {ordinal(t)} sem
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Conversación */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 md:px-8">
        <div className="mx-auto flex max-w-2xl flex-col gap-4">
          {/* Saludo inicial */}
          <BotBubble>
            <p>
              Hola{user ? ` ${user.name.split(' ')[0]}` : ''}, soy tu asistente de malla. Escríbeme
              lo que necesites: qué ramos tomar, si puedes tomar uno puntual, qué te falta para
              otro, o pídeme armar tu horario para la toma de ramos.
            </p>
            {!offering && (
              <p className="mt-2 text-sm text-text-secondary">
                Consejo: si subes el horario oficial en “Horario”, también te digo secciones,
                profesores y topes.
              </p>
            )}
          </BotBubble>

          {messages.map((m) =>
            m.role === 'bot' ? (
              <BotBubble key={m.id}>{m.node}</BotBubble>
            ) : (
              <div key={m.id} className="flex justify-end">
                <div className="max-w-[80%] rounded-2xl rounded-br-md bg-accent px-4 py-2.5 text-sm text-white">
                  {m.node}
                </div>
              </div>
            ),
          )}
          <div ref={endRef} />
        </div>
      </div>

      {/* Respuestas rápidas + entrada de texto */}
      <div className="shrink-0 border-t border-border bg-white px-4 pb-safe pt-3 md:px-8">
        <div className="mx-auto max-w-2xl">
          <div className="no-scrollbar flex gap-2 overflow-x-auto pb-2">
            {quickActions.map(({ label, icon: Icon, run }) => (
              <button
                key={label}
                type="button"
                onClick={run}
                className="flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-border bg-white px-3 text-xs font-medium text-text-primary transition-colors hover:border-accent/40 hover:text-accent-hover"
              >
                <Icon className="h-3.5 w-3.5" aria-hidden />
                {label}
              </button>
            ))}
          </div>
          <form
            className="flex items-end gap-2 pb-3"
            onSubmit={(e) => {
              e.preventDefault();
              handleText(draft);
            }}
          >
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Escríbeme, ej: ¿puedo tomar Hidráulica?"
              aria-label="Pregúntale al asistente"
              className="h-11 min-w-0 flex-1 rounded-input border border-border bg-white px-3.5 text-sm text-text-primary placeholder:text-text-secondary/60 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
            />
            <button
              type="submit"
              disabled={!draft.trim()}
              aria-label="Enviar"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-white transition-colors hover:bg-accent-hover disabled:opacity-40"
            >
              <ArrowUp className="h-5 w-5" aria-hidden />
            </button>
          </form>
        </div>
      </div>
    </PageTransition>
  );
}

/** Burbuja del asistente con avatar. */
function BotBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2.5">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-light">
        <Sparkles className="h-3.5 w-3.5 text-accent" aria-hidden />
      </span>
      <div className="max-w-[85%] rounded-2xl rounded-tl-md border border-border bg-white px-4 py-3 text-sm leading-relaxed text-text-primary">
        {children}
      </div>
    </div>
  );
}
