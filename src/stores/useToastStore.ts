import { create } from 'zustand';

export type ToastType = 'success' | 'info' | 'error';

export interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastState {
  toasts: ToastItem[];
  show: (message: string, type?: ToastType) => void;
  dismiss: (id: number) => void;
}

let nextId = 0;

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  show: (message, type = 'success') => {
    const id = ++nextId;
    // Máximo 3 toasts visibles para no tapar la pantalla en mobile.
    set((state) => ({ toasts: [...state.toasts, { id, message, type }].slice(-3) }));
    setTimeout(() => get().dismiss(id), 3500);
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));
