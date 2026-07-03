import { useEffect, useState } from 'react';
import { ArrowRight, Award, CheckCircle2, Circle, Clock, GraduationCap } from 'lucide-react';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Modal } from '@/components/ui/Modal';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { useActivePlan } from '@/hooks/useActivePlan';
import { useIsDesktop } from '@/hooks/useMediaQuery';
import { cn, STATUS_LABELS } from '@/lib/utils';
import { useCurriculumStore } from '@/stores/useCurriculumStore';
import { useToastStore } from '@/stores/useToastStore';
import type { Course, CourseStatus, Plan } from '@/types';

const statusOptions: { value: CourseStatus; icon: typeof Circle; activeClass: string }[] = [
  {
    value: 'completed',
    icon: CheckCircle2,
    activeClass: 'bg-status-completed/15 border-status-completed text-[#3F7A4C]',
  },
  {
    value: 'in-progress',
    icon: Clock,
    activeClass: 'bg-status-progress/15 border-status-progress text-[#2D6FBF]',
  },
  {
    value: 'pending',
    icon: Circle,
    activeClass: 'bg-surface border-text-secondary/40 text-text-primary',
  },
];

const HOUR_LABELS: [keyof NonNullable<Course['hours']>, string][] = [
  ['clases', 'Cátedra'],
  ['ayudantias', 'Ayudantía'],
  ['laboratorio', 'Laboratorio / taller'],
  ['trabajos', 'Trabajos'],
  ['presentaciones', 'Presentaciones'],
  ['lecturas', 'Lecturas'],
  ['estudio', 'Estudio personal'],
];

const SLOT_HINTS: Record<string, string> = {
  'Formación General': 'Cupo del ciclo de formación general. Se completa con el curso que inscribas ese semestre.',
  Minor: 'Cupo del Minor que elijas. El detalle de cursos depende del Minor inscrito.',
  'Concentración Tecnológica': 'Cupo de la concentración tecnológica que elijas dentro de la Facultad.',
  Electivo: 'Cupo de electivo: se completa con un ramo del catálogo de tu especialidad.',
  Mención: 'Cupo de la mención que elijas dentro de tu especialidad.',
};

