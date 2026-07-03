import { useCallback, useState } from 'react';

/**
 * Estado sincronizado con localStorage. Encapsula lectura/escritura segura
 * (por ejemplo en Safari modo privado, donde localStorage puede lanzar).
 */
export function useLocalStorage<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw !== null ? (JSON.parse(raw) as T) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved = next instanceof Function ? next(prev) : next;
        try {
          localStorage.setItem(key, JSON.stringify(resolved));
        } catch {
          // Si localStorage no está disponible seguimos solo en memoria.
        }
        return resolved;
      });
    },
    [key],
  );

  return [value, set] as const;
}
