import type { NextFunction, Request, Response } from 'express';

/**
 * Endurecimiento de seguridad HTTP (sin dependencias externas). Aplica cabeceras
 * defensivas a todas las respuestas de la API: mitiga clickjacking, sniffing de
 * MIME, fuga de referer y fuerza HTTPS. El CSP del documento HTML se define
 * además en vercel.json, porque en producción el HTML lo sirve el CDN y no pasa
 * por Express (aquí solo viajan las respuestas JSON de /api).
 *
 * IMPORTANTE: el CSP de abajo debe mantenerse en sintonía con el de vercel.json.
 * Permite: scripts propios (Vite compila a archivos externos, sin inline),
 * estilos inline (framer-motion setea `style` en runtime) + Google Fonts,
 * imágenes data:/blob: (QR de 2FA y exportación de horario a PNG).
 */
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "object-src 'none'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "manifest-src 'self'",
  'upgrade-insecure-requests',
].join('; ');

const IS_PROD = process.env.NODE_ENV === 'production';

/**
 * Middleware de cabeceras de seguridad. Se instala antes de las rutas para que
 * cubra también las respuestas de error.
 */
export function securityHeaders(_req: Request, res: Response, next: NextFunction): void {
  // Oculta la tecnología del backend (defensa en profundidad).
  res.removeHeader('X-Powered-By');
  // No adivinar el tipo MIME: evita ejecutar contenido como script por error.
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // La API nunca debe embeberse en un iframe.
  res.setHeader('X-Frame-Options', 'DENY');
  // No filtrar la URL completa a terceros.
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  // Bloquea APIs sensibles del navegador que la app no usa.
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Content-Security-Policy', CONTENT_SECURITY_POLICY);
  // Las respuestas de la API no deben cachearse (pueden traer datos de sesión).
  res.setHeader('Cache-Control', 'no-store');
  // Fuerza HTTPS por un año, solo en producción (evita romper localhost http).
  if (IS_PROD) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
}

/**
 * IP del cliente detrás del proxy de Vercel. Se usa como llave de rate-limiting
 * para endpoints sensibles (registro, recuperación de contraseña).
 */
export function clientIp(req: Request): string {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd) return fwd.split(',')[0]!.trim();
  if (Array.isArray(fwd) && fwd.length) return fwd[0]!.trim();
  return req.socket?.remoteAddress ?? 'unknown';
}