function CourseDetailContent({ course, plan }: { course: Course; plan: Plan }) {
  const progressMap = useCurriculumStore((s) => s.progress);
  const setCourseStatus = useCurriculumStore((s) => s.setCourseStatus);
  const selectCourse = useCurriculumStore((s) => s.selectCourse);
  const show = useToastStore((s) => s.show);

  const status: CourseStatus = progressMap[plan.id]?.[course.id] ?? 'pending';
  const byId = new Map(plan.courses.map((c) => [c.id, c]));
  const prerequisites = course.prerequisites
    .map((p) => ({ course: byId.get(p.id), concurrent: p.concurrent }))
    .filter((p): p is { course: Course; concurrent: boolean } => p.course !== undefined);
  const unlocks = plan.courses.filter((c) =>
    c.prerequisites.some((p) => p.id === course.id),
  );
  const hours = course.hours && course.hours.total > 0 ? course.hours : null;

  const handleStatus = (next: CourseStatus) => {
    setCourseStatus(course.id, next);
    show(`${course.name} marcado como ${STATUS_LABELS[next].toLowerCase()}`);
  };

  return (
    <div className="px-6 pb-8 pt-2 md:pt-6">
      {/* Encabezado */}
      <div className="pr-8">
        <div className="flex flex-wrap items-center gap-2">
          {!course.isSlot && <Badge variant="beige">{course.id}</Badge>}
          {course.isSlot && course.slotCategory && (
            <Badge variant="beige">{course.slotCategory}</Badge>
          )}
          <Badge>Semestre {course.semester}</Badge>
          <Badge>{course.credits} SCT</Badge>
          {course.offered.length > 0 && !course.isSlot && (
            <Badge variant="accent">
              Se dicta: {course.offered.map((s) => (s === 1 ? '1er sem' : '2do sem')).join(' y ')}
            </Badge>
          )}
          <StatusBadge status={status} />
        </div>
        <h2 className="mt-3 font-display text-3xl leading-tight text-text-primary">
          {course.name}
        </h2>
      </div>

      {course.isSlot && (
        <p className="mt-4 text-sm leading-relaxed text-text-secondary">
          {SLOT_HINTS[course.slotCategory ?? ''] ?? SLOT_HINTS['Formación General']}
        </p>
      )}

      {/* Carga horaria semanal (dato real del catálogo) */}
      {hours && (
        <section className="mt-6" aria-label="Carga horaria semanal">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-text-primary">
            <Clock className="h-4 w-4 text-accent" aria-hidden />
            Carga semanal · {hours.total} h
          </h3>
          <dl className="mt-2.5 grid grid-cols-2 gap-x-6 gap-y-1.5 sm:grid-cols-3">
            {HOUR_LABELS.filter(([key]) => hours[key] > 0).map(([key, label]) => (
              <div key={key} className="flex items-baseline justify-between gap-2 text-sm">
                <dt className="text-text-secondary">{label}</dt>
                <dd className="font-medium text-text-primary">{hours[key]} h</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {/* Prerrequisitos */}
      <section className="mt-6" aria-label="Prerrequisitos">
        <h3 className="text-sm font-semibold text-text-primary">Prerrequisitos</h3>
        {prerequisites.length === 0 && !course.creditReq ? (
          <p className="mt-2 text-sm text-text-secondary">
            Sin prerrequisitos: puedes tomarlo desde el inicio.
          </p>
        ) : (
          <div className="mt-2.5 flex flex-wrap gap-2">
            {prerequisites.map(({ course: prereq, concurrent }) => (
              <button
                key={prereq.id}
                type="button"
                onClick={() => selectCourse(prereq.id)}
                className="flex min-h-[36px] items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-primary transition-colors hover:border-accent hover:bg-accent-light"
              >
                {prereq.name}
                {concurrent && <span className="text-text-secondary">· en paralelo</span>}
                <ArrowRight className="h-3 w-3 text-text-secondary" aria-hidden />
              </button>
            ))}
            {course.creditReq && (
              <span className="flex min-h-[36px] items-center gap-1.5 rounded-full border border-beige bg-beige-light px-3 py-1.5 text-xs font-medium text-text-primary">
                <Award className="h-3.5 w-3.5" aria-hidden />
                {course.creditReq} SCT aprobados
              </span>
            )}
          </div>
        )}
        {course.reqText && (
          <p className="mt-2.5 text-xs italic leading-relaxed text-text-secondary">
            Catálogo: “{course.reqText}”
          </p>
        )}
      </section>

      {/* Ramos que desbloquea */}
      {unlocks.length > 0 && (
        <section className="mt-6" aria-label="Ramos que desbloquea">
          <h3 className="text-sm font-semibold text-text-primary">Desbloquea</h3>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {unlocks.map((next) => (
              <button
                key={next.id}
                type="button"
                onClick={() => selectCourse(next.id)}
                className="flex min-h-[36px] items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-primary transition-colors hover:border-status-progress hover:bg-status-progress/10"
              >
                {next.name}
                <ArrowRight className="h-3 w-3 text-text-secondary" aria-hidden />
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Habilidades transversales */}
      {course.skills && (
        <p className="mt-5 flex items-center gap-1.5 text-xs text-text-secondary">
          <GraduationCap className="h-3.5 w-3.5" aria-hidden />
          Habilidades transversales: {course.skills}
        </p>
      )}

      {/* Cambio de estado */}
      <section className="mt-7" aria-label="Cambiar estado del ramo">
        <h3 className="text-sm font-semibold text-text-primary">Estado</h3>
        <div className="mt-2.5 grid grid-cols-3 gap-2">
          {statusOptions.map(({ value, icon: Icon, activeClass }) => (
            <button
              key={value}
              type="button"
              aria-pressed={status === value}
              onClick={() => handleStatus(value)}
              className={cn(
                'flex min-h-[44px] flex-col items-center justify-center gap-1 rounded-btn border px-2 py-2.5 text-xs font-medium transition-all',
                status === value
                  ? activeClass
                  : 'border-border bg-white text-text-secondary hover:bg-surface',
              )}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {STATUS_LABELS[value]}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

/**
 * Detalle de ramo: BottomSheet en mobile, Modal centrado en desktop.
 * Se abre cuando hay un selectedCourseId en el store.
 */
export function CourseDetail() {
  const isDesktop = useIsDesktop();
  const selectedCourseId = useCurriculumStore((s) => s.selectedCourseId);
  const selectCourse = useCurriculumStore((s) => s.selectCourse);
  const { plan } = useActivePlan();

  const course = plan?.courses.find((c) => c.id === selectedCourseId);

  // Conserva el último ramo mientras corre la animación de salida.
  const [cached, setCached] = useState<Course | null>(null);
  useEffect(() => {
    if (course) setCached(course);
  }, [course]);

  const display = course ?? cached;
  const open = Boolean(course);
  const onClose = () => selectCourse(null);

  if (!plan || !display) return null;

  const content = <CourseDetailContent key={display.id} course={display} plan={plan} />;

  return isDesktop ? (
    <Modal open={open} onClose={onClose} title={display.name}>
      {content}
    </Modal>
  ) : (
    <BottomSheet open={open} onClose={onClose} title={display.name}>
      {content}
    </BottomSheet>
  );
}
