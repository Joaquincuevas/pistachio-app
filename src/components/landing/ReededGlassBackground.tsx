import type { CSSProperties } from 'react';
import { createPortal } from 'react-dom';

/**
 * Fondo de página: lámina de vidrio acanalado (reeded glass), solo CSS.
 * Ocupa todo el viewport (fixed) y el contenido de la landing pasa por encima.
 */

const RIB = 22; // ancho de cada caña (px)

const style: CSSProperties = {
  backgroundColor: '#E6EFEA',
  backgroundImage: [
    // Relieve de cada caña: sombra en los cantos y brillo junto al borde izquierdo
    `repeating-linear-gradient(90deg,
      rgba(18,38,28,0.10) 0px,
      rgba(255,255,255,0.50) ${RIB * 0.07}px,
      rgba(255,255,255,0.10) ${RIB * 0.22}px,
      rgba(255,255,255,0) ${RIB * 0.55}px,
      rgba(18,38,28,0.05) ${RIB * 0.9}px,
      rgba(18,38,28,0.09) ${RIB}px)`,
    // Reflejo general de la lámina
    'linear-gradient(135deg, rgba(255,255,255,0.22), rgba(255,255,255,0) 45%, rgba(20,45,32,0.06))',
    // Luz difusa detrás del vidrio
    'radial-gradient(60% 50% at 30% 12%, rgba(255,255,255,0.9), rgba(255,255,255,0))',
    'linear-gradient(180deg, #F1F6F2, #DCE9E1)',
  ].join(','),
};

export function ReededGlassBackground() {
  // Portal a <body>: la transición de página usa transform y rompería el position: fixed.
  // 100lvh evita saltos cuando la barra del navegador móvil se oculta al hacer scroll.
  return createPortal(
    <div
      aria-hidden
      style={style}
      className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-screen supports-[height:100lvh]:h-[100lvh]"
    />,
    document.body,
  );
}
