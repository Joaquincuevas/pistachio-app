import { CalendarDays, LayoutGrid, Search, User } from 'lucide-react';
import type { ComponentType } from 'react';
import { PistiIcon } from '@/components/ui/PistiIcon';

export interface NavLinkItem {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>;
}

/** Navegación principal, compartida entre el sidebar (desktop) y el drawer (mobile). */
export const NAV_LINKS: NavLinkItem[] = [
  { to: '/malla', label: 'Mi malla', icon: LayoutGrid },
  { to: '/asistente', label: 'Pisti', icon: PistiIcon },
  { to: '/horario', label: 'Horario', icon: CalendarDays },
  { to: '/search', label: 'Buscar', icon: Search },
  { to: '/profile', label: 'Perfil', icon: User },
];
