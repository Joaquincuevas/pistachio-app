import { Logo } from '@/components/ui/Logo';
import { useActivePlan } from '@/hooks/useActivePlan';

/** Header superior, solo visible en mobile. Respeta el notch de iOS. */
export function Header() {
  const { specialty } = useActivePlan();

  return (
    <header className="border-b border-border bg-white pt-safe md:hidden">
      <div className="flex h-14 items-center justify-between px-4">
        <div className="flex items-center gap-2.5">
          <Logo size="sm" />
          <span className="font-display text-xl">Pistachio</span>
        </div>
        {specialty && (
          <span className="flex items-center gap-1.5 rounded-full bg-surface px-3 py-1 text-xs font-medium text-text-secondary">
            <span aria-hidden>{specialty.emoji}</span>
            {specialty.name}
          </span>
        )}
      </div>
    </header>
  );
}
