import { NavLink } from 'react-router-dom';
import { LayoutGrid, Search, User } from 'lucide-react';
import { cn } from '@/lib/utils';

const tabs = [
  { to: '/malla', label: 'Malla', icon: LayoutGrid },
  { to: '/search', label: 'Buscar', icon: Search },
  { to: '/profile', label: 'Perfil', icon: User },
];

/** Barra de navegación inferior fija (mobile). Respeta safe-area-inset-bottom. */
export function TabBar() {
  return (
    <nav
      aria-label="Navegación principal"
      className="border-t border-border bg-white pb-safe md:hidden"
    >
      <div className="flex">
        {tabs.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex min-h-[52px] flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] font-medium transition-colors',
                isActive ? 'text-accent' : 'text-text-secondary hover:text-text-primary',
              )
            }
          >
            <Icon className="h-5 w-5" aria-hidden />
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
