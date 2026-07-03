import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { KeyRound, ShieldCheck, ShieldOff, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { PageTransition } from '@/components/ui/PageTransition';
import { api, type TwoFaSetup } from '@/services/api';
import { useAuthStore } from '@/stores/useAuthStore';
import { useToastStore } from '@/stores/useToastStore';

// ─── Cambiar contraseña ───────────────────────────────────────────

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Ingresa tu contraseña actual'),
  newPassword: z.string().min(8, 'Mínimo 8 caracteres'),
});

type PasswordValues = z.infer<typeof passwordSchema>;

function PasswordSection() {
  const show = useToastStore((s) => s.show);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PasswordValues>({ resolver: zodResolver(passwordSchema) });

  const onSubmit = async (values: PasswordValues) => {
    setServerError(null);
    try {
      await api.changePassword(values.currentPassword, values.newPassword);
      reset();
      show('Contraseña actualizada. Tus otras sesiones fueron cerradas.');
    } catch (error) {
      setServerError(error instanceof Error ? error.message : 'No se pudo actualizar');
    }
  };

  return (
    <Card className="p-5">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-btn bg-accent-light">
          <KeyRound className="h-4 w-4 text-accent" aria-hidden />
        </span>
        <div>
          <h2 className="text-sm font-semibold text-text-primary">Cambiar contraseña</h2>
          <p className="text-xs text-text-secondary">
            Al cambiarla se cierran tus demás sesiones abiertas.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-4 flex flex-col gap-3">
        <Input
          label="Contraseña actual"
          type="password"
          autoComplete="current-password"
          error={errors.currentPassword?.message}
          {...register('currentPassword')}
        />
        <Input
          label="Nueva contraseña"
          type="password"
          autoComplete="new-password"
          placeholder="Mínimo 8 caracteres"
          error={errors.newPassword?.message}
          {...register('newPassword')}
        />
        {serverError && (
          <p role="alert" className="rounded-input bg-danger/10 px-3.5 py-2.5 text-sm text-danger">
            {serverError}
          </p>
        )}
        <Button type="submit" loading={isSubmitting} className="self-start">
          Actualizar contraseña
        </Button>
      </form>
    </Card>
  );
}

// ─── Verificación en dos pasos (TOTP) ────────────────────────────

function TwoFactorSection() {
  const user = useAuthStore((s) => s.user);
  const show = useToastStore((s) => s.show);
  const [setup, setSetup] = useState<TwoFaSetup | null>(null);
  const [code, setCode] = useState('');
  const [disablePassword, setDisablePassword] = useState('');
  const [disabling, setDisabling] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enabled = user?.twoFactorEnabled ?? false;

  const updateUserFlag = (value: boolean) => {
    const current = useAuthStore.getState().user;
    if (current) {
      useAuthStore.setState({ user: { ...current, twoFactorEnabled: value } });
    }
  };

  const startSetup = async () => {
    setBusy(true);
    setError(null);
    try {
      setSetup(await api.twoFaSetup());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar la configuración');
    } finally {
      setBusy(false);
    }
  };

  const confirmEnable = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.twoFaEnable(code);
      updateUserFlag(true);
      setSetup(null);
      setCode('');
      show('Verificación en dos pasos activada.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Código incorrecto');
    } finally {
      setBusy(false);
    }
  };

  const confirmDisable = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.twoFaDisable(disablePassword);
      updateUserFlag(false);
      setDisabling(false);
      setDisablePassword('');
      show('Verificación en dos pasos desactivada.', 'info');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Contraseña incorrecta');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-btn bg-accent-light">
            <ShieldCheck className="h-4 w-4 text-accent" aria-hidden />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-text-primary">
              Verificación en dos pasos
            </h2>
            <p className="text-xs text-text-secondary">
              Un código de tu app de autenticación al iniciar sesión.
            </p>
          </div>
        </div>
        <Badge variant={enabled ? 'completed' : 'default'}>
          {enabled ? 'Activa' : 'Inactiva'}
        </Badge>
      </div>

      {/* Estado: inactiva, sin setup iniciado */}
      {!enabled && !setup && (
        <Button variant="secondary" className="mt-4" loading={busy} onClick={startSetup}>
          Activar 2FA
        </Button>
      )}

      {/* Setup en curso: QR + código de confirmación */}
      {!enabled && setup && (
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">
          <img
            src={setup.qr}
            alt="Código QR para tu app de autenticación"
            className="h-40 w-40 shrink-0 rounded-input border border-border"
          />
          <div className="min-w-0 flex-1">
            <ol className="list-decimal space-y-1 pl-4 text-sm text-text-secondary">
              <li>Escanea el QR con Google Authenticator, 1Password o similar.</li>
              <li>Ingresa el código de 6 dígitos para confirmar.</li>
            </ol>
            <p className="mt-2 break-all text-xs text-text-secondary">
              Clave manual: <code className="rounded bg-surface px-1 py-0.5">{setup.secret}</code>
            </p>
            <div className="mt-3 flex items-end gap-2">
              <Input
                label="Código de verificación"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                className="w-36 tracking-[0.3em]"
              />
              <Button loading={busy} disabled={code.length !== 6} onClick={confirmEnable}>
                Confirmar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Activa: opción de desactivar con contraseña */}
      {enabled && !disabling && (
        <Button variant="ghost" className="mt-4" onClick={() => setDisabling(true)}>
          <ShieldOff className="h-4 w-4" aria-hidden />
          Desactivar
        </Button>
      )}
      {enabled && disabling && (
        <div className="mt-4 flex items-end gap-2">
          <Input
            label="Confirma con tu contraseña"
            type="password"
            autoComplete="current-password"
            value={disablePassword}
            onChange={(e) => setDisablePassword(e.target.value)}
            className="max-w-xs"
          />
          <Button
            variant="danger"
            loading={busy}
            disabled={disablePassword.length === 0}
            onClick={confirmDisable}
          >
            Desactivar
          </Button>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 rounded-input bg-danger/10 px-3.5 py-2.5 text-sm text-danger">
          {error}
        </p>
      )}
    </Card>
  );
}

