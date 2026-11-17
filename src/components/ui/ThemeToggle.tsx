import { Monitor, Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useThemeStore, type ThemeMode } from '@/stores/useThemeStore';

/** Botón redondo que alterna claro ↔ oscuro (landing y headers). */
export function ThemeToggleButton({ className }: { className?: string }) {
  const resolved = useThemeStore((s) => s.resolved);
  const toggle = useThemeStore((s) => s.toggle);
  const dark = resolved === 'dark';
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      title={dark ? 'Modo claro' : 'Modo oscuro'}
      className={cn(
        'flex h-11 w-11 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-card/70 hover:text-text-primary active:scale-95',
        className,
      )}
    >
      {dark ? <Sun className="h-5 w-5" aria-hidden /> : <Moon className="h-5 w-5" aria-hidden />}
    </button>
  );
}

const OPTIONS: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Claro', icon: Sun },
  { value: 'dark', label: 'Oscuro', icon: Moon },
  { value: 'system', label: 'Sistema', icon: Monitor },
];

/** Selector de 3 opciones para Perfil → Apariencia. Ocupa todo el ancho en el teléfono. */
export function ThemeSelector() {
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);
  return (
    <div
      role="radiogroup"
      aria-label="Tema de la app"
      className="grid grid-cols-3 gap-1 rounded-btn border border-border bg-surface p-1"
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const active = mode === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setMode(value)}
            className={cn(
              'flex min-h-[44px] items-center justify-center gap-2 rounded-[9px] px-2 text-sm font-medium transition-colors',
              active
                ? 'bg-card text-text-primary shadow-subtle ring-1 ring-border-strong'
                : 'text-text-secondary hover:text-text-primary',
            )}
          >
            <Icon className="h-4 w-4" aria-hidden />
            {label}
          </button>
        );
      })}
    </div>
  );
}
