import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '@/services/api';
import { useCurriculumStore } from './useCurriculumStore';
import type { User, UserSettings } from '@/types';

/**
 * 'unknown' mientras se valida la cookie de sesión contra la API al cargar
 * la app; las rutas protegidas muestran un splash durante ese estado.
 */
export type AuthStatus = 'unknown' | 'authed' | 'guest';

interface AuthState {
  user: User | null;
  status: AuthStatus;
  setAuth: (user: User, settings: UserSettings) => void;
  hydrate: () => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      status: 'unknown',

      setAuth: (user, settings) => {
        set({ user, status: 'authed' });
        useCurriculumStore.getState().applySettings(settings);
      },

      hydrate: async () => {
        try {
          const { user, settings } = await api.me();
          set({ user, status: 'authed' });
          useCurriculumStore.getState().applySettings(settings);
        } catch {
          set({ user: null, status: 'guest' });
        }
      },

      logout: async () => {
        try {
          await api.logout();
        } catch {
          // La sesión local se cierra igual aunque la API no responda.
        }
        set({ user: null, status: 'guest' });
        useCurriculumStore.getState().reset();
      },
    }),
    {
      name: 'pistachio:auth',
      // El status siempre parte en 'unknown': la cookie es la fuente de verdad.
      partialize: (state) => ({ user: state.user }),
    },
  ),
);
