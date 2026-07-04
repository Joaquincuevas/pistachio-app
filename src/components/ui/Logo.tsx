import { cn } from '@/lib/utils';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-14 w-14',
};

/**
 * Marca de Pistachio: la semilla verde del pistacho emergiendo de su cáscara
 * (drupa). Vectorial y a dos tonos de marca (verde acento + beige).
 */
export function Logo({ size = 'md', className }: LogoProps) {
  return (
    <svg
      viewBox="0 0 40 40"
      role="img"
      aria-label="Pistachio"
      className={cn('shrink-0', sizeClasses[size], className)}
    >
      {/* Semilla (kernel) verde */}
      <path
        d="M20 3c5 0 9 6 9 13s-4 12-9 12-9-5-9-12 4-13 9-13Z"
        fill="#4A7C59"
      />
      {/* Costura sutil de la semilla */}
      <path
        d="M20 6c-1.2 3-1.2 9 0 12"
        stroke="#6BA876"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
        opacity="0.6"
      />
      {/* Cáscara (shell) beige que la sostiene */}
      <path
        d="M6.5 20.5c0-.9 1-1.5 1.8-1 3.2 1.8 7.1 2.9 11.7 2.9s8.5-1.1 11.7-2.9c.8-.5 1.8.1 1.8 1C33.5 29 27.5 35.5 20 35.5S6.5 29 6.5 20.5Z"
        fill="#E8DCC4"
      />
      {/* Filo de la cáscara para separarla del fondo blanco */}
      <path
        d="M8 21c3.4 1.8 7.4 2.8 12 2.8s8.6-1 12-2.8"
        stroke="#DCCBA6"
        strokeWidth="1.1"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
