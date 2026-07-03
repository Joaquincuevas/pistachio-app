import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/useAuthStore';
import { useCurriculumStore } from '@/stores/useCurriculumStore';

/** Exige sesión iniciada. Redirige a /login conservando el destino. */
export function RequireAuth() {
  const user = useAuthStore((s) => s.user);
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  return <Outlet />;
}

/** Exige especialidad elegida antes de entrar a la app (malla, búsqueda, perfil). */
export function RequireSpecialty() {
  const specialtyId = useCurriculumStore((s) => s.specialtyId);

  if (!specialtyId) {
    return <Navigate to="/specialty" replace />;
  }
  return <Outlet />;
}

/** Si ya hay sesión, las páginas de auth redirigen directo a la app. */
export function RedirectIfAuthed() {
  const user = useAuthStore((s) => s.user);
  const specialtyId = useCurriculumStore((s) => s.specialtyId);

  if (user) {
    return <Navigate to={specialtyId ? '/malla' : '/specialty'} replace />;
  }
  return <Outlet />;
}
