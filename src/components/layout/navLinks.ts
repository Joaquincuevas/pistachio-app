import { CalendarDays, LayoutGrid, Search, Sparkles, User } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface NavLinkItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

/** Navegación principal, compartida entre el sidebar (desktop) y el drawer (mobile). */
export const NAV_LINKS: NavLinkItem[] = [
  { to: '/malla', label: 'Mi malla', icon: LayoutGrid },
  { to: '/asistente', label: 'Asistente', icon: Sparkles },
  { to: '/horario', label: 'Horario', icon: CalendarDays },
  { to: '/search', label: 'Buscar', icon: Search },
  { to: '/profile', label: 'Perfil', icon: User },
];
