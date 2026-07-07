import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Offering } from '@/lib/schedule';

interface ScheduleState {
  /** Horario oficial parseado del Excel que sube el alumno. */
  offering: Offering | null;
  /** Selección del planificador: código de ramo → NRC de la sección elegida. */
  selection: Record<string, string>;

  setOffering: (offering: Offering) => void;
  clearOffering: () => void;
  /** Fija (o reemplaza) la sección elegida para un ramo. */
  pickSection: (code: string, nrc: string) => void;
  removeCourse: (code: string) => void;
  /** Reemplaza toda la selección (p. ej. tras el armado automático). */
  setSelection: (selection: Record<string, string>) => void;
}

export const useScheduleStore = create<ScheduleState>()(
  persist(
    (set) => ({
      offering: null,
      selection: {},

      setOffering: (offering) => set({ offering, selection: {} }),
      clearOffering: () => set({ offering: null, selection: {} }),
      pickSection: (code, nrc) =>
        set((s) => ({ selection: { ...s.selection, [code]: nrc } })),
      removeCourse: (code) =>
        set((s) => {
          const next = { ...s.selection };
          delete next[code];
          return { selection: next };
        }),
      setSelection: (selection) => set({ selection }),
    }),
    { name: 'pistachio:schedule' },
  ),
);
