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

/** Marca de Pistachio: la semilla del pistacho emergiendo de su cáscara. */
export function Logo({ size = 'md', className }: LogoProps) {
  return (
    <img
      src="/logo.png"
      alt="Pistachio"
      className={cn('shrink-0 object-contain', sizeClasses[size], className)}
    />
  );
}
