import { createPortal } from 'react-dom';

/**
 * Fondo de página: lámina de vidrio acanalado (reeded glass), solo CSS.
 * Ocupa todo el viewport (fixed) y el contenido de la landing pasa por encima.
 */

// El dibujo del vidrio (claro y oscuro) vive en src/index.css, clase `.reeded-glass`.

export function ReededGlassBackground() {
  // Portal a <body>: la transición de página usa transform y rompería el position: fixed.
  // 100lvh evita saltos cuando la barra del navegador móvil se oculta al hacer scroll.
  return createPortal(
    <div
      aria-hidden
      className="reeded-glass pointer-events-none fixed inset-x-0 top-0 -z-10 h-screen supports-[height:100lvh]:h-[100lvh]"
    />,
    document.body,
  );
}
