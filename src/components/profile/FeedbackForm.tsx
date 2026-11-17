import { useState } from 'react';
import { ChevronRight, MessageSquareHeart, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { api } from '@/services/api';
import { useToastStore } from '@/stores/useToastStore';

const TITLE_MAX = 100;
const MESSAGE_MAX = 2000;

/**
 * Fila de Configuración que abre un formulario de feedback anónimo
 * (título + mensaje). El correo que recibe el autor no incluye datos del alumno.
 */
export function FeedbackRow() {
  const show = useToastStore((s) => s.show);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = title.trim().length >= 3 && message.trim().length >= 10;

  const close = () => {
    if (busy) return;
    setOpen(false);
    setError(null);
  };

  const send = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.sendFeedback(title.trim(), message.trim());
      show('¡Gracias! Tu mensaje llegó de forma anónima.', 'success');
      setTitle('');
      setMessage('');
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar. Intenta de nuevo.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-surface"
      >
        <span
          aria-hidden
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-btn bg-accent-light"
        >
          <MessageSquareHeart className="h-5 w-5 text-accent" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-text-primary">Enviar feedback</span>
          <span className="block text-xs text-text-secondary">
            Ideas, errores o lo que quieras. Es anónimo.
          </span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-text-tertiary" aria-hidden />
      </button>

      <Modal open={open} onClose={close} title="Enviar feedback">
        <form
          className="px-6 pb-6 pt-6"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <h2 className="pr-8 text-2xl font-semibold tracking-tight text-text-primary">
            Cuéntanos qué piensas
          </h2>
          <p className="mt-2 flex items-start gap-2 text-sm leading-relaxed text-text-secondary">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
            Es anónimo: no se envía tu nombre, tu correo ni tu cuenta.
          </p>

          <div className="mt-5">
            <Input
              label="Título"
              placeholder="Ej: Me gustaría ver mis notas"
              maxLength={TITLE_MAX}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              enterKeyHint="next"
            />
          </div>

          <div className="mt-4 flex flex-col gap-1.5">
            <label htmlFor="feedback-message" className="text-sm font-medium text-text-primary">
              Mensaje
            </label>
            <textarea
              id="feedback-message"
              rows={5}
              maxLength={MESSAGE_MAX}
              placeholder="Escribe con detalle: qué pasó, qué esperabas o qué te gustaría."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full resize-y rounded-input border border-border bg-card px-3.5 py-3 text-base text-text-primary placeholder:text-text-secondary/60 transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
            />
            <p className="text-right text-xs tabular-nums text-text-tertiary">
              {message.length}/{MESSAGE_MAX}
            </p>
          </div>

          {error && (
            <p role="alert" className="mt-2 rounded-input bg-danger/10 px-3.5 py-2.5 text-sm text-danger">
              {error}
            </p>
          )}

          <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" disabled={busy} onClick={close}>
              Cancelar
            </Button>
            <Button type="submit" loading={busy} disabled={!valid}>
              Enviar
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
