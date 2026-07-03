import { create } from 'zustand';
import { api } from '@/services/api';
import type { Specialty } from '@/types';

type CatalogStatus = 'idle' | 'loading' | 'ready' | 'error';

interface CatalogState {
  specialties: Specialty[];
  status: CatalogStatus;
  load: () => Promise<void>;
}

/** Catálogo de especialidades y planes, servido por la API (público). */
export const useCatalogStore = create<CatalogState>()((set, get) => ({
  specialties: [],
  status: 'idle',
  load: async () => {
    const { status } = get();
    if (status === 'loading' || status === 'ready') return;
    set({ status: 'loading' });
    try {
      const { specialties } = await api.catalog();
      set({ specialties, status: 'ready' });
    } catch {
      set({ status: 'error' });
    }
  },
}));
