import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, ChevronRight, Clock, GraduationCap, LogOut, RefreshCw, Settings } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PageTransition } from '@/components/ui/PageTransition';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { Skeleton } from '@/components/ui/Skeleton';
import { SpecialtyIcon } from '@/components/ui/SpecialtyIcon';
import { useActivePlan } from '@/hooks/useActivePlan';
import { computeProgress } from '@/lib/utils';
import { useAuthStore } from '@/stores/useAuthStore';
import { useCurriculumStore } from '@/stores/useCurriculumStore';
import { useToastStore } from '@/stores/useToastStore';

export function Profile() {
  const user = useAuthStore((s) => s.user);
  const { specialty, plan, loading } = useActivePlan();
  const progressMap = useCurriculumStore((s) => s.progress);
  const show = useToastStore((s) => s.show);
  const navigate = useNavigate();

  const stats = useMemo(
    () => (plan ? computeProgress(plan, progressMap[plan.id] ?? {}) : null),
    [plan, progressMap],
  );

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-4 md:px-8 md:py-8">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="mt-4 h-24 rounded-card" />
        <Skeleton className="mt-3 h-24 rounded-card" />
        <Skeleton className="mt-3 h-56 rounded-card" />
      </div>
    );
  }

  if (!user || !specialty || !plan || !stats) return null;

  const memberSince = new Date(user.createdAt.replace(' ', 'T')).toLocaleDateString('es-CL', {
    month: 'long',
    year: 'numeric',
  });

  const handleLogout = async () => {
    await useAuthStore.getState().logout();
    show('Sesión cerrada. ¡Hasta pronto!', 'info');
    navigate('/');
  };

  return (
    <PageTransition className="mx-auto max-w-2xl px-4 py-4 md:px-8 md:py-8">
      <h1 className="font-display text-2xl text-text-primary md:text-3xl">Perfil</h1>

      {/* Usuario */}
      <Card className="mt-4 flex items-center gap-4 p-5">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-beige-light font-display text-2xl text-text-primary">
          {user.name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold text-text-primary">{user.name}</h2>
          <p className="truncate text-sm text-text-secondary">{user.email}</p>
          <p className="mt-0.5 text-xs text-text-secondary">Desde {memberSince}</p>
        </div>
      </Card>

      {/* Especialidad y plan */}
      <Card className="mt-3 flex items-center gap-4 p-5">
        <span
          aria-hidden
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-btn bg-accent-light"
        >
          <SpecialtyIcon icon={specialty.icon} className="h-6 w-6 text-accent" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-text-secondary">Especialidad</p>
          <h2 className="truncate text-base font-semibold text-text-primary">{specialty.name}</h2>
          <p className="truncate text-xs text-text-secondary">{plan.name}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => navigate('/specialty')}>
          <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          Cambiar
        </Button>
      </Card>

      {/* Estadísticas */}
      <Card className="mt-3 p-6">
        <h2 className="text-sm font-semibold text-text-primary">Tu avance</h2>
        <div className="mt-5 flex flex-col items-center gap-6 sm:flex-row sm:justify-around">
          <ProgressRing value={stats.percent} />
          <dl className="grid w-full max-w-xs gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-btn bg-status-completed/15">
                <GraduationCap className="h-4 w-4 text-status-completed" aria-hidden />
              </div>
              <div className="flex-1">
                <dt className="text-xs text-text-secondary">Ramos completados</dt>
                <dd className="text-sm font-semibold text-text-primary">
                  {stats.completedCourses} de {stats.totalCourses}
                </dd>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-btn bg-status-progress/15">
                <Clock className="h-4 w-4 text-status-progress" aria-hidden />
              </div>
              <div className="flex-1">
                <dt className="text-xs text-text-secondary">En progreso</dt>
                <dd className="text-sm font-semibold text-text-primary">
                  {stats.inProgressCourses} {stats.inProgressCourses === 1 ? 'ramo' : 'ramos'}
                </dd>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-btn bg-accent-light">
                <BookOpen className="h-4 w-4 text-accent" aria-hidden />
              </div>
              <div className="flex-1">
                <dt className="text-xs text-text-secondary">Créditos SCT aprobados</dt>
                <dd className="text-sm font-semibold text-text-primary">
                  {stats.completedCredits} de {stats.totalCredits}
                </dd>
              </div>
            </div>
          </dl>
        </div>
      </Card>

      {/* Configuración de la cuenta */}
      <Card
        interactive
        className="mt-3 flex items-center gap-4 p-5"
        role="button"
        tabIndex={0}
        aria-label="Abrir configuración"
        onClick={() => navigate('/settings')}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') navigate('/settings');
        }}
      >
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-btn bg-surface">
          <Settings className="h-5 w-5 text-text-secondary" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-text-primary">Configuración</h2>
          <p className="text-xs text-text-secondary">
            Contraseña, verificación en dos pasos y cuenta
          </p>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-text-secondary" aria-hidden />
      </Card>

      <Button variant="danger" fullWidth className="mb-10 mt-6" onClick={handleLogout}>
        <LogOut className="h-4 w-4" aria-hidden />
        Cerrar sesión
      </Button>
    </PageTransition>
  );
}
