import { cn } from '@/lib/utils';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'h-9 w-9',
  md: 'h-11 w-11',
  lg: 'h-16 w-16',
};

/** Marca de Pistachio: la cara de Pisti, la mascota, en una insignia redonda. */
export function Logo({ size = 'md', className }: LogoProps) {
  return (
    <img
      src="/logo.png"
      alt="Pisti, la mascota de Pistachio"
      className={cn('shrink-0 object-contain', sizeClasses[size], className)}
    />
  );
}
