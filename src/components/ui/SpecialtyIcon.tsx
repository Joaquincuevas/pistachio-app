import { Building2, Cpu, Factory, GraduationCap, Leaf, Zap, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

const icons: Record<string, LucideIcon> = {
  factory: Factory,
  building: Building2,
  zap: Zap,
  cpu: Cpu,
  leaf: Leaf,
};

interface SpecialtyIconProps {
  icon: string;
  className?: string;
}

/** Icono de línea de una especialidad (reemplaza los emojis: estética sobria). */
export function SpecialtyIcon({ icon, className }: SpecialtyIconProps) {
  const Icon = icons[icon] ?? GraduationCap;
  return <Icon className={cn('h-5 w-5', className)} aria-hidden />;
}
