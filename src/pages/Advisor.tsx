import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUp, CalendarDays, Check, Copy, GraduationCap, Lightbulb, Sparkles, ThumbsDown, ThumbsUp, TrendingUp } from 'lucide-react';
import { PageTransition } from '@/components/ui/PageTransition';
import { Skeleton } from '@/components/ui/Skeleton';
import { useActivePlan } from '@/hooks/useActivePlan';
import { useAuthStore } from '@/stores/useAuthStore';
import { useCurriculumStore } from '@/stores/useCurriculumStore';
import { useScheduleStore } from '@/stores/useScheduleStore';
import { useToastStore } from '@/stores/useToastStore';
import {
  adviceFor,
  analyzePlan,
  collectMissing,
  completedCredits,
  defaultTerm,
  eligibleCourses,
  planToGraduation,
  recommendSemester,
  topPriority,
  type CourseAdvice,
  type Term,
} from '@/lib/advisor';
import { SUGGESTIONS, understand, type Intent, type NluResult } from '@/lib/nlu';
import { loadIntentModel } from '@/lib/intentModel';
import { buildAutoSchedule, DAYS_SHORT, minutesToHHMM, type Section } from '@/lib/schedule';
import { buildNrcCsv, copyToClipboard, type ScheduleItem } from '@/lib/scheduleExport';
import { cn, computeProgress } from '@/lib/utils';
import type { Course } from '@/types';

const EMPTY: Record<string, never> = {};
const ordinal = (t: Term) => (t === 1 ? '1.er' : '2.º');

interface Message {
  id: number;
  role: 'bot' | 'user';
  node: React.ReactNode;
  /** Consulta e intención que generaron esta respuesta (habilita el 👍/👎). */
  meta?: { query: string; intent: string };
}

/**
 * Feedback local del alumno sobre las respuestas de Export. Se guarda SOLO en
 * este dispositivo (localStorage): sirve para recolectar frases reales con las
 * que crecer ml/intents.json. Los 👎 son oro: son frases mal entendidas.
 */
const FEEDBACK_KEY = 'pistachio:export-feedback';
const FEEDBACK_MAX = 300;

/** Intenciones cuya respuesta habla de un ramo (actualizan la memoria). */
const COURSE_INTENTS: ReadonlySet<Intent> = new Set([
  'course_can', 'course_missing', 'course_info', 'offered', 'course_professor',
]);

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

/** Línea de un ramo ya calzado en un horario: sección, NRC y bloques. */
function ScheduledLine({
  code,
  title,
  credits,
  section,
}: {
  code: string;
  title: string;
  credits: number;
  section: Section;
}) {
  return (
    <div className="rounded-btn border border-border bg-white px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 truncate text-sm font-medium text-text-primary">{title}</p>
        <span className="shrink-0 rounded-full bg-accent-light px-2.5 py-1 text-[11px] font-medium text-accent-hover">
          NRC {section.nrc}
        </span>
      </div>
      <p className="mt-0.5 text-xs text-text-secondary">
        {code} · {credits} SCT · Sección {section.section}
      </p>
      <p className="mt-0.5 text-xs text-text-tertiary">{sectionSummary(section)}</p>
    </div>
  );
}

const sectionSummary = (s: Section) =>
  s.meetings.length
    ? s.meetings
        .map((m) => `${DAYS_SHORT[m.day]} ${minutesToHHMM(m.start)}–${minutesToHHMM(m.end)}`)
        .join(' · ')
    : 'sin horario publicado';

