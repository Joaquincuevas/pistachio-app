import app from '../server/app.js';

/**
 * Función serverless de Vercel: expone la app Express en /api/*.
 * Una app de Express es, en sí, un manejador (req, res) válido para Vercel.
 * Los estáticos del frontend los sirve el CDN (ver vercel.json).
 */
export default app;
