import { useMemo, useRef, useState } from 'react';
import { Check, Lightbulb, Search as SearchIcon, Sparkles, X } from 'lucide-react';
import { PageTransition } from '@/components/ui/PageTransition';
import { Skeleton } from '@/components/ui/Skeleton';
import { useActivePlan } from '@/hooks/useActivePlan';
import { useAuthStore } from '@/stores/useAuthStore';
import { useCurriculumStore } from '@/stores/useCurriculumStore';
import {
  adviceFor,
  analyzePlan,
  completedCredits,
  defaultTerm,
  eligibleCourses,
  recommendSemester,
  topPriority,
  type CourseAdvice,
  type Term,
} from '@/lib/advisor';
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

export function Advisor() {
  const { plan, loading } = useActivePlan();
  const user = useAuthStore((s) => s.user);
  const progressMap = useCurriculumStore((s) => s.progress);
  const statuses = plan ? (progressMap[plan.id] ?? EMPTY) : EMPTY;

  const [term, setTerm] = useState<Term>(() => defaultTerm());
  const [messages, setMessages] = useState<Message[]>([]);
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState('');
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

  const answerCourse = (course: Course) => {
    push('user', <span>¿Puedo tomar {course.name}?</span>);
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
      push(
        'bot',
        <p>
          Sí, puedes tomar <span className="font-medium text-text-primary">{course.name}</span> el{' '}
          {ordinal(term)} semestre: cumples todos los requisitos.
        </p>,
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

  const quickActions = [
    { label: `¿Qué tomo el ${ordinal(term)} semestre?`, icon: Sparkles, run: () => { push('user', <span>¿Qué tomo el {ordinal(term)} semestre?</span>); answerRecommend(); } },
    { label: '¿Qué ya puedo tomar?', icon: Check, run: () => { push('user', <span>¿Qué ya puedo tomar?</span>); answerEligible(); } },
    { label: '¿Qué me conviene priorizar?', icon: Lightbulb, run: () => { push('user', <span>¿Qué me conviene priorizar?</span>); answerPriority(); } },
    { label: '¿Puedo tomar un ramo?', icon: SearchIcon, run: () => setPicking(true) },
  ];

  const pickable = plan.courses
    .filter((c) => (statuses[c.id] ?? 'pending') !== 'completed')
    .filter((c) => {
      const q = query.trim().toLowerCase();
      return !q || c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q);
    })
    .slice(0, 8);

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
              Hola{user ? ` ${user.name.split(' ')[0]}` : ''}, soy tu asistente de malla. Te ayudo a
              decidir qué ramos tomar según lo que ya llevas cursado, mirando prerrequisitos y
              créditos.
            </p>
            <p className="mt-2 text-sm text-text-secondary">
              Toca una pregunta abajo para empezar.
            </p>
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

      {/* Selector de ramo (inline) */}
      {picking && (
        <div className="shrink-0 border-t border-border bg-white px-4 py-3 md:px-8">
          <div className="mx-auto max-w-2xl">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-text-secondary">Elige un ramo para consultar</p>
              <button
                type="button"
                onClick={() => { setPicking(false); setQuery(''); }}
                aria-label="Cerrar"
                className="flex h-7 w-7 items-center justify-center rounded-full text-text-secondary hover:bg-surface"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <input
              autoFocus
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Nombre o código, ej: Hormigón o IOC4101"
              className="mt-2 h-11 w-full rounded-input border border-border bg-white px-3.5 text-sm text-text-primary placeholder:text-text-secondary/60 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
            />
            {query && (
              <div className="mt-2 flex max-h-52 flex-col gap-1 overflow-y-auto">
                {pickable.length === 0 ? (
                  <p className="px-1 py-2 text-sm text-text-secondary">Sin resultados.</p>
                ) : (
                  pickable.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => { answerCourse(c); setPicking(false); setQuery(''); }}
                      className="flex items-center justify-between gap-3 rounded-btn px-3 py-2 text-left hover:bg-surface"
                    >
                      <span className="truncate text-sm text-text-primary">{c.name}</span>
                      <span className="shrink-0 text-xs text-text-secondary">
                        {c.isSlot ? c.slotCategory : c.id}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Respuestas rápidas */}
      {!picking && (
        <div className="shrink-0 border-t border-border bg-white px-4 py-3 pb-safe md:px-8">
          <div className="no-scrollbar mx-auto flex max-w-2xl gap-2 overflow-x-auto">
            {quickActions.map(({ label, icon: Icon, run }) => (
              <button
                key={label}
                type="button"
                onClick={run}
                className="flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-border bg-white px-3.5 text-xs font-medium text-text-primary transition-colors hover:border-accent/40 hover:text-accent-hover"
              >
                <Icon className="h-3.5 w-3.5" aria-hidden />
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
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
