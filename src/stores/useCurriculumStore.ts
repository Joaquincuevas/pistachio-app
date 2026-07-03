import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CourseStatus } from '@/types';

interface StatusMenuState {
  courseId: string;
  /** Coordenadas del click/tap para posicionar el menú en desktop. */
  x: number;
  y: number;
}

interface CurriculumState {
  specialtyId: string | null;
  /** Progreso por especialidad → por ramo. Cambiar de especialidad no borra avances. */
  progress: Record<string, Record<string, CourseStatus>>;
  /** Ramo abierto en el detalle (BottomSheet/Modal). No se persiste. */
  selectedCourseId: string | null;
  /** Menú contextual de cambio de estado. No se persiste. */
  statusMenu: StatusMenuState | null;

  setSpecialty: (specialtyId: string) => void;
  setCourseStatus: (courseId: string, status: CourseStatus) => void;
  getCourseStatus: (courseId: string) => CourseStatus;
  selectCourse: (courseId: string | null) => void;
  openStatusMenu: (menu: StatusMenuState) => void;
  closeStatusMenu: () => void;
}

export const useCurriculumStore = create<CurriculumState>()(
  persist(
    (set, get) => ({
      specialtyId: null,
      progress: {},
      selectedCourseId: null,
      statusMenu: null,

      setSpecialty: (specialtyId) => set({ specialtyId }),

      setCourseStatus: (courseId, status) => {
        const { specialtyId, progress } = get();
        if (!specialtyId) return;
        set({
          progress: {
            ...progress,
            [specialtyId]: { ...progress[specialtyId], [courseId]: status },
          },
        });
      },

      getCourseStatus: (courseId) => {
        const { specialtyId, progress } = get();
        if (!specialtyId) return 'pending';
        return progress[specialtyId]?.[courseId] ?? 'pending';
      },

      selectCourse: (courseId) => set({ selectedCourseId: courseId }),
      openStatusMenu: (menu) => set({ statusMenu: menu }),
      closeStatusMenu: () => set({ statusMenu: null }),
    }),
    {
      name: 'pistachio:curriculum',
      // Solo persistimos lo que debe sobrevivir a un refresh.
      partialize: (state) => ({
        specialtyId: state.specialtyId,
        progress: state.progress,
      }),
    },
  ),
);
