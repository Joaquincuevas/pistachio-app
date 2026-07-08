import { useEffect } from 'react';
import { AnimatePresence, motion, type PanInfo } from 'framer-motion';
import { NavLink, useNavigate } from 'react-router-dom';
import { LogOut, X } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { NAV_LINKS } from './navLinks';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/useAuthStore';
import { useToastStore } from '@/stores/useToastStore';

interface MobileDrawerProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Menú lateral para mobile: se abre con el botón de tres barras del header
 * y reemplaza la barra inferior (que quedaba muy apretada con 5 secciones).
 * Entra con slide-in desde la izquierda y se cierra con swipe, tap en el
 * fondo oscurecido, Escape, o al elegir una sección.
 */
export function MobileDrawer({ open, onClose }: MobileDrawerProps) {
  const user = useAuthStore((s) => s.user);
  const show = useToastStore((s) => s.show);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -70 || info.velocity.x < -500) onClose();
  };

  const handleLogout = async () => {
    onClose();
    await useAuthStore.getState().logout();
    show('Sesión cerrada. ¡Hasta pronto!', 'info');
    navigate('/');
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <motion.button
            type="button"
            aria-label="Cerrar menú"
            className="absolute inset-0 bg-text-primary/30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            tabIndex={-1}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Menú de navegación"
            className="absolute inset-y-0 left-0 flex w-[78vw] max-w-[300px] flex-col bg-white pt-safe shadow-sheet"
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'tween', duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={{ left: 0.5, right: 0 }}
            onDragEnd={handleDragEnd}
          >
            <div className="flex items-center justify-between px-5 py-5">
              <div className="flex items-center gap-2.5">
                <Logo size="sm" />
                <span className="font-display text-xl font-semibold tracking-tight">
                  Pistachio
                </span>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar menú"
                className="flex h-8 w-8 items-center justify-center rounded-full text-text-secondary hover:bg-surface"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>

            <nav aria-label="Navegación principal" className="flex flex-1 flex-col gap-1 px-3">
              {NAV_LINKS.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  onClick={onClose}
                  className={({ isActive }) =>
                    cn(
                      'flex h-12 items-center gap-3 rounded-btn px-3 text-sm font-medium transition-colors',
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

            <div className="border-t border-border p-3 pb-safe">
              <div className="flex items-center gap-3 rounded-btn px-2 py-2">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-light text-sm font-semibold text-accent-hover">
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
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
