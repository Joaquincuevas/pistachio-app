import { memo } from 'react';
import { StatusBadge } from '@/components/ui/Badge';
import { useLongPress } from '@/hooks/useLongPress';
import { STATUS_COLORS } from '@/lib/utils';
import type { Course, CourseStatus } from '@/types';

interface CourseCardProps {
  course: Course;
  status: CourseStatus;
  onOpen: (courseId: string) => void;
  /** Long-press (mobile) o click derecho (desktop) para cambiar estado. */
  onStatusMenu: (courseId: string, x: number, y: number) => void;
}

export const CourseCard = memo(function CourseCard({
  course,
  status,
  onOpen,
  onStatusMenu,
}: CourseCardProps) {
  const pressHandlers = useLongPress({
    onPress: () => onOpen(course.id),
    onLongPress: (x, y) => onStatusMenu(course.id, x, y),
  });

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${course.name}, ${course.credits} créditos, ${status === 'completed' ? 'cursado' : status === 'in-progress' ? 'en progreso' : 'pendiente'}`}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen(course.id);
        }
      }}
      className="press-target min-h-[44px] cursor-pointer touch-pan-y rounded-card border border-border border-l-4 bg-white p-4 shadow-subtle transition-all duration-150 hover:border-accent/40 hover:shadow-raised active:scale-[0.99]"
      style={{ borderLeftColor: STATUS_COLORS[status] }}
      {...pressHandlers}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-medium leading-snug text-text-primary">{course.name}</h3>
        <StatusBadge status={status} />
      </div>
      <p className="mt-1.5 text-xs text-text-secondary">
        {course.id} · {course.credits} créditos
      </p>
    </div>
  );
});
