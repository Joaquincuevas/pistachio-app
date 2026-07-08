import { useState } from 'react';
import { Menu } from 'lucide-react';
import { MobileDrawer } from './MobileDrawer';
import { Logo } from '@/components/ui/Logo';
import { SpecialtyIcon } from '@/components/ui/SpecialtyIcon';
import { useActivePlan } from '@/hooks/useActivePlan';

/** Header superior, solo visible en mobile. Respeta el notch de iOS. */
export function Header() {
  const { specialty } = useActivePlan();
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <header className="border-b border-border bg-white pt-safe md:hidden">
      <div className="flex h-14 items-center justify-between px-3">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Abrir menú"
            className="flex h-10 w-10 items-center justify-center rounded-btn text-text-secondary hover:bg-surface hover:text-text-primary"
          >
            <Menu className="h-5 w-5" aria-hidden />
          </button>
          <div className="flex items-center gap-2">
            <Logo size="sm" />
            <span className="font-display text-xl font-semibold tracking-tight">Pistachio</span>
          </div>
        </div>
        {specialty && (
          <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-surface px-3 py-1 text-xs font-medium text-text-secondary">
            <SpecialtyIcon icon={specialty.icon} className="h-3.5 w-3.5 text-accent" />
            {specialty.name}
          </span>
        )}
      </div>

      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </header>
  );
}
