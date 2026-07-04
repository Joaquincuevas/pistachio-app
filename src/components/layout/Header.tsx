import { Logo } from '@/components/ui/Logo';
import { SpecialtyIcon } from '@/components/ui/SpecialtyIcon';
import { useActivePlan } from '@/hooks/useActivePlan';

/** Header superior, solo visible en mobile. Respeta el notch de iOS. */
export function Header() {
  const { specialty } = useActivePlan();

  return (
    <header className="border-b border-border bg-white pt-safe md:hidden">
      <div className="flex h-14 items-center justify-between px-4">
        <div className="flex items-center gap-2.5">
          <Logo size="sm" />
          <span className="font-display text-xl font-semibold tracking-tight">Pistachio</span>
        </div>
        {specialty && (
          <span className="flex items-center gap-1.5 rounded-full bg-surface px-3 py-1 text-xs font-medium text-text-secondary">
            <SpecialtyIcon icon={specialty.icon} className="h-3.5 w-3.5 text-accent" />
            {specialty.name}
          </span>
        )}
      </div>
    </header>
  );
}
