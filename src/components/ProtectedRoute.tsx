import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { SplashScreen } from '@/components/ui/SplashScreen';
import { useAuthStore } from '@/stores/useAuthStore';
import { useCurriculumStore } from '@/stores/useCurriculumStore';

/**
 * Exige sesión válida (cookie verificada contra la API).
 * Mientras la sesión se hidrata muestra un splash para evitar redirecciones falsas.
 */
export function RequireAuth() {
  const status = useAuthStore((s) => s.status);
  const location = useLocation();

  if (status === 'unknown') return <SplashScreen />;
  if (status === 'guest') {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  return <Outlet />;
}

/** Exige especialidad y plan elegidos antes de entrar a la app. */
export function RequireSpecialty() {
  const specialtyId = useCurriculumStore((s) => s.specialtyId);
  const planId = useCurriculumStore((s) => s.planId);

  if (!specialtyId || !planId) {
    return <Navigate to="/specialty" replace />;
  }
  return <Outlet />;
}

/** Si ya hay sesión, las páginas de auth redirigen directo a la app. */
export function RedirectIfAuthed() {
  const status = useAuthStore((s) => s.status);
  const planId = useCurriculumStore((s) => s.planId);

  if (status === 'unknown') return <SplashScreen />;
  if (status === 'authed') {
    return <Navigate to={planId ? '/malla' : '/specialty'} replace />;
  }
  return <Outlet />;
}
