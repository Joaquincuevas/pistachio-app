import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Circle, Clock } from 'lucide-react';
import { useActivePlan } from '@/hooks/useActivePlan';
import { useIsDesktop } from '@/hooks/useMediaQuery';
import { cn, STATUS_LABELS } from '@/lib/utils';
import { useCurriculumStore } from '@/stores/useCurriculumStore';
import { useToastStore } from '@/stores/useToastStore';
import type { CourseStatus } from '@/types';

const options: { value: CourseStatus; icon: typeof Circle; color: string }[] = [
  { value: 'completed', icon: CheckCircle2, color: 'text-status-completed' },
  { value: 'in-progress', icon: Clock, color: 'text-status-progress' },
  { value: 'pending', icon: Circle, color: 'text-text-secondary' },
];

const MENU_WIDTH = 224;

/**
 * Menú contextual para marcar un ramo como Cursado / En progreso / Pendiente.
 * Popover junto al cursor en desktop; mini sheet inferior en mobile.
 */
export function StatusMenu() {
  const menu = useCurriculumStore((s) => s.statusMenu);
  const close = useCurriculumStore((s) => s.closeStatusMenu);
  const setCourseStatus = useCurriculumStore((s) => s.setCourseStatus);
  const getStatus = useCurriculumStore((s) => s.getCourseStatus);
  const show = useToastStore((s) => s.show);
  const isDesktop = useIsDesktop();
  const { plan } = useActivePlan();

  const course = menu ? plan?.courses.find((c) => c.id === menu.courseId) : undefined;

  const choose = (status: CourseStatus) => {
    if (!course) return;
    setCourseStatus(course.id, status);
    show(`${course.name} marcado como ${STATUS_LABELS[status].toLowerCase()}`);
    close();
  };

  const items = course
    ? options.map(({ value, icon: Icon, color }) => {
        const active = getStatus(course.id) === value;
        return (
          <button
            key={value}
            type="button"
            role="menuitem"
            onClick={() => choose(value)}
            className={cn(
              'flex min-h-[44px] w-full items-center gap-3 rounded-btn px-3 text-sm transition-colors',
              active
                ? 'bg-accent-light font-medium text-text-primary'
                : 'text-text-primary hover:bg-surface',
            )}
          >
            <Icon className={cn('h-[18px] w-[18px]', color)} aria-hidden />
            {STATUS_LABELS[value]}
          </button>
        );
      })
    : null;

  return (
    <AnimatePresence>
      {menu && course && (
        <div className="fixed inset-0 z-50" role="menu" aria-label={`Cambiar estado de ${course.name}`}>
          <motion.button
            type="button"
            aria-label="Cerrar menú"
            className={cn('absolute inset-0', !isDesktop && 'bg-text-primary/25')}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            onClick={close}
            tabIndex={-1}
          />
          {isDesktop ? (
            <motion.div
              className="absolute w-56 rounded-card border border-border bg-white p-1.5 shadow-modal"
              style={{
                left: Math.min(menu.x, window.innerWidth - MENU_WIDTH - 16),
                top: Math.min(menu.y, window.innerHeight - 220),
              }}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.12, ease: 'easeOut' }}
            >
              <p className="truncate px-3 pb-1 pt-2 text-xs font-medium text-text-secondary">
                {course.name}
              </p>
              {items}
            </motion.div>
          ) : (
            <motion.div
              className="absolute inset-x-3 bottom-3 rounded-card border border-border bg-white p-2 pb-safe shadow-modal"
              initial={{ opacity: 0, y: 32 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 24 }}
              transition={{ duration: 0.18, ease: [0.32, 0.72, 0, 1] }}
            >
              <p className="truncate px-3 pb-1.5 pt-2 text-xs font-medium text-text-secondary">
                {course.name}
              </p>
              {items}
            </motion.div>
          )}
        </div>
      )}
    </AnimatePresence>
  );
}
