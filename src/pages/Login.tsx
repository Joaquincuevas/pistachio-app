import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Logo } from '@/components/ui/Logo';
import { PageTransition } from '@/components/ui/PageTransition';
import { loginSchema, type LoginValues } from '@/lib/validators';
import { api, type AuthResponse } from '@/services/api';
import { useAuthStore } from '@/stores/useAuthStore';
import { useToastStore } from '@/stores/useToastStore';

export function Login() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const show = useToastStore((s) => s.show);
  const navigate = useNavigate();
  const location = useLocation();
  const [serverError, setServerError] = useState<string | null>(null);

  // Segundo paso cuando la cuenta tiene verificación en dos pasos activa.
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });

  const finishLogin = ({ user, settings }: AuthResponse) => {
    setAuth(user, settings);
    show(`Hola de nuevo, ${user.name.split(' ')[0]}.`);
    const from = (location.state as { from?: string } | null)?.from;
    navigate(from ?? (settings.planId ? '/malla' : '/specialty'), { replace: true });
  };

  const onSubmit = async (values: LoginValues) => {
    setServerError(null);
    try {
      const response = await api.login(values.email, values.password);
      if ('twoFactorRequired' in response) {
        setChallengeId(response.challengeId);
        return;
      }
      finishLogin(response);
    } catch (error) {
      setServerError(error instanceof Error ? error.message : 'Algo salió mal. Intenta de nuevo.');
    }
  };

  const onVerifyCode = async () => {
    if (!challengeId) return;
    setVerifying(true);
    setServerError(null);
    try {
      finishLogin(await api.login2fa(challengeId, code));
    } catch (error) {
      setServerError(error instanceof Error ? error.message : 'Código incorrecto');
      setVerifying(false);
    }
  };

  return (
    <PageTransition className="flex min-h-dvh flex-col bg-surface px-5 pb-safe pt-safe">
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
        <Link
          to="/"
          className="mb-8 inline-flex w-fit items-center gap-1.5 text-sm text-text-secondary transition-colors hover:text-text-primary"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Volver
        </Link>

        <Logo size="lg" />

        {challengeId ? (
          /* ─── Paso 2: código de la app de autenticación ─── */
          <>
            <h1 className="mt-5 font-display text-3xl text-text-primary">Verificación</h1>
            <p className="mt-1.5 text-sm text-text-secondary">
              Ingresa el código de 6 dígitos de tu app de autenticación.
            </p>

            <div className="mt-8 flex flex-col gap-4">
              <Input
                label="Código de verificación"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                maxLength={6}
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && code.length === 6) void onVerifyCode();
                }}
                className="tracking-[0.4em]"
              />

              {serverError && (
                <p role="alert" className="rounded-input bg-danger/10 px-3.5 py-2.5 text-sm text-danger">
                  {serverError}
                </p>
              )}

              <Button
                size="lg"
                fullWidth
                loading={verifying}
                disabled={code.length !== 6}
                onClick={onVerifyCode}
              >
                <ShieldCheck className="h-4 w-4" aria-hidden />
                Verificar
              </Button>
              <button
                type="button"
                onClick={() => {
                  setChallengeId(null);
                  setCode('');
                  setServerError(null);
                }}
                className="text-center text-sm text-text-secondary hover:text-text-primary"
              >
                Volver al inicio de sesión
              </button>
            </div>
          </>
        ) : (
          /* ─── Paso 1: correo y contraseña ─── */
          <>
            <h1 className="mt-5 font-display text-3xl text-text-primary">Inicia sesión</h1>
            <p className="mt-1.5 text-sm text-text-secondary">
              Con tu correo institucional U. Andes.
            </p>

            <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-8 flex flex-col gap-4">
              <Input
                label="Correo institucional"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="nombre@miuandes.cl"
                error={errors.email?.message}
                {...register('email')}
              />
              <Input
                label="Contraseña"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                error={errors.password?.message}
                {...register('password')}
              />

              {serverError && (
                <p role="alert" className="rounded-input bg-danger/10 px-3.5 py-2.5 text-sm text-danger">
                  {serverError}
                </p>
              )}

              <Button type="submit" size="lg" loading={isSubmitting} fullWidth className="mt-2">
                {isSubmitting ? 'Entrando…' : 'Entrar'}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-text-secondary">
              ¿No tienes cuenta?{' '}
              <Link to="/register" className="font-medium text-accent hover:text-accent-hover">
                Crear cuenta
              </Link>
            </p>
          </>
        )}
      </div>
    </PageTransition>
  );
}
