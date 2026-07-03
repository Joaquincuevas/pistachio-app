import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { useToastStore, type ToastType } from '@/stores/useToastStore';
import { cn } from '@/lib/utils';

const icons: Record<ToastType, typeof Info> = {
  success: CheckCircle2,
  info: Info,
  error: AlertCircle,
};

const iconColors: Record<ToastType, string> = {
  success: 'text-accent',
  info: 'text-status-progress',
  error: 'text-danger',
};

/** Contenedor global de toasts. Se monta una vez en App. */
export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col items-center gap-2 px-4 pt-safe"
    >
      <div className="h-3" />
      <AnimatePresence>
        {toasts.map((toast) => {
          const Icon = icons[toast.type];
          return (
            <motion.button
              key={toast.id}
              type="button"
              onClick={() => dismiss(toast.id)}
              initial={{ opacity: 0, y: -12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.97 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className={cn(
                'pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-card border border-border',
                'bg-white px-4 py-3 text-left text-sm text-text-primary shadow-modal',
              )}
            >
              <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', iconColors[toast.type])} aria-hidden />
              <span className="leading-snug">{toast.message}</span>
            </motion.button>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
