import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { RedirectIfAuthed, RequireAuth, RequireSpecialty } from '@/components/ProtectedRoute';
import { Toaster } from '@/components/ui/Toast';
import { Dashboard } from '@/pages/Dashboard';
import { Landing } from '@/pages/Landing';
import { Login } from '@/pages/Login';
import { Profile } from '@/pages/Profile';
import { Register } from '@/pages/Register';
import { Search } from '@/pages/Search';
import { SpecialtySelect } from '@/pages/SpecialtySelect';

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Landing />} />

        <Route element={<RedirectIfAuthed />}>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
        </Route>

        <Route element={<RequireAuth />}>
          <Route path="/specialty" element={<SpecialtySelect />} />

          <Route element={<RequireSpecialty />}>
            <Route element={<AppShell />}>
              <Route path="/malla" element={<Dashboard />} />
              <Route path="/search" element={<Search />} />
              <Route path="/profile" element={<Profile />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <Toaster />
    </>
  );
}
