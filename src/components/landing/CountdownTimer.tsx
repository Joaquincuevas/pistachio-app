import { useEffect, useState } from 'react';

/**
 * Inicio de la Toma de Ramos 2027: lunes 14 de diciembre de 2026, 08:30.
 * Hora de Chile continental (UTC-3 en verano). Cambia aquí la fecha del evento.
 */
const TARGET = new Date('2026-12-14T08:30:00-03:00');
export const EVENT_LABEL = 'Lunes 14 de diciembre · 08:30 h · Toma de ramos 2027';

interface Remaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  done: boolean;
}

function getRemaining(): Remaining {
  const ms = TARGET.getTime() - Date.now();
  if (ms <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, done: true };
  const s = Math.floor(ms / 1000);
  return {
    days: Math.floor(s / 86400),
    hours: Math.floor((s % 86400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
    done: false,
  };
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Tarjeta estilo flip-clock: número arriba, etiqueta en la franja inferior. */
function Unit({ value, label }: { value: string; label: string }) {
  return (
    <div className="relative flex-1 overflow-hidden rounded-2xl bg-[#1B1D1C] shadow-raised dark:bg-[#0B0D0C] dark:ring-1 dark:ring-white/10">
      {/* Costura central que evoca el reloj de solapas. */}
      <div className="absolute inset-x-0 top-1/2 z-10 h-px -translate-y-[9px] bg-black/40" aria-hidden />
      <div className="px-1 pb-2.5 pt-4">
        <span className="block text-center font-display text-4xl font-bold tabular-nums tracking-tight text-white sm:text-5xl">
          {value}
        </span>
      </div>
      <div className="border-t border-white/10 bg-white/[0.06] py-2">
        <span className="block text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-white/50">
          {label}
        </span>
      </div>
    </div>
  );
}

export function CountdownTimer() {
  const [r, setR] = useState<Remaining>(getRemaining);

  useEffect(() => {
    const id = window.setInterval(() => setR(getRemaining()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const units = [
    { value: pad(r.days), label: 'Días' },
    { value: pad(r.hours), label: 'Horas' },
    { value: pad(r.minutes), label: 'Min' },
    { value: pad(r.seconds), label: 'Seg' },
  ];

  return (
    <div
      role="timer"
      aria-label={`Faltan ${r.days} días, ${r.hours} horas, ${r.minutes} minutos y ${r.seconds} segundos para la toma de ramos`}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-tertiary">
        {r.done ? 'La toma de ramos ya comenzó' : 'Cuenta regresiva · Toma de ramos'}
      </p>
      <div className="mt-3.5 flex gap-2 sm:gap-3" aria-hidden>
        {units.map((u) => (
          <Unit key={u.label} value={u.value} label={u.label} />
        ))}
      </div>
      <p className="mt-3.5 text-sm text-text-secondary">
        {r.done ? '¡Ya puedes tomar tus ramos! Revisa tu malla.' : EVENT_LABEL}
      </p>
    </div>
  );
}
