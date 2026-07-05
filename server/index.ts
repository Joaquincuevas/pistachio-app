import express from 'express';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import app from './app.js';

/**
 * Entrypoint para dev y hosts con proceso propio (Railway/Render/Fly).
 * En Vercel NO se usa este archivo: ahí la app corre como función serverless
 * (ver api/index.ts) y los estáticos los sirve el CDN.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const IS_PROD = process.env.NODE_ENV === 'production';
const PORT = Number(process.env.API_PORT ?? (IS_PROD ? process.env.PORT : undefined) ?? 3001);

// En producción de un solo proceso, Express también sirve el frontend compilado.
const dist = path.join(here, '..', 'dist');
if (IS_PROD && existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.listen(PORT, () => {
  console.log(`[api] Pistachio API en http://localhost:${PORT}`);
});
