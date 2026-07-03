import { Logo } from './Logo';

/** Pantalla mínima mientras se valida la sesión contra la API. */
export function SplashScreen() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-surface">
      <div className="animate-pulse">
        <Logo size="lg" />
      </div>
    </div>
  );
}
