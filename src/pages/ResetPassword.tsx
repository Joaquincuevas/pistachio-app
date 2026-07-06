import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Logo } from '@/components/ui/Logo';
import { PageTransition } from '@/components/ui/PageTransition';
import { resetSchema, type ResetValues } from '@/lib/validators';
import { api } from '@/services/api';
import { useToastStore } from '@/stores/useToastStore';

export function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const navigate = useNavigate();
  const show = useToastStore((s) => s.show);
  const [serverError, setServerError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetValues>({ resolver: zodResolver(resetSchema) });

  const onSubmit = async (values: ResetValues) => {
    setServerError(null);
    try {
      await api.resetPassword(token, values.password);
      setDone(true);
    } catch (error) {
      setServerError(error instanceof Error ? error.message : 'No se pudo restablecer la contraseña.');
    }
  };

  const content = () => {
    if (!token) {
      return (
        <>
          <h1 className="mt-5 text-3xl font-semibold tracking-tight text-text-primary">
            Enlace inválido
          </h1>
          <p className="mt-2 text-sm text-text-secondary">
            El enlace de recuperación está incompleto o venció. Solicita uno nuevo.
          </p>
          <Link to="/forgot" className="mt-8">
            <Button size="lg" fullWidth>
              Pedir un nuevo enlace
            </Button>
          </Link>
        </>
      );
    }

    if (done) {
      return (
        <>
          <div className="mt-5 flex h-12 w-12 items-center justify-center rounded-btn bg-accent-light">
            <CheckCircle2 className="h-6 w-6 text-accent" aria-hidden />
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-text-primary">
            Contraseña actualizada
          </h1>
          <p className="mt-2 text-sm text-text-secondary">
            Ya puedes iniciar sesión con tu nueva contraseña.
          </p>
          <Button
            size="lg"
            fullWidth
            className="mt-8"
            onClick={() => {
              show('Contraseña actualizada. Inicia sesión.');
              navigate('/login', { replace: true });
            }}
          >
            Ir a iniciar sesión
          </Button>
        </>
      );
    }

    return (
      <>
        <h1 className="mt-5 text-3xl font-semibold tracking-tight text-text-primary">
          Nueva contraseña
        </h1>
        <p className="mt-1.5 text-sm text-text-secondary">
          Elige una contraseña nueva para tu cuenta.
        </p>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-8 flex flex-col gap-4">
          <Input
            label="Nueva contraseña"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            autoFocus
            error={errors.password?.message}
            {...register('password')}
          />
          <Input
            label="Repite la contraseña"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            error={errors.confirm?.message}
            {...register('confirm')}
          />

          {serverError && (
            <p role="alert" className="rounded-input bg-danger/10 px-3.5 py-2.5 text-sm text-danger">
              {serverError}
            </p>
          )}

          <Button type="submit" size="lg" loading={isSubmitting} fullWidth className="mt-2">
            {isSubmitting ? 'Guardando…' : 'Guardar contraseña'}
          </Button>
        </form>
      </>
    );
  };

  return (
    <PageTransition className="flex min-h-dvh flex-col bg-surface px-5 pb-safe pt-safe">
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
        <Link
          to="/login"
          className="mb-8 inline-flex w-fit items-center gap-1.5 text-sm text-text-secondary transition-colors hover:text-text-primary"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Volver a iniciar sesión
        </Link>

        <Logo size="lg" />
        {content()}
      </div>
    </PageTransition>
  );
}
