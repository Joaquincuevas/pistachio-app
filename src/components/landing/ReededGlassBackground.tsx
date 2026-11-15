import { useEffect, useRef, type RefObject } from 'react';
import { createPortal } from 'react-dom';

/**
 * Fondo de página: bowl de pistachos tras vidrio acanalado (reeded glass).
 * Ocupa todo el viewport (fixed) y el contenido de la landing pasa por encima.
 * La escena se dibuja en un canvas oculto y cada "caña" del vidrio muestra
 * una franja comprimida e invertida de ella, como una lente cilíndrica real.
 */

const PAD = 80; // margen extra de escena para que las cañas del borde tengan qué refractar
const SCENE_SCALE = 0.28; // escena a baja resolución = desenfoque suave y barato
const LENS = 1.9; // cuánta escena comprime cada caña
const RIB_TARGET = 22; // ancho aproximado de cada caña (px CSS)

/** PRNG determinista: la pila de pistachos es idéntica en cada render. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function drawNut(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  u: number,
  angle: number,
  kind: number,
) {
  const a = 25 * u;
  const b = 16.5 * u;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  if (kind < 0.38) {
    // Pistacho pelado: verde con rubor púrpura
    const g = ctx.createLinearGradient(0, -b, 0, b);
    g.addColorStop(0, '#C3D77F');
    g.addColorStop(1, '#6E9A46');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0, 0, a * 0.86, b * 0.74, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(140, 72, 112, 0.6)';
    ctx.beginPath();
    ctx.ellipse(a * 0.28, b * 0.12, a * 0.5, b * 0.42, 0.3, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Con cáscara: beige, entreabierta mostrando el fruto
    const g = ctx.createRadialGradient(-a * 0.3, -b * 0.4, 0, 0, 0, a * 1.1);
    g.addColorStop(0, '#FAEFD8');
    g.addColorStop(0.6, '#E6D0A4');
    g.addColorStop(1, '#BF9F6C');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0, 0, a, b, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(110, 82, 44, 0.4)';
    ctx.lineWidth = Math.max(0.6, u);
    ctx.stroke();

    ctx.fillStyle = '#8A4B6E';
    ctx.beginPath();
    ctx.ellipse(a * 0.12, 0, a * 0.74, b * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#9DBD5C';
    ctx.beginPath();
    ctx.ellipse(a * 0.12, -b * 0.04, a * 0.66, b * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

interface BowlLayout {
  cx: number; // centro horizontal (px de página)
  rimY: number; // borde del bowl (px de página)
  u: number; // escala
}

/** Dibuja la escena (fondo, bowl y pistachos) en coordenadas CSS, con margen PAD. */
function drawScene(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  sceneH: number,
  bowl: BowlLayout,
) {
  const full = W + PAD * 2;
  const { u, rimY } = bowl;
  const cx = PAD + bowl.cx;
  const R = 158 * u;
  const depth = 92 * u;
  const baseR = 46 * u;
  const rand = mulberry32(7);

  // Fondo: vidrio pálido con luz difusa
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#F1F6F2');
  bg.addColorStop(1, '#DCE9E1');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, full, sceneH);
  const glow = ctx.createRadialGradient(cx - R, H * 0.15, 0, cx - R, H * 0.15, H * 0.5);
  glow.addColorStop(0, 'rgba(255,255,255,0.9)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, full, H);

  // Sombra de apoyo
  const floorY = rimY + depth + 12 * u;
  const sh = ctx.createRadialGradient(cx, floorY, 0, cx, floorY, R * 1.25);
  sh.addColorStop(0, 'rgba(22, 40, 30, 0.34)');
  sh.addColorStop(1, 'rgba(22, 40, 30, 0)');
  ctx.save();
  ctx.translate(cx, floorY);
  ctx.scale(1, 0.14);
  ctx.translate(-cx, -floorY);
  ctx.fillStyle = sh;
  ctx.fillRect(cx - R * 1.4, floorY - R * 1.4, R * 2.8, R * 2.8);
  ctx.restore();

  // Interior del bowl
  ctx.fillStyle = '#121C16';
  ctx.beginPath();
  ctx.ellipse(cx, rimY, R, 17 * u, 0, 0, Math.PI * 2);
  ctx.fill();

  // Pila de pistachos: filas en domo, de atrás hacia adelante
  const rows = 5;
  for (let j = rows - 1; j >= 0; j--) {
    const half = R * 0.88 * Math.sqrt(1 - (j / (rows + 0.4)) ** 2);
    const y = rimY + 4 * u - j * 21 * u;
    const step = 37 * u;
    const n = Math.max(1, Math.floor((half * 2) / step));
    for (let i = 0; i <= n; i++) {
      const x = cx - half + (i / n) * half * 2 + (rand() - 0.5) * 14 * u;
      drawNut(
        ctx,
        x,
        y + (rand() - 0.5) * 7 * u,
        u,
        (rand() - 0.5) * 1.5,
        rand(),
      );
    }
  }

  // Cuerpo del bowl
  const body = ctx.createLinearGradient(cx - R, 0, cx + R, 0);
  body.addColorStop(0, '#1B2C22');
  body.addColorStop(0.3, '#3F6A4D');
  body.addColorStop(0.55, '#2C4B37');
  body.addColorStop(1, '#101A14');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(cx - R, rimY);
  ctx.bezierCurveTo(cx - R * 0.96, rimY + depth * 0.62, cx - R * 0.62, rimY + depth, cx - baseR, rimY + depth);
  ctx.lineTo(cx + baseR, rimY + depth);
  ctx.bezierCurveTo(cx + R * 0.62, rimY + depth, cx + R * 0.96, rimY + depth * 0.62, cx + R, rimY);
  ctx.bezierCurveTo(cx + R * 0.6, rimY + 22 * u, cx - R * 0.6, rimY + 22 * u, cx - R, rimY);
  ctx.closePath();
  ctx.fill();

  // Pie del bowl
  ctx.fillStyle = '#16241C';
  ctx.fillRect(cx - baseR * 0.82, rimY + depth - u, baseR * 1.64, 9 * u);

  // Pistachos sueltos sobre la mesa
  drawNut(ctx, cx - R * 1.12, floorY - 6 * u, u, 0.35, 0.8);
  drawNut(ctx, cx + R * 1.05, floorY - 5 * u, u, -0.5, 0.1);
  drawNut(ctx, cx + R * 1.26, floorY - 7 * u, u, 0.2, 0.9);
}

