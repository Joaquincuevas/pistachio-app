import { cn } from '@/lib/utils';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'h-8 w-8 text-lg',
  md: 'h-10 w-10 text-xl',
  lg: 'h-14 w-14 text-3xl',
};

/**
 * Logo temporal de Pistachio: círculo verde oliva con la "P" en serif.
 * Reemplazar el contenido interno por el PNG real cuando esté disponible.
 */
export function Logo({ size = 'md', className }: LogoProps) {
  return (
    <div
      aria-hidden
      className={cn(
        'flex select-none items-center justify-center rounded-full bg-accent font-display text-white',
        sizeClasses[size],
        className,
      )}
    >
      P
    </div>
  );
}
