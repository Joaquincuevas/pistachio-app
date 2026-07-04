import { useMemo } from 'react';
import { CourseCard } from './CourseCard';
import { groupBySemester } from '@/lib/utils';
import { useCurriculumStore } from '@/stores/useCurriculumStore';
import type { Plan } from '@/types';

const EMPTY_PROGRESS: Record<string, never> = {};

/**
 * Vista grid: scroll vertical agrupado por semestre con headers sticky.
 * Tap abre el detalle; long-press / click derecho abre el menú de estado.
 */
export function MallaGrid({ plan }: { plan: Plan }) {
  const progressMap = useCurriculumStore((s) => s.progress);
  const selectCourse = useCurriculumStore((s) => s.selectCourse);
  const openStatusMenu = useCurriculumStore((s) => s.openStatusMenu);

  const statuses = progressMap[plan.id] ?? EMPTY_PROGRESS;
  const semesters = useMemo(() => [...groupBySemester(plan.courses)], [plan]);

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
              {courses.map((course) => (
                <CourseCard
                  key={course.id}
                  course={course}
                  status={statuses[course.id] ?? 'pending'}
                  onOpen={selectCourse}
                  onStatusMenu={(courseId, x, y) => openStatusMenu({ courseId, x, y })}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