/** Relieve del vidrio: brillo y sombra de cada caña, cacheado por tamaño. */
function buildRibShading(W: number, H: number, ribs: number, dpr: number) {
  const c = document.createElement('canvas');
  c.width = Math.round(W * dpr);
  c.height = Math.round(H * dpr);
  const ctx = c.getContext('2d');
  if (!ctx) return c;
  ctx.scale(dpr, dpr);
  const rw = W / ribs;
  for (let i = 0; i < ribs; i++) {
    const x = i * rw;
    const g = ctx.createLinearGradient(x, 0, x + rw, 0);
    g.addColorStop(0, 'rgba(18, 38, 28, 0.10)');
    g.addColorStop(0.07, 'rgba(255, 255, 255, 0.50)');
    g.addColorStop(0.22, 'rgba(255, 255, 255, 0.10)');
    g.addColorStop(0.55, 'rgba(255, 255, 255, 0)');
    g.addColorStop(0.9, 'rgba(18, 38, 28, 0.05)');
    g.addColorStop(1, 'rgba(18, 38, 28, 0.09)');
    ctx.fillStyle = g;
    ctx.fillRect(x, 0, rw + 0.5, H);
  }
  // Reflejo general de la lámina
  const sheen = ctx.createLinearGradient(0, 0, W, H);
  sheen.addColorStop(0, 'rgba(255,255,255,0.22)');
  sheen.addColorStop(0.45, 'rgba(255,255,255,0)');
  sheen.addColorStop(1, 'rgba(20,45,32,0.06)');
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, W, H);
  return c;
}

