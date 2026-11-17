import type { HTMLAttributes } from 'react';
import { cn, STATUS_LABELS } from '@/lib/utils';
import type { CourseStatus } from '@/types';

type BadgeVariant = 'default' | 'accent' | 'beige' | CourseStatus;

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-surface text-text-secondary border border-border',
  accent: 'bg-accent-light text-accent-hover',
  beige: 'bg-beige-light text-text-primary',
  completed: 'bg-status-completed/15 text-status-completed-text',
  'in-progress': 'bg-status-progress/15 text-status-progress-text',
  pending: 'bg-surface text-text-secondary border border-border',
};

export function Badge({ variant = 'default', className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  );
}

/** Badge preconfigurado para el estado de un ramo. */
export function StatusBadge({ status }: { status: CourseStatus }) {
  return <Badge variant={status}>{STATUS_LABELS[status]}</Badge>;
}
