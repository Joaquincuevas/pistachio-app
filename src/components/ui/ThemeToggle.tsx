import { Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useThemeStore } from '@/stores/useThemeStore';

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

/**
 * Interruptor compacto sol / luna para Configuración.
 * Mientras el usuario no elija, sigue el modo del sistema; al tocar, fija el elegido.
 */
export function ThemeSwitch() {
  const resolved = useThemeStore((s) => s.resolved);
  const setMode = useThemeStore((s) => s.setMode);
  const options = [
    { value: 'light' as const, label: 'Modo claro', icon: Sun },
    { value: 'dark' as const, label: 'Modo oscuro', icon: Moon },
  ];
  return (
    <div
      role="radiogroup"
      aria-label="Tema de la app"
      className="flex shrink-0 rounded-full border border-border bg-surface p-1"
    >
      {options.map(({ value, label, icon: Icon }) => {
        const active = resolved === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            onClick={() => setMode(value)}
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-full transition-all',
              active
                ? 'bg-card text-text-primary shadow-subtle ring-1 ring-border-strong'
                : 'text-text-tertiary hover:text-text-primary',
            )}
          >
            <Icon className="h-4 w-4" aria-hidden />
          </button>
        );
      })}
    </div>
  );
}