// ─── Eliminar cuenta ──────────────────────────────────────────────

function DangerSection() {
  const show = useToastStore((s) => s.show);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirmDelete = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.deleteAccount(password);
      await useAuthStore.getState().logout();
      show('Tu cuenta fue eliminada. Gracias por usar Pistachio.', 'info');
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar la cuenta');
      setBusy(false);
    }
  };

  return (
    <>
      <Card className="border-danger/30 p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-btn bg-danger/10">
            <Trash2 className="h-4 w-4 text-danger" aria-hidden />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-text-primary">Eliminar cuenta</h2>
            <p className="text-xs text-text-secondary">
              Borra definitivamente tu cuenta y todo tu progreso.
            </p>
          </div>
        </div>
        <Button variant="danger" className="mt-4" onClick={() => setOpen(true)}>
          Eliminar mi cuenta
        </Button>
      </Card>

      <Modal open={open} onClose={() => !busy && setOpen(false)} title="Eliminar cuenta">
        <div className="px-6 pb-6 pt-6">
          <h2 className="pr-8 font-display text-2xl text-text-primary">¿Eliminar tu cuenta?</h2>
          <p className="mt-3 text-sm leading-relaxed text-text-secondary">
            Esta acción es definitiva: se borra tu cuenta, tu progreso en todos los planes y tus
            sesiones. No se puede deshacer.
          </p>
          <div className="mt-5">
            <Input
              label="Confirma con tu contraseña"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && (
            <p role="alert" className="mt-3 rounded-input bg-danger/10 px-3.5 py-2.5 text-sm text-danger">
              {error}
            </p>
          )}
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="secondary" disabled={busy} onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              loading={busy}
              disabled={password.length === 0}
              onClick={confirmDelete}
            >
              Eliminar definitivamente
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

/** Configuración de la cuenta: contraseña, 2FA y eliminación. */
export function Settings() {
  return (
    <PageTransition className="mx-auto max-w-2xl px-4 py-4 md:px-8 md:py-8">
      <h1 className="font-display text-2xl text-text-primary md:text-3xl">Configuración</h1>
      <p className="mt-1 text-sm text-text-secondary">Seguridad y administración de tu cuenta.</p>

      <div className="mt-5 flex flex-col gap-3 pb-10">
        <PasswordSection />
        <TwoFactorSection />
        <DangerSection />
      </div>
    </PageTransition>
  );
}
