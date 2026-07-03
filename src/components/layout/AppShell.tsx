import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { TabBar } from './TabBar';
import { CourseDetail } from '@/components/malla/CourseDetail';
import { StatusMenu } from '@/components/malla/StatusMenu';
import { useCurriculumStore } from '@/stores/useCurriculumStore';

/**
 * Layout autenticado: sidebar en desktop, header + tabbar en mobile.
 * El scroll vive dentro de <main>, lo que permite headers sticky internos
 * y un grafo a pantalla completa sin overflow del body.
 */
export function AppShell() {
  const planId = useCurriculumStore((s) => s.planId);

  // Sincroniza el progreso del plan activo desde el servidor (una vez por sesión).
  useEffect(() => {
    if (planId) void useCurriculumStore.getState().loadProgress(planId);
  }, [planId]);

  return (
    <div className="flex h-dvh overflow-hidden bg-surface">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <main className="min-h-0 flex-1 overflow-y-auto">
          <Outlet />
        </main>
        <TabBar />
      </div>

      {/* Overlays compartidos entre Malla y Búsqueda */}
      <CourseDetail />
      <StatusMenu />
    </div>
  );
}
