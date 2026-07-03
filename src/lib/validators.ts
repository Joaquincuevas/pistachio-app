import { z } from 'zod';

/** El correo debe ser institucional: @uandes.cl o @miuandes.cl. */
const institutionalEmail = z
  .string()
  .min(1, 'Ingresa tu correo')
  .email('Ingresa un correo válido')
  .refine((email) => /@(mi)?uandes\.cl$/i.test(email), {
    message: 'Usa tu correo institucional U. Andes',
  });

export const loginSchema = z.object({
  email: institutionalEmail,
  password: z.string().min(1, 'Ingresa tu contraseña'),
});

export const registerSchema = z.object({
  name: z
    .string()
    .min(2, 'Ingresa tu nombre')
    .max(60, 'Máximo 60 caracteres'),
  email: institutionalEmail,
  password: z.string().min(8, 'Mínimo 8 caracteres'),
});

export type LoginValues = z.infer<typeof loginSchema>;
export type RegisterValues = z.infer<typeof registerSchema>;
