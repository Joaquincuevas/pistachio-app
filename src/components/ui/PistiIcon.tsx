import { cn } from '@/lib/utils';

/** Icono de navegación de Pisti (su cara en insignia redonda). Acepta el mismo `className` que los iconos de lucide. */
export function PistiIcon({ className }: { className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }) {
  return (
    <img
      src="/logo.png"
      alt=""
      aria-hidden
      draggable={false}
      className={cn('shrink-0 scale-[1.5] rounded-full object-contain', className)}
    />
  );
}
