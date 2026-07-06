import type { CourseStatus, Specialty, User, UserSettings } from '@/types';

/**
 * Cliente HTTP de la API de Pistachio. La sesión viaja en una cookie
 * httpOnly, por lo que basta con `credentials: 'same-origin'`.
 */

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      credentials: 'same-origin',
      headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
      ...init,
    });
  } catch {
    throw new ApiError(0, 'No se pudo conectar con el servidor. ¿Está corriendo la API?');
  }
  if (!res.ok) {
    let message = 'Algo salió mal. Intenta de nuevo.';
    try {
      const data = (await res.json()) as { error?: string };
      if (data.error) message = data.error;
    } catch {
      // cuerpo no-JSON: se usa el mensaje genérico
    }
    throw new ApiError(res.status, message);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export interface AuthResponse {
  user: User;
  settings: UserSettings;
}

/** El login puede pedir un segundo paso cuando la cuenta tiene 2FA activo. */
export type LoginResponse = AuthResponse | { twoFactorRequired: true; challengeId: string };

export interface TwoFaSetup {
  secret: string;
  uri: string;
  /** Data URL del QR para escanear con la app de autenticación. */
  qr: string;
}

export const api = {
  register: (name: string, email: string, password: string) =>
    request<AuthResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    }),

  login: (email: string, password: string) =>
    request<LoginResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  login2fa: (challengeId: string, code: string) =>
    request<AuthResponse>('/api/auth/2fa', {
      method: 'POST',
      body: JSON.stringify({ challengeId, code }),
    }),

  forgotPassword: (email: string) =>
    request<{ ok: boolean }>('/api/auth/forgot', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  resetPassword: (token: string, password: string) =>
    request<{ ok: boolean }>('/api/auth/reset', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    }),

  logout: () => request<void>('/api/auth/logout', { method: 'POST' }),

  me: () => request<AuthResponse>('/api/auth/me'),

  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ ok: boolean }>('/api/me/password', {
      method: 'PUT',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),

  twoFaSetup: () => request<TwoFaSetup>('/api/me/2fa/setup', { method: 'POST' }),

  twoFaEnable: (code: string) =>
    request<{ ok: boolean }>('/api/me/2fa/enable', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }),

  twoFaDisable: (password: string) =>
    request<{ ok: boolean }>('/api/me/2fa/disable', {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),

  deleteAccount: (password: string) =>
    request<void>('/api/me', {
      method: 'DELETE',
      body: JSON.stringify({ password }),
    }),

  catalog: () => request<{ specialties: Specialty[] }>('/api/catalog'),

  setPlan: (specialtyId: string, planId: string) =>
    request<{ settings: UserSettings }>('/api/me/plan', {
      method: 'PUT',
      body: JSON.stringify({ specialtyId, planId }),
    }),

  getProgress: (planId: string) =>
    request<{ statuses: Record<string, CourseStatus> }>(`/api/progress/${planId}`),

  setStatus: (planId: string, courseId: string, status: CourseStatus) =>
    request<{ ok: boolean; statuses: Record<string, CourseStatus> }>(
      `/api/progress/${planId}/${courseId}`,
      {
        method: 'PUT',
        body: JSON.stringify({ status }),
      },
    ),
};
