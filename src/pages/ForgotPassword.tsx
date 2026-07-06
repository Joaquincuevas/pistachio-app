import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, MailCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Logo } from '@/components/ui/Logo';
import { PageTransition } from '@/components/ui/PageTransition';
import { forgotSchema, type ForgotValues } from '@/lib/validators';
import { api } from '@/services/api';

export function ForgotPassword() {
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<ForgotValues>({ resolver: zodResolver(forgotSchema) });

  const onSubmit = async (values: ForgotValues) => {
    // La respuesta es siempre 200 (no revela si el correo existe): mostramos
    // el mismo mensaje pase lo que pase.
    try {
      await api.forgotPassword(values.email);
    } catch {
      // Silencioso a propósito: evitamos filtrar qué correos existen.
    }
    setSent(true);
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

        {sent ? (
          <>
            <div className="mt-5 flex h-12 w-12 items-center justify-center rounded-btn bg-accent-light">
              <MailCheck className="h-6 w-6 text-accent" aria-hidden />
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-text-primary">
              Revisa tu correo
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-text-secondary">
              Si <span className="font-medium text-text-primary">{getValues('email')}</span> tiene
              una cuenta, te enviamos un enlace para crear una nueva contraseña. Expira en 1 hora.
            </p>
            <p className="mt-2 text-sm leading-relaxed text-text-secondary">
              ¿No lo ves? Revisa la carpeta de spam.
            </p>
            <Link to="/login" className="mt-8">
              <Button size="lg" fullWidth>
                Entendido
              </Button>
            </Link>
          </>
        ) : (
          <>
            <h1 className="mt-5 text-3xl font-semibold tracking-tight text-text-primary">
              Recupera tu contraseña
            </h1>
            <p className="mt-1.5 text-sm text-text-secondary">
              Ingresa tu correo institucional y te enviaremos un enlace para restablecerla.
            </p>

            <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-8 flex flex-col gap-4">
              <Input
                label="Correo institucional"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="nombre@miuandes.cl"
                autoFocus
                error={errors.email?.message}
                {...register('email')}
              />
              <Button type="submit" size="lg" loading={isSubmitting} fullWidth className="mt-2">
                {isSubmitting ? 'Enviando…' : 'Enviar enlace'}
              </Button>
            </form>
          </>
        )}
      </div>
    </PageTransition>
  );
}
