import { create } from 'zustand';

/** Preferencia del usuario. 'system' sigue el modo del teléfono o computador. */
export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

// Misma clave que lee public/theme-init.js antes de pintar (evita el destello claro).
const STORAGE_KEY = 'pistachio:theme';
// Color de la barra del navegador en el teléfono, por tema.
const THEME_COLOR: Record<ResolvedTheme, string> = { light: '#FFFFFF', dark: '#111312' };

const media =
  typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null;

function readMode(): ThemeMode {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {
    // Sin localStorage (modo privado estricto): se usa el del sistema.
  }
  return 'system';
}

function resolve(mode: ThemeMode): ResolvedTheme {
  if (mode === 'system') return media?.matches ? 'dark' : 'light';
  return mode;
}

function apply(theme: ResolvedTheme) {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.style.colorScheme = theme;
  document
    .querySelectorAll('meta[name="theme-color"]')
    .forEach((m) => m.setAttribute('content', THEME_COLOR[theme]));
}

interface ThemeState {
  mode: ThemeMode;
  resolved: ResolvedTheme;
  setMode: (mode: ThemeMode) => void;
  /** Alterna claro ↔ oscuro (lo que se ve), fijando la preferencia. */
  toggle: () => void;
}

const initialMode = typeof window !== 'undefined' ? readMode() : 'system';

export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: initialMode,
  resolved: typeof window !== 'undefined' ? resolve(initialMode) : 'light',

  setMode: (mode) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // No crítico: el tema se aplica igual en esta sesión.
    }
    const resolved = resolve(mode);
    apply(resolved);
    set({ mode, resolved });
  },

  toggle: () => get().setMode(get().resolved === 'dark' ? 'light' : 'dark'),
}));

// Aplica al cargar y sigue al sistema en vivo cuando la preferencia es 'system'.
if (typeof window !== 'undefined') {
  apply(useThemeStore.getState().resolved);
  media?.addEventListener('change', () => {
    const { mode } = useThemeStore.getState();
    if (mode !== 'system') return;
    const resolved = resolve('system');
    apply(resolved);
    useThemeStore.setState({ resolved });
  });
}