/** "DULOVITS/CORTES ALEXANDER ALOIS" → "Dulovits Cortes Alexander Alois". */
const prettyProfessor = (raw: string): string =>
  raw
    .replace(/\//g, ' ')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

export function Advisor() {
  const { plan, loading } = useActivePlan();
  const user = useAuthStore((s) => s.user);
  const progressMap = useCurriculumStore((s) => s.progress);
  const offering = useScheduleStore((s) => s.offering);
  const showToast = useToastStore((s) => s.show);
  const navigate = useNavigate();
  const statuses = plan ? (progressMap[plan.id] ?? EMPTY) : EMPTY;

  const [term, setTerm] = useState<Term>(() => defaultTerm());
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [rated, setRated] = useState<Record<number, boolean>>({});
  const nextId = useRef(0);
  const endRef = useRef<HTMLDivElement>(null);
  // Meta pendiente: la setea handleText (o un chip aclaratorio) justo antes de
  // ejecutar una intención; el siguiente push de bot se la lleva.
  const pendingMeta = useRef<Message['meta'] | null>(null);
  // Memoria conversacional: el último ramo/profesor del que se habló, para
  // resolver "¿y cuántos créditos tiene?" sin repetir el nombre.
  const lastCourse = useRef<Course | null>(null);
  const lastProfessor = useRef<string | null>(null);

  const advice = useMemo(
    () => (plan ? analyzePlan(plan, statuses, term) : []),
    [plan, statuses, term],
  );

  // Carga (una vez) el modelo de intención entrenado, en segundo plano.
  useEffect(() => {
    void loadIntentModel();
  }, []);

  const push = (role: Message['role'], node: React.ReactNode) => {
    const meta = role === 'bot' ? (pendingMeta.current ?? undefined) : undefined;
    if (role === 'bot') pendingMeta.current = null;
    setMessages((prev) => [...prev, { id: nextId.current++, role, node, meta }]);
    // Deja que el DOM pinte antes de bajar el scroll.
    window.setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 40);
  };

  /** Registra el 👍/👎 de una respuesta en localStorage (solo este equipo). */
  const rate = (m: Message, helpful: boolean) => {
    if (!m.meta) return;
    try {
      const list = JSON.parse(localStorage.getItem(FEEDBACK_KEY) ?? '[]') as unknown[];
      list.push({ ts: new Date().toISOString(), query: m.meta.query, intent: m.meta.intent, helpful });
      localStorage.setItem(FEEDBACK_KEY, JSON.stringify(list.slice(-FEEDBACK_MAX)));
    } catch {
      // localStorage lleno o bloqueado: el feedback es best-effort.
    }
    setRated((prev) => ({ ...prev, [m.id]: helpful }));
    showToast(
      helpful ? '¡Gracias por tu feedback!' : 'Gracias — esto ayuda a entrenar a Export.',
      'success',
    );
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

  const copyNrcs = async (items: ScheduleItem[]) => {
    try {
      await copyToClipboard(buildNrcCsv(items));
      showToast('NRC copiados al portapapeles', 'success');
    } catch {
      showToast('No se pudieron copiar los NRC', 'error');
    }
  };

  const answerRecommend = () => {
    // Con el horario oficial cargado, damos la toma de ramos "de verdad":
    // cruzamos malla + Excel y armamos una carga sin topes, con NRC y horario.
    if (offering) {
      const auto = buildAutoSchedule(plan, statuses, offering, term);
      if (auto.courses.length > 0) {
        const items: ScheduleItem[] = auto.courses.map((c) => ({
          code: c.code,
          title: c.title,
          credits: c.credits,
          section: c.section,
        }));
        push(
          'bot',
          <div>
            <p>
              Crucé tu malla con el horario oficial ({offering.label}) y te armé una carga de{' '}
              <span className="font-medium text-text-primary">{auto.totalSct} SCT</span> sin topes,
              priorizando lo que más te destraba:
            </p>
            <div className="mt-3 flex flex-col gap-2">
              {auto.courses.map((c) => (
                <ScheduledLine
                  key={c.code}
                  code={c.code}
                  title={c.title}
                  credits={c.credits}
                  section={c.section}
                />
              ))}
            </div>
            {auto.unschedulable.length > 0 && (
              <p className="mt-3 text-sm text-text-secondary">
                Estos también te sirven, pero chocan de horario con los de arriba:{' '}
                {auto.unschedulable.map((u) => u.title).join(', ')}. Puedes cambiar secciones en la
                toma de ramos.
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => copyNrcs(items)}
                className="inline-flex items-center gap-2 rounded-btn border border-border bg-white px-3 py-2 text-sm font-medium text-text-primary transition-colors hover:border-accent/40 hover:text-accent-hover"
              >
                <Copy className="h-4 w-4" aria-hidden />
                Copiar NRC
              </button>
              <button
                type="button"
                onClick={() => navigate('/horario')}
                className="inline-flex items-center gap-2 rounded-btn bg-accent px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
              >
                <CalendarDays className="h-4 w-4" aria-hidden />
                Abrir en Toma de ramos
              </button>
            </div>
            <p className="mt-3 text-xs text-text-secondary">
              Es una sugerencia según tus prerrequisitos, créditos y los topes del horario. Tú
              eliges tu carga final.
            </p>
          </div>,
        );
        return;
      }
      // Hay horario, pero nada calza (por requisitos o porque no se dicta).
      push(
        'bot',
        <p>
          Revisé el horario oficial ({offering.label}) contra tu malla y por ahora no encuentro
          ramos que puedas tomar el {ordinal(term)} semestre: puede que te falten prerrequisitos,
          créditos, o que aún no se publiquen. Pregúntame por un ramo puntual para ver qué te falta.
        </p>,
      );
      return;
    }

    // Sin Excel: recomendación solo con la malla (y sugerimos subir el horario).
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
          Son sugerencias según tus prerrequisitos y créditos.{' '}
          <button
            type="button"
            onClick={() => navigate('/horario')}
            className="font-medium text-accent-hover underline underline-offset-2"
          >
            Sube el horario oficial
          </button>{' '}
          y te doy secciones, NRC y un horario sin topes.
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
          {sections && sections.length > 0 ? (
            <>
              <p className="mt-2 text-sm text-text-secondary">
                Según el horario oficial ({offering!.label}) se dicta con {sections.length}{' '}
                {sections.length === 1 ? 'sección' : 'secciones'}:
              </p>
              <div className="mt-2 flex flex-col gap-2">
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
            </>
          ) : (
            offering && (
              <p className="mt-2 text-sm text-text-secondary">
                Eso sí, no aparece en el horario oficial ({offering.label}), así que puede que no se
                dicte el próximo semestre.
              </p>
            )
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

  const answerCourseInfo = (course: Course) => {
    const semestreTxt = course.isSlot
      ? `es un cupo de ${course.slotCategory}`
      : `va en el ${course.semester}.º semestre de la malla`;
    const reqCount = course.prerequisites.length;
    push(
      'bot',
      <div>
        <p>
          <span className="font-medium text-text-primary">{course.name}</span>
          {course.isSlot ? '' : ` (${course.id})`} tiene{' '}
          <span className="font-medium text-text-primary">{course.credits} SCT</span> y {semestreTxt}.
        </p>
        {reqCount > 0 && (
          <p className="mt-2 text-sm text-text-secondary">
            Tiene {reqCount} {reqCount === 1 ? 'prerrequisito' : 'prerrequisitos'}. Pregúntame “¿qué
            me falta para {course.name}?” para ver la cadena completa.
          </p>
        )}
        {course.creditReq != null && (
          <p className="mt-2 text-sm text-text-secondary">
            Además exige {course.creditReq} SCT aprobados para inscribirlo.
          </p>
        )}
      </div>,
    );
  };

  const answerCourseProfessor = (course: Course) => {
    if (!offering) {
      push(
        'bot',
        <div>
          <p>
            Para decirte quién dicta {course.name} necesito el horario oficial del próximo semestre.
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
          próximo semestre, así que no tengo profesor asignado.
        </p>,
      );
      return;
    }
    const withProf = sections.filter((s) => s.professor);
    if (withProf.length === 0) {
      push(
        'bot',
        <p>
          <span className="font-medium text-text-primary">{course.name}</span> aparece en el horario
          ({offering.label}) pero aún no tiene profesor publicado.
        </p>,
      );
      return;
    }
    push(
      'bot',
      <div>
        <p>
          {withProf.length === 1 ? 'El profesor de' : 'Los profesores de'}{' '}
          <span className="font-medium text-text-primary">{course.name}</span> ({offering.label}):
        </p>
        <div className="mt-3 flex flex-col gap-2">
          {withProf.map((s) => (
            <div key={s.nrc} className="rounded-btn border border-border bg-white px-3 py-2">
              <p className="text-sm font-medium text-text-primary">{prettyProfessor(s.professor)}</p>
              <p className="text-xs text-text-secondary">
                Sección {s.section} · NRC {s.nrc}
              </p>
            </div>
          ))}
        </div>
      </div>,
    );
  };

  const answerProfessorCourses = (professor: string) => {
    if (!offering) {
      answerFallback();
      return;
    }
    const sections = offering.sections.filter((s) => s.professor === professor);
    // Un ramo por código (un profe puede repetirse en varias secciones del mismo).
    const byCode = new Map<string, { title: string; sections: Section[] }>();
    for (const s of sections) {
      const entry = byCode.get(s.code) ?? { title: s.title, sections: [] };
      entry.sections.push(s);
      byCode.set(s.code, entry);
    }
    if (byCode.size === 0) {
      push('bot', <p>No encuentro ramos de ese profesor en el horario oficial ({offering.label}).</p>);
      return;
    }
    push(
      'bot',
      <div>
        <p>
          <span className="font-medium text-text-primary">{prettyProfessor(professor)}</span> dicta{' '}
          {byCode.size} {byCode.size === 1 ? 'ramo' : 'ramos'} este semestre ({offering.label}):
        </p>
        <div className="mt-3 flex flex-col gap-2">
          {[...byCode.entries()].map(([code, { title, sections: secs }]) => (
            <div key={code} className="rounded-btn border border-border bg-white px-3 py-2">
              <p className="text-sm font-medium text-text-primary">{title}</p>
              <p className="text-xs text-text-secondary">
                {code} · {secs.map((s) => `Sección ${s.section} (NRC ${s.nrc})`).join(' · ')}
              </p>
            </div>
          ))}
        </div>
      </div>,
    );
  };

  const answerElectives = (category: string) => {
    const slots = plan.courses.filter((c) => c.isSlot && c.slotCategory === category);
    if (slots.length === 0) {
      push(
        'bot',
        <p>
          Tu malla ({plan.name}) no tiene cupos de {category}. Prueba con “¿qué electivos hay?” o
          “¿qué minors hay?”.
        </p>,
      );
      return;
    }
    const pendientes = slots.filter((c) => (statuses[c.id] ?? 'pending') !== 'completed');
    push(
      'bot',
      <div>
        <p>
          Tu malla tiene {slots.length} {slots.length === 1 ? 'cupo' : 'cupos'} de{' '}
          <span className="font-medium text-text-primary">{category}</span>
          {pendientes.length < slots.length
            ? ` (te ${slots.length - pendientes.length === 1 ? 'queda' : 'quedan'} ${pendientes.length} por cursar)`
            : ''}
          :
        </p>
        <div className="mt-3 flex flex-col gap-2">
          {slots.map((c) => (
            <CourseLine
              key={c.id}
              course={c}
              reason={(statuses[c.id] ?? 'pending') === 'completed' ? 'Cursado' : undefined}
            />
          ))}
        </div>
        <p className="mt-3 text-xs text-text-secondary">
          Cada cupo se llena con un ramo real. {offering ? 'Búscalo' : 'Sube el horario y búscalo'} en{' '}
          <button
            type="button"
            onClick={() => navigate('/horario')}
            className="font-medium text-accent-hover underline underline-offset-2"
          >
            Toma de ramos
          </button>
          .
        </p>
      </div>,
    );
  };

  const answerGraduationPath = () => {
    const route = planToGraduation(plan, statuses, term);
    if (route.remainingCourses === 0) {
      push('bot', <p>¡Ya tienes toda tu malla cursada! No te queda nada por delante. 🎓</p>);
      return;
    }
    if (route.semesters.length === 0) {
      push(
        'bot',
        <p>
          No pude proyectar tu ruta: no encuentro ramos que puedas tomar todavía. Pregúntame por un
          ramo puntual para ver qué te falta.
        </p>,
      );
      return;
    }
    const años = Math.ceil(route.totalSemesters / 2);
    push(
      'bot',
      <div>
        <p>
          Te quedan <span className="font-medium text-text-primary">{route.remainingCourses} ramos</span>. Proyectando
          una carga de hasta 30 SCT por semestre, te titulas en{' '}
          <span className="font-medium text-text-primary">
            {route.totalSemesters} {route.totalSemesters === 1 ? 'semestre' : 'semestres'}
          </span>{' '}
          (~{años} {años === 1 ? 'año' : 'años'}):
        </p>
        <div className="mt-3 flex flex-col gap-2">
          {route.semesters.map((s) => (
            <div key={s.index} className="rounded-btn border border-border bg-white px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-text-primary">
                  Semestre {s.index} · {ordinal(s.term)} sem
                </p>
                <span className="shrink-0 rounded-full bg-accent-light px-2.5 py-1 text-[11px] font-medium text-accent-hover">
                  {s.totalSct} SCT
                </span>
              </div>
              <ul className="mt-1.5 flex flex-col gap-0.5">
                {s.courses.map((c) => (
                  <li key={c.id} className="text-xs text-text-secondary">
                    {c.name}
                    <span className="text-text-tertiary"> · {c.credits} SCT</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        {route.unplaceable.length > 0 && (
          <p className="mt-3 text-sm text-text-secondary">
            No pude ubicar {route.unplaceable.length}{' '}
            {route.unplaceable.length === 1 ? 'ramo' : 'ramos'}:{' '}
            {route.unplaceable.map((c) => c.name).join(', ')}. Puede que dependan de requisitos que
            aún no tengo o de cupos que se definen más adelante.
          </p>
        )}
        <p className="mt-3 text-xs text-text-secondary">
          Es una proyección: asume que apruebas todo y que los ramos se siguen dictando en el mismo
          semestre. Sirve para orientarte, no es oficial.
        </p>
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

  const answerHelp = () => {
    push(
      'bot',
      <div>
        <p>Soy Export, tu asistente de malla. Cruzo tus ramos cursados con los prerrequisitos (y con el horario oficial, si lo subes) para ayudarte a decidir. Puedo:</p>
        <ul className="mt-2 list-inside list-disc text-sm text-text-secondary">
          <li>Recomendarte qué ramos tomar el próximo semestre, sin topes de horario.</li>
          <li>Decirte si puedes tomar un ramo puntual y, si no, qué te falta.</li>
          <li>Mostrarte secciones, NRC, horarios y profesores de un ramo.</li>
          <li>Darte tu avance de malla y créditos.</li>
          <li>Armarte el horario completo para la toma de ramos.</li>
        </ul>
        <p className="mt-2 text-sm text-text-secondary">
          Todo corre en tu dispositivo: no comparto tus datos con nadie.
        </p>
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

  /** Ejecuta la respuesta de una intención ya resuelta (con sus entidades). */
  const runIntent = (intent: Intent, ctx: Pick<NluResult, 'course' | 'professor' | 'electiveCategory'>) => {
    // Actualiza la memoria conversacional con la entidad que se va a responder.
    if (ctx.course && COURSE_INTENTS.has(intent)) lastCourse.current = ctx.course;
    if (ctx.professor && intent === 'professor_courses') lastProfessor.current = ctx.professor;
    switch (intent) {
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
        if (ctx.course) answerCourse(ctx.course);
        else answerFallback();
        break;
      case 'course_missing':
        if (ctx.course) answerMissing(ctx.course);
        else answerFallback();
        break;
      case 'course_info':
        if (ctx.course) answerCourseInfo(ctx.course);
        else answerFallback();
        break;
      case 'offered':
        if (ctx.course) answerOffered(ctx.course);
        else answerFallback();
        break;
      case 'course_professor':
        if (ctx.course) answerCourseProfessor(ctx.course);
        else answerFallback();
        break;
      case 'professor_courses':
        if (ctx.professor) answerProfessorCourses(ctx.professor);
        else answerFallback();
        break;
      case 'list_electives':
        answerElectives(ctx.electiveCategory ?? 'Electivo');
        break;
      case 'graduation_path':
        answerGraduationPath();
        break;
      case 'build_schedule':
        answerBuildSchedule();
        break;
      case 'help':
        answerHelp();
        break;
      case 'greeting':
        push(
          'bot',
          <p>¡Hola! Pregúntame qué ramos tomar, por un ramo puntual, o pídeme armar tu horario.</p>,
        );
        break;
      default:
        answerFallback();
    }
  };

  /** Etiqueta accionable para ofrecer una intención como pregunta aclaratoria. */
  const clarifyLabel = (intent: Intent, ctx: Pick<NluResult, 'course' | 'professor'>): string | null => {
    const name = ctx.course?.name;
    switch (intent) {
      case 'recommend': return 'Recomiéndame qué tomar';
      case 'eligible': return 'Qué ramos puedo tomar';
      case 'priority': return 'Qué me conviene priorizar';
      case 'progress': return 'Cómo va mi avance';
      case 'course_can': return name ? `¿Puedo tomar ${name}?` : null;
      case 'course_missing': return name ? `Qué me falta para ${name}` : null;
      case 'course_info': return name ? `Info de ${name}` : null;
      case 'offered': return name ? `Secciones de ${name}` : null;
      case 'course_professor': return name ? `Profesor de ${name}` : null;
      case 'professor_courses': return ctx.professor ? `Ramos de ${prettyProfessor(ctx.professor)}` : null;
      case 'list_electives': return 'Ver mis electivos';
      case 'graduation_path': return 'Mi ruta a titularme';
      case 'build_schedule': return 'Ármame el horario';
      case 'help': return 'Qué puedes hacer';
      default: return null;
    }
  };

  /**
   * Confianza media del modelo: en vez de adivinar (y responder cualquier
   * cosa), Export pregunta. Cada opción es un chip que ejecuta la intención.
   */
  const answerClarify = (result: NluResult, query: string) => {
    const options = result.modelGuesses
      .map((g) => ({ intent: g.intent, label: clarifyLabel(g.intent, result) }))
      .filter((o): o is { intent: Intent; label: string } => o.label !== null);
    if (options.length === 0) {
      answerFallback();
      return;
    }
    push(
      'bot',
      <div>
        <p>No estoy seguro de haber entendido. ¿Te refieres a algo de esto?</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {options.map((o) => (
            <button
              key={o.intent}
              type="button"
              onClick={() => {
                // La elección del alumno es una etiqueta implícita frase→intención.
                pendingMeta.current = { query, intent: o.intent };
                runIntent(o.intent, result);
              }}
              className="rounded-full border border-border bg-white px-3 py-1.5 text-xs font-medium text-text-primary transition-colors hover:border-accent/40 hover:text-accent-hover"
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>,
    );
  };

  const handleText = (raw: string) => {
    const text = raw.trim();
    if (!text) return;
    setDraft('');
    push('user', <span>{text}</span>);

    const result = understand(text, plan, offering, {
      course: lastCourse.current,
      professor: lastProfessor.current,
    });
    if (result.intent === 'unknown') {
      // Último recurso: si nombró un ramo con confianza media, da el veredicto;
      // si el modelo tiene hipótesis, pregunta en vez de adivinar.
      if (result.course && result.courseScore >= 0.5) {
        pendingMeta.current = { query: text, intent: 'course_can' };
        lastCourse.current = result.course;
        answerCourse(result.course);
      } else if (result.modelGuesses.length > 0) answerClarify(result, text);
      else answerFallback();
      return;
    }
    if (result.intent !== 'greeting') {
      pendingMeta.current = { query: text, intent: result.intent };
    }
    runIntent(result.intent, result);
  };

  const quickActions = [
    { label: `¿Qué tomo el ${ordinal(term)} semestre?`, icon: Sparkles, run: () => handleText(`¿Qué tomo el ${ordinal(term)} semestre?`) },
    { label: '¿Qué ya puedo tomar?', icon: Check, run: () => handleText('¿Qué puedo tomar?') },
    { label: '¿Cómo voy?', icon: TrendingUp, run: () => handleText('¿Cómo voy?') },
    { label: '¿Qué priorizo?', icon: Lightbulb, run: () => handleText('¿Qué me conviene priorizar?') },
    { label: 'Ruta a titularme', icon: GraduationCap, run: () => handleText('¿Cuándo me titulo?') },
    { label: 'Ármame el horario', icon: CalendarDays, run: () => handleText('Ármame el horario') },
  ];

  return (
    <PageTransition className="flex h-full flex-col">
      {/* Encabezado */}
      <div className="shrink-0 border-b border-border bg-white px-4 py-4 md:px-8">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img
              src="/assistant-mascot.jpg"
              alt=""
              aria-hidden
              className="h-10 w-10 shrink-0 rounded-full border border-border object-cover"
            />
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-text-primary">Export</h1>
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
              Hola{user ? ` ${user.name.split(' ')[0]}` : ''}, soy Export, tu asistente de malla. Escríbeme
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
              <div key={m.id}>
                <BotBubble>{m.node}</BotBubble>
                {m.meta && (
                  <div className="mt-1.5 flex items-center gap-0.5 pl-[38px]">
                    {rated[m.id] !== undefined ? (
                      <span className="text-[11px] text-text-tertiary">
                        Gracias por tu feedback
                      </span>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => rate(m, true)}
                          aria-label="Respuesta útil"
                          className="flex h-7 w-7 items-center justify-center rounded-full text-text-tertiary transition-colors hover:bg-accent-light hover:text-accent-hover"
                        >
                          <ThumbsUp className="h-3.5 w-3.5" aria-hidden />
                        </button>
                        <button
                          type="button"
                          onClick={() => rate(m, false)}
                          aria-label="Respuesta incorrecta"
                          className="flex h-7 w-7 items-center justify-center rounded-full text-text-tertiary transition-colors hover:bg-danger/10 hover:text-danger"
                        >
                          <ThumbsDown className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
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
      <img
        src="/assistant-mascot.jpg"
        alt=""
        aria-hidden
        className="mt-0.5 h-7 w-7 shrink-0 rounded-full border border-border object-cover"
      />
      <div className="max-w-[85%] rounded-2xl rounded-tl-md border border-border bg-white px-4 py-3 text-sm leading-relaxed text-text-primary">
        {children}
      </div>
    </div>
  );
}
