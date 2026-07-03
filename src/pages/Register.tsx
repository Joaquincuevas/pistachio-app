import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Logo } from '@/components/ui/Logo';
import { PageTransition } from '@/components/ui/PageTransition';
import { registerSchema, type RegisterValues } from '@/lib/validators';
import { api } from '@/services/api';
import { useAuthStore } from '@/stores/useAuthStore';
import { useToastStore } from '@/stores/useToastStore';

export function Register() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const show = useToastStore((s) => s.show);
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({ resolver: zodResolver(registerSchema) });

  const onSubmit = async (values: RegisterValues) => {
    setServerError(null);
    try {
      const { user, settings } = await api.register(values.name, values.email, values.password);
      setAuth(user, settings);
      show(`¡Bienvenido/a, ${user.name.split(' ')[0]}! Cuenta creada.`);
      navigate('/specialty', { replace: true });
    } catch (error) {
      setServerError(error instanceof Error ? error.message : 'Algo salió mal. Intenta de nuevo.');
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
        <h1 className="mt-5 font-display text-3xl text-text-primary">Crea tu cuenta</h1>
        <p className="mt-1.5 text-sm text-text-secondary">
          Solo necesitas tu correo @uandes.cl o @miuandes.cl.
        </p>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-8 flex flex-col gap-4">
          <Input
            label="Nombre"
            type="text"
            autoComplete="name"
            placeholder="Josefa Pérez"
            error={errors.name?.message}
            {...register('name')}
          />
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
            autoComplete="new-password"
            placeholder="Mínimo 8 caracteres"
            error={errors.password?.message}
            {...register('password')}
          />

          {serverError && (
            <p role="alert" className="rounded-input bg-danger/10 px-3.5 py-2.5 text-sm text-danger">
              {serverError}
            </p>
          )}

          <Button type="submit" size="lg" loading={isSubmitting} fullWidth className="mt-2">
            {isSubmitting ? 'Creando cuenta…' : 'Crear cuenta'}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-text-secondary">
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" className="font-medium text-accent hover:text-accent-hover">
            Inicia sesión
          </Link>
        </p>
      </div>
    </PageTransition>
  );
}
