import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ArrowDown,
  ArrowRight,
  Check,
  Clock3,
  Hand,
  ListChecks,
  MousePointerClick,
  Undo2,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { cn, STATUS_COLORS } from '@/lib/utils';
import { useAuthStore } from '@/stores/useAuthStore';
import { useCurriculumStore } from '@/stores/useCurriculumStore';

const storageKey = (userId: number) => `pistachio:welcome-seen:${userId}`;

function hasSeen(userId: number): boolean {
  try {
    return window.localStorage.getItem(storageKey(userId)) === '1';
  } catch {
    return false;
  }
}

function markSeen(userId: number) {
  try {
    window.localStorage.setItem(storageKey(userId), '1');
  } catch {
    // Sin localStorage la guía puede volver a aparecer; no es crítico.
  }
}

const arrowClass = (active: boolean) =>
  cn(
    'h-4 w-4 shrink-0 transition-colors duration-300',
    active ? 'text-status-completed' : 'text-text-tertiary',
  );

const DEMO_COURSES = ['Cálculo I', 'Cálculo II', 'Ecuaciones Diferenciales'];

/**
 * Mini animación: marcar el último ramo como cursado marca hacia atrás los
 * requisitos. Pasos: 0 = pendientes · 1 = toque · 2/3/4 = se marcan 3.º, 2.º, 1.º.
 */
function CascadeDemo() {
  const reduceMotion = useReducedMotion();
  const [step, setStep] = useState(reduceMotion ? 4 : 0);

  useEffect(() => {
    if (reduceMotion) return;
    const id = window.setTimeout(() => setStep((s) => (s + 1) % 7), step === 0 ? 1100 : 750);
    return () => window.clearTimeout(id);
  }, [step, reduceMotion]);

  // Orden en que cada ramo pasa a "cursado": el último primero.
  const doneAt = [4, 3, 2];

  return (
    <div
      className="flex flex-col items-stretch gap-1 sm:flex-row sm:gap-2"
      role="img"
      aria-label="Ejemplo: al marcar Ecuaciones Diferenciales como cursado, Cálculo II y Cálculo I se marcan automáticamente"
    >
      {DEMO_COURSES.map((name, i) => {
        const done = step >= doneAt[i] && step <= 6;
        const tapped = i === 2 && step === 1;
        return (
          <div
            key={name}
            className="flex min-w-0 flex-1 flex-col items-stretch gap-1 sm:flex-row sm:items-center sm:gap-2"
          >
            <motion.div
              animate={{ scale: tapped ? 0.94 : 1 }}
              transition={{ duration: 0.2 }}
              className={cn(
                'relative min-w-0 flex-1 rounded-xl border-2 border-l-[7px] px-3 py-3 pr-8 text-xs font-semibold leading-snug transition-colors duration-300',
                done
                  ? 'border-status-completed bg-status-completed-bg text-text-primary'
                  : 'border-border bg-card text-text-secondary',
                tapped && 'ring-2 ring-accent',
              )}
              style={done ? { borderLeftColor: STATUS_COLORS.completed } : { borderLeftColor: STATUS_COLORS.pending }}
            >
              {name}
              <span
                className={cn(
                  'absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-status-completed text-white transition-all duration-300',
                  done ? 'scale-100 opacity-100' : 'scale-50 opacity-0',
                )}
                aria-hidden
              >
                <Check className="h-3.5 w-3.5" strokeWidth={3.5} />
              </span>
              {tapped && (
                <Hand
                  className="absolute -bottom-3 right-3 h-6 w-6 rotate-[-20deg] fill-white text-text-primary"
                  aria-hidden
                />
              )}
            </motion.div>
            {i < DEMO_COURSES.length - 1 && (
              <>
                <ArrowDown
                  className={cn(arrowClass(step >= doneAt[i]), 'self-center sm:hidden')}
                  aria-hidden
                />
                <ArrowRight
                  className={cn(arrowClass(step >= doneAt[i]), 'hidden sm:block')}
                  aria-hidden
                />
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

const steps = [
  {
    icon: MousePointerClick,
    title: 'Abre el menú de un ramo',
    text: 'Haz clic derecho sobre el ramo (en el celular, mantén presionado) y elige su estado. También puedes tocarlo y usar «Estado».',
  },
  {
    icon: ListChecks,
    title: 'Marca el último que hayas cursado',
    text: 'Elige «Cursado» en el ramo más avanzado que ya diste. Los ramos previos que lo habilitan se marcan automáticamente, hacia atrás según la malla.',
  },
  {
    icon: Clock3,
    title: 'Marca lo que estás cursando',
    text: 'Usa «En progreso» para los ramos de este semestre. Así ves tu avance y qué ramos tienes desbloqueados.',
  },
  {
    icon: Undo2,
    title: 'Corrige cuando quieras',
    text: 'Si marcaste algo de más, cambia el estado del ramo a «Pendiente». Tu avance se guarda en tu cuenta.',
  },
];

/**
 * Pop up de bienvenida: se muestra una sola vez por cuenta, la primera vez que
 * el usuario entra a la app con una malla elegida.
 */
export function WelcomeGuide() {
  const userId = useAuthStore((s) => s.user?.id);
  const planId = useCurriculumStore((s) => s.planId);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (userId !== undefined && planId && !hasSeen(userId)) setOpen(true);
  }, [userId, planId]);

  const close = () => {
    if (userId !== undefined) markSeen(userId);
    setOpen(false);
  };

  return (
    <Modal open={open} onClose={close} title="Bienvenida a Pistachio" className="max-w-2xl">
      <div>
        <div className="p-6 pb-2 sm:p-9 sm:pb-2">
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-center sm:gap-7">
            <img
              src="/pisti-walk.png"
              alt="Pisti, la mascota de Pistachio, saludando"
              width={409}
              height={640}
              className="h-28 w-auto shrink-0 select-none sm:h-44"
              draggable={false}
            />
            <div className="self-stretch">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
                Bienvenido a Pistachio
              </p>
              <h2 className="mt-2 pr-8 font-display text-2xl font-semibold leading-tight tracking-tight text-text-primary sm:text-[32px]">
                Marca los ramos que ya diste
              </h2>
              <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-text-secondary sm:text-base">
                Para que tu malla refleje tu avance real, marca los ramos que ya cursaste. No
                tienes que hacerlo uno por uno: se van marcando hacia atrás según la malla.
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-card border border-border bg-surface p-4 sm:p-5">
            <CascadeDemo />
            <p className="mt-4 text-center text-xs leading-relaxed text-text-secondary sm:text-sm">
              Marcas{' '}
              <strong className="font-semibold text-text-primary">Ecuaciones Diferenciales</strong>{' '}
              y sus requisitos quedan cursados solos.
            </p>
          </div>

          <ol className="mt-6 grid gap-4 sm:grid-cols-2">
            {steps.map(({ icon: Icon, title, text }, i) => (
              <li key={title} className="flex gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-btn bg-accent-light text-accent">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <p className="text-sm font-semibold text-text-primary">
                    {i + 1}. {title}
                  </p>
                  <p className="mt-0.5 text-sm leading-relaxed text-text-secondary">{text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        {/* Botón siempre visible, aunque el contenido haga scroll en pantallas chicas */}
        <div className="sticky bottom-0 border-t border-border bg-card/95 px-6 py-4 backdrop-blur sm:px-9">
          <Button size="lg" fullWidth className="h-14 text-base" onClick={close}>
            Comenzar
          </Button>
        </div>
      </div>
    </Modal>
  );
}
