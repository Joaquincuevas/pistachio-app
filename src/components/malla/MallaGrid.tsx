import { useMemo } from 'react';
import { CourseCard } from './CourseCard';
import { groupBySemester, isPractice } from '@/lib/utils';
import { useCurriculumStore } from '@/stores/useCurriculumStore';
import type { Course, Plan } from '@/types';

const EMPTY_PROGRESS: Record<string, never> = {};

/**
 * Vista grid: scroll vertical agrupado por semestre con headers sticky.
 * Tap abre el detalle; long-press / click derecho abre el menú de estado.
 * Las prácticas van en una sección propia al final (no dentro de un semestre).
 */
export function MallaGrid({ plan }: { plan: Plan }) {
  const progressMap = useCurriculumStore((s) => s.progress);
  const selectCourse = useCurriculumStore((s) => s.selectCourse);
  const openStatusMenu = useCurriculumStore((s) => s.openStatusMenu);

  const statuses = progressMap[plan.id] ?? EMPTY_PROGRESS;
  const { semesters, practices } = useMemo(() => {
    const regular = plan.courses.filter((c) => !isPractice(c));
    return {
      semesters: [...groupBySemester(regular)],
      practices: plan.courses.filter(isPractice).sort((a, b) => a.semester - b.semester),
    };
  }, [plan]);

  const renderCard = (course: Course) => (
    <CourseCard
      key={course.id}
      course={course}
      status={statuses[course.id] ?? 'pending'}
      onOpen={selectCourse}
      onStatusMenu={(courseId, x, y) => openStatusMenu({ courseId, x, y })}
    />
  );

  return (
    <div className="pb-10">
      {semesters.map(([semester, courses]) => {
        const credits = courses.reduce((sum, c) => sum + c.credits, 0);
        return (
          <section key={semester} aria-label={`Semestre ${semester}`}>
            <div className="sticky top-0 z-10 -mx-4 border-b border-border/70 bg-surface/95 px-8 py-2.5 backdrop-blur-sm md:-mx-8 md:px-16">
              <div className="flex items-baseline justify-between">
                <h2 className="text-base font-semibold tracking-tight text-text-primary">
                  Semestre {semester}
                </h2>
                <span className="text-xs text-text-secondary">
                  {courses.length} ramos · {credits} SCT
                </span>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 py-4 sm:grid-cols-2 xl:grid-cols-3">
              {courses.map(renderCard)}
            </div>
          </section>
        );
      })}

      {/* Prácticas (pre-profesional / profesional): al pie de la malla. */}
      {practices.length > 0 && (
        <section aria-label="Prácticas">
          <div className="sticky top-0 z-10 -mx-4 border-b border-border/70 bg-surface/95 px-8 py-2.5 backdrop-blur-sm md:-mx-8 md:px-16">
            <div className="flex items-baseline justify-between">
              <h2 className="text-base font-semibold tracking-tight text-text-primary">Prácticas</h2>
              <span className="text-xs text-text-secondary">
                Se habilitan por créditos aprobados
              </span>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 py-4 sm:grid-cols-2 xl:grid-cols-3">
            {practices.map(renderCard)}
          </div>
        </section>
      )}
    </div>
  );
}
