import { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, Circle, Clock, Target } from 'lucide-react';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Modal } from '@/components/ui/Modal';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { getSpecialty } from '@/data/curriculum';
import { useIsDesktop } from '@/hooks/useMediaQuery';
import { cn, STATUS_LABELS } from '@/lib/utils';
import { useCurriculumStore } from '@/stores/useCurriculumStore';
import { useToastStore } from '@/stores/useToastStore';
import type { Course, CourseStatus, Specialty } from '@/types';

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

function CourseDetailContent({ course, specialty }: { course: Course; specialty: Specialty }) {
  const progressMap = useCurriculumStore((s) => s.progress);
  const setCourseStatus = useCurriculumStore((s) => s.setCourseStatus);
  const selectCourse = useCurriculumStore((s) => s.selectCourse);
  const show = useToastStore((s) => s.show);

  const status: CourseStatus = progressMap[specialty.id]?.[course.id] ?? 'pending';
  const byId = new Map(specialty.courses.map((c) => [c.id, c]));
  const prerequisites = course.prerequisites
    .map((id) => byId.get(id))
    .filter((c): c is Course => c !== undefined);
  const unlocks = specialty.courses.filter((c) => c.prerequisites.includes(course.id));

  const handleStatus = (next: CourseStatus) => {
    setCourseStatus(course.id, next);
    show(`${course.name} marcado como ${STATUS_LABELS[next].toLowerCase()}`);
  };

  return (
    <div className="px-6 pb-8 pt-2 md:pt-6">
      {/* Encabezado */}
      <div className="pr-8">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="beige">{course.id}</Badge>
          <Badge>Semestre {course.semester}</Badge>
          <Badge>{course.credits} créditos</Badge>
          <StatusBadge status={status} />
        </div>
        <h2 className="mt-3 font-display text-3xl leading-tight text-text-primary">
          {course.name}
        </h2>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-text-secondary">{course.description}</p>

      {/* Objetivos */}
      <section className="mt-6" aria-label="Objetivos del ramo">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-text-primary">
          <Target className="h-4 w-4 text-accent" aria-hidden />
          Objetivos
        </h3>
        <ul className="mt-2.5 space-y-2">
          {course.objectives.map((objective) => (
            <li key={objective} className="flex gap-2.5 text-sm leading-snug text-text-secondary">
              <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent/60" aria-hidden />
              {objective}
            </li>
          ))}
        </ul>
      </section>

      {/* Prerrequisitos */}
      <section className="mt-6" aria-label="Prerrequisitos">
        <h3 className="text-sm font-semibold text-text-primary">Prerrequisitos</h3>
        {prerequisites.length === 0 ? (
          <p className="mt-2 text-sm text-text-secondary">
            Sin prerrequisitos: puedes tomarlo desde el inicio.
          </p>
        ) : (
          <div className="mt-2.5 flex flex-wrap gap-2">
            {prerequisites.map((prereq) => (
              <button
                key={prereq.id}
                type="button"
                onClick={() => selectCourse(prereq.id)}
                className="flex min-h-[36px] items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-primary transition-colors hover:border-accent hover:bg-accent-light"
              >
                {prereq.name}
                <ArrowRight className="h-3 w-3 text-text-secondary" aria-hidden />
              </button>
            ))}
          </div>
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
  const specialtyId = useCurriculumStore((s) => s.specialtyId);

  const specialty = getSpecialty(specialtyId);
  const course = specialty?.courses.find((c) => c.id === selectedCourseId);

  // Conserva el último ramo mientras corre la animación de salida.
  const [cached, setCached] = useState<Course | null>(null);
  useEffect(() => {
    if (course) setCached(course);
  }, [course]);

  const display = course ?? cached;
  const open = Boolean(course);
  const onClose = () => selectCourse(null);

  if (!specialty || !display) return null;

  const content = <CourseDetailContent key={display.id} course={display} specialty={specialty} />;

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
