import { useCallback, useRef } from 'react';
import type React from 'react';

interface LongPressOptions {
  /** Tap/click normal. */
  onPress?: () => void;
  /** Long-press (mobile) o click derecho (desktop). Recibe coordenadas de pantalla. */
  onLongPress: (x: number, y: number) => void;
  ms?: number;
}

/**
 * Unifica long-press táctil y click derecho de escritorio en un solo gesto.
 * El timer se cancela si el puntero se mueve (para no interferir con el scroll).
 */
export function useLongPress({ onPress, onLongPress, ms = 450 }: LongPressOptions) {
  const timer = useRef<number | null>(null);
  const startPos = useRef<{ x: number; y: number } | null>(null);
  const longPressed = useRef(false);

  const clear = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const onPointerDown = useCallback(
    (event: React.PointerEvent) => {
      // Solo botón principal / dedo. El click derecho llega por onContextMenu.
      if (event.button !== 0) return;
      longPressed.current = false;
      const { clientX, clientY } = event;
      startPos.current = { x: clientX, y: clientY };
      clear();
      timer.current = window.setTimeout(() => {
        longPressed.current = true;
        onLongPress(clientX, clientY);
      }, ms);
    },
    [clear, ms, onLongPress],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent) => {
      if (!startPos.current) return;
      const dx = event.clientX - startPos.current.x;
      const dy = event.clientY - startPos.current.y;
      if (Math.hypot(dx, dy) > 10) {
        clear();
        startPos.current = null;
      }
    },
    [clear],
  );

  const onPointerUp = useCallback(() => {
    const wasPress = startPos.current !== null && !longPressed.current;
    clear();
    startPos.current = null;
    if (wasPress) onPress?.();
  }, [clear, onPress]);

  const onPointerCancel = useCallback(() => {
    clear();
    startPos.current = null;
  }, [clear]);

  const onContextMenu = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      clear();
      startPos.current = null;
      if (!longPressed.current) {
        onLongPress(event.clientX, event.clientY);
      }
    },
    [clear, onLongPress],
  );

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onContextMenu };
}
