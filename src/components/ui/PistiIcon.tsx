import { cn } from '@/lib/utils';

/** Icono de navegación de Pisti (su logo, sin recorte). Acepta el mismo `className` que los iconos de lucide. */
export function PistiIcon({ className }: { className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }) {
  return (
    <img
      src="/logo.png"
      alt=""
      aria-hidden
      draggable={false}
      className={cn('shrink-0 scale-[1.5] object-contain', className)}
    />
  );
}