export function ReededGlassBackground({ anchorRef }: { anchorRef: RefObject<HTMLElement> }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!wrap || !canvas || !ctx) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const scene = document.createElement('canvas');
    let shading: HTMLCanvasElement | null = null;
    let W = 0;
    let H = 0;
    let ribs = 1;
    let dpr = 1;
    let u = 1;
    let maxScroll = 0;
    let raf = 0;
    let pointer = 0; // -1..1, objetivo
    let eased = 0;

    const render = (time: number) => {
      if (!W || !H) return;
      const rw = W / ribs;
      eased += (pointer - eased) * 0.06;
      const drift = reduceMotion ? 0 : Math.sin(time / 4200) * 9 * u + eased * 16 * u;
      const srcW = rw * LENS * SCENE_SCALE;
      // El vidrio es fijo; la escena se desplaza con la página
      const sy = Math.min(Math.max(window.scrollY, 0), maxScroll) * SCENE_SCALE;
      const srcH = H * SCENE_SCALE;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingQuality = 'high';
      for (let i = 0; i < ribs; i++) {
        const x0 = i * rw;
        const sx = (PAD + x0 + rw / 2 + drift) * SCENE_SCALE - srcW / 2;
        // Lente cilíndrica: la franja se ve invertida horizontalmente
        ctx.setTransform(-dpr, 0, 0, dpr, (x0 + rw) * dpr, 0);
        ctx.drawImage(scene, sx, sy, srcW, srcH, -0.5, 0, rw + 1, H);
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (shading) ctx.drawImage(shading, 0, 0);
    };

    const loop = (time: number) => {
      render(time);
      if (!reduceMotion) raf = requestAnimationFrame(loop);
    };

    const start = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(loop);
    };

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      W = Math.round(rect.width);
      H = Math.round(rect.height);
      if (!W || !H) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ribs = Math.max(8, Math.round(W / RIB_TARGET));

      // El bowl se encaja en el ancla del hero (coordenadas de página)
      const a = anchorRef.current?.getBoundingClientRect();
      const aw = a?.width || W;
      const ah = a?.height || H * 0.4;
      const top = (a ? a.top + window.scrollY : H * 0.55);
      u = Math.min(aw / 430, ah / 245);
      const bowl = { cx: (a ? a.left : 0) + aw / 2, rimY: top + ah / 2 + 8 * u, u };
      maxScroll = Math.ceil(top + ah);
      const sceneH = maxScroll + H;

      scene.width = Math.round((W + PAD * 2) * SCENE_SCALE);
      scene.height = Math.round(sceneH * SCENE_SCALE);
      const sctx = scene.getContext('2d');
      if (sctx) {
        sctx.setTransform(SCENE_SCALE, 0, 0, SCENE_SCALE, 0, 0);
        drawScene(sctx, W, H, sceneH, bowl);
      }
      shading = buildRibShading(W, H, ribs, dpr);
      start();
    };

    const onPointer = (e: PointerEvent) => {
      const rect = wrap.getBoundingClientRect();
      pointer = Math.max(-1, Math.min(1, ((e.clientX - rect.left) / rect.width) * 2 - 1));
    };
    const onLeave = () => {
      pointer = 0;
    };

    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    if (anchorRef.current) ro.observe(anchorRef.current);
    const onScroll = () => {
      if (reduceMotion) render(0);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('pointermove', onPointer);
    document.addEventListener('pointerleave', onLeave);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('pointermove', onPointer);
      document.removeEventListener('pointerleave', onLeave);
    };
  }, [anchorRef]);

  // Portal a <body>: la transición de página usa transform y rompería el position: fixed.
  return createPortal(
    <div ref={wrapRef} aria-hidden className="pointer-events-none fixed inset-0 -z-10 bg-[#E6EFEA]">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
    </div>,
    document.body,
  );
}
