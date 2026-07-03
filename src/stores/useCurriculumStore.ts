import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '@/services/api';
import { collectPrerequisites } from '@/lib/utils';
import { useCatalogStore } from './useCatalogStore';
import { useToastStore } from './useToastStore';
import type { CourseStatus, UserSettings } from '@/types';

interface StatusMenuState {
  courseId: string;
  /** Coordenadas del click/tap para posicionar el menú en desktop. */
  x: number;
  y: number;
}

interface CurriculumState {
  specialtyId: string | null;
  planId: string | null;
  /** Progreso por plan → por ramo. Cache local; el servidor es la verdad. */
  progress: Record<string, Record<string, CourseStatus>>;
  /** Planes cuyo progreso ya se sincronizó en esta sesión. No se persiste. */
  syncedPlans: string[];
  /** Ramo abierto en el detalle (BottomSheet/Modal). No se persiste. */
  selectedCourseId: string | null;
  statusMenu: StatusMenuState | null;

  applySettings: (settings: UserSettings) => void;
  choosePlan: (specialtyId: string, planId: string) => Promise<void>;
  loadProgress: (planId: string) => Promise<void>;
  /**
   * Cambia el estado de un ramo. Marcar "cursado" arrastra en cascada todos
   * sus prerrequisitos. Devuelve cuántos ramos previos cambiaron además.
   */
  setCourseStatus: (courseId: string, status: CourseStatus) => number;
  getCourseStatus: (courseId: string) => CourseStatus;
  selectCourse: (courseId: string | null) => void;
  openStatusMenu: (menu: StatusMenuState) => void;
  closeStatusMenu: () => void;
  reset: () => void;
}

export const useCurriculumStore = create<CurriculumState>()(
  persist(
    (set, get) => ({
      specialtyId: null,
      planId: null,
      progress: {},
      syncedPlans: [],
      selectedCourseId: null,
      statusMenu: null,

      applySettings: ({ specialtyId, planId }) => set({ specialtyId, planId }),

      choosePlan: async (specialtyId, planId) => {
        const { settings } = await api.setPlan(specialtyId, planId);
        set({ specialtyId: settings.specialtyId, planId: settings.planId });
      },

      loadProgress: async (planId) => {
        if (get().syncedPlans.includes(planId)) return;
        try {
          const { statuses } = await api.getProgress(planId);
          set((state) => ({
            progress: { ...state.progress, [planId]: statuses },
            syncedPlans: [...state.syncedPlans, planId],
          }));
        } catch {
          // Sin conexión se sigue mostrando el cache persistido.
        }
      },

      setCourseStatus: (courseId, status) => {
        const { planId, progress } = get();
        if (!planId) return 0;
        const current = progress[planId] ?? {};

        // Al marcar cursado, los prerrequisitos transitivos también se marcan
        // (el servidor aplica exactamente la misma cascada).
        const targets: Record<string, CourseStatus> = { [courseId]: status };
        if (status === 'completed') {
          const plan = useCatalogStore
            .getState()
            .specialties.flatMap((s) => s.plans)
            .find((p) => p.id === planId);
          if (plan) {
            for (const prereqId of collectPrerequisites(courseId, plan.courses)) {
              if ((current[prereqId] ?? 'pending') !== 'completed') {
                targets[prereqId] = 'completed';
              }
            }
          }
        }

        const previous: Record<string, CourseStatus> = {};
        for (const id of Object.keys(targets)) {
          previous[id] = current[id] ?? 'pending';
        }

        // Actualización optimista; si la API falla se revierte todo.
        const apply = (values: Record<string, CourseStatus>) =>
          set((state) => ({
            progress: {
              ...state.progress,
              [planId]: { ...state.progress[planId], ...values },
            },
          }));

        apply(targets);
        api.setStatus(planId, courseId, status).catch(() => {
          apply(previous);
          useToastStore.getState().show('No se pudo guardar el cambio. Revisa tu conexión.', 'error');
        });

        return Object.keys(targets).length - 1;
      },

      getCourseStatus: (courseId) => {
        const { planId, progress } = get();
        if (!planId) return 'pending';
        return progress[planId]?.[courseId] ?? 'pending';
      },

      selectCourse: (courseId) => set({ selectedCourseId: courseId }),
      openStatusMenu: (menu) => set({ statusMenu: menu }),
      closeStatusMenu: () => set({ statusMenu: null }),

      reset: () =>
        set({
          specialtyId: null,
          planId: null,
          progress: {},
          syncedPlans: [],
          selectedCourseId: null,
          statusMenu: null,
        }),
    }),
    {
      name: 'pistachio:curriculum',
      // Cache para pintar al instante; el servidor reconcilia al hidratar.
      partialize: (state) => ({
        specialtyId: state.specialtyId,
        planId: state.planId,
        progress: state.progress,
      }),
    },
  ),
);
