import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutGrid, LogOut, Search, User } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/useAuthStore';
import { useToastStore } from '@/stores/useToastStore';

const links = [
  { to: '/malla', label: 'Mi malla', icon: LayoutGrid },
  { to: '/search', label: 'Buscar', icon: Search },
  { to: '/profile', label: 'Perfil', icon: User },
];

/** Navegación lateral minimal, solo desktop. */
export function Sidebar() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const show = useToastStore((s) => s.show);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    show('Sesión cerrada. ¡Hasta pronto!', 'info');
    navigate('/');
  };

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-white md:flex">
      <div className="flex items-center gap-2.5 px-5 py-6">
        <Logo size="sm" />
        <span className="font-display text-2xl">Pistachio</span>
      </div>

      <nav aria-label="Navegación principal" className="flex flex-1 flex-col gap-1 px-3">
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex h-11 items-center gap-3 rounded-btn px-3 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-accent-light text-accent-hover'
                  : 'text-text-secondary hover:bg-surface hover:text-text-primary',
              )
            }
          >
            <Icon className="h-[18px] w-[18px]" aria-hidden />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-border p-3">
        <div className="flex items-center gap-3 rounded-btn px-2 py-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-beige-light font-display text-lg text-text-primary">
            {user?.name.charAt(0).toUpperCase() ?? '?'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-text-primary">{user?.name}</p>
            <p className="truncate text-xs text-text-secondary">{user?.email}</p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            aria-label="Cerrar sesión"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-btn text-text-secondary transition-colors hover:bg-danger/10 hover:text-danger"
          >
            <LogOut className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>
    </aside>
  );
}
