import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { RedirectIfAuthed, RequireAuth, RequireSpecialty } from '@/components/ProtectedRoute';
import { Toaster } from '@/components/ui/Toast';
import { Advisor } from '@/pages/Advisor';
import { Dashboard } from '@/pages/Dashboard';
import { ForgotPassword } from '@/pages/ForgotPassword';
import { Landing } from '@/pages/Landing';
import { Login } from '@/pages/Login';
import { Profile } from '@/pages/Profile';
import { Register } from '@/pages/Register';
import { ResetPassword } from '@/pages/ResetPassword';
import { Search } from '@/pages/Search';
import { SpecialtySelect } from '@/pages/SpecialtySelect';
import { useAuthStore } from '@/stores/useAuthStore';
import { useCatalogStore } from '@/stores/useCatalogStore';

export default function App() {
  // Al cargar: valida la cookie de sesión y trae el catálogo de planes.
  useEffect(() => {
    void useAuthStore.getState().hydrate();
    void useCatalogStore.getState().load();
  }, []);

  return (
    <>
      <Routes>
        <Route path="/" element={<Landing />} />

        <Route element={<RedirectIfAuthed />}>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot" element={<ForgotPassword />} />
        </Route>

        {/* Reset por link de correo: accesible con o sin sesión. */}
        <Route path="/reset" element={<ResetPassword />} />

        <Route element={<RequireAuth />}>
          <Route path="/specialty" element={<SpecialtySelect />} />

          <Route element={<RequireSpecialty />}>
            <Route element={<AppShell />}>
              <Route path="/malla" element={<Dashboard />} />
              <Route path="/asistente" element={<Advisor />} />
              <Route path="/search" element={<Search />} />
              <Route path="/profile" element={<Profile />} />
              {/* Perfil y Configuración quedaron unificados en /profile. */}
              <Route path="/settings" element={<Navigate to="/profile" replace />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <Toaster />
    </>
  );
}
