import { cn } from '@/lib/utils';

/** Placeholder de carga con pulso sutil. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-input bg-border/60', className)} aria-hidden />;
}
