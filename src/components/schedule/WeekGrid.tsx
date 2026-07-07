import { useMemo } from 'react';
import {
  buildColorMap,
  DAYS_SHORT,
  meetingTypeLabel,
  minutesToHHMM,
  SCHEDULE_PALETTE,
  type Section,
} from '@/lib/schedule';

const START = 8 * 60; // 08:00
const END = 21 * 60 + 30; // 21:30
const PX_PER_MIN = 0.7;
const HOURS = Array.from({ length: (END - START) / 60 + 1 }, (_, i) => 8 + i);

export interface GridItem {
  code: string;
  /** Sigla corta para el bloque, ej. "IOC3201". */
  short: string;
  section: Section;
}

interface Block extends GridItem {
  day: number;
  start: number;
  end: number;
  type: string;
  room: string;
  conflict: boolean;
}

/** Cuadrícula semanal (lun-vie) con los bloques de las secciones elegidas. */
export function WeekGrid({ items }: { items: GridItem[] }) {
  const { blocks, colorByCode } = useMemo(() => {
    const colorByCode = buildColorMap(items.map((it) => it.code));
    const flat: Block[] = [];
    for (const it of items) {
      for (const m of it.section.meetings) {
        flat.push({ ...it, day: m.day, start: m.start, end: m.end, type: m.type, room: m.room, conflict: false });
      }
    }
    // Marca los bloques que se pisan (mismo día, se solapan) de distintos ramos.
    for (let i = 0; i < flat.length; i++) {
      for (let j = i + 1; j < flat.length; j++) {
        const a = flat[i];
        const b = flat[j];
        if (a.day === b.day && a.start < b.end && b.start < a.end && a.code !== b.code) {
          a.conflict = true;
          b.conflict = true;
        }
      }
    }
    return { blocks: flat, colorByCode };
  }, [items]);

  const height = (END - START) * PX_PER_MIN;

  return (
    <div className="overflow-x-auto">
      <div className="flex min-w-[520px] gap-1">
        {/* Eje de horas */}
        <div className="w-9 shrink-0" style={{ height: height + 24 }}>
          <div className="h-6" />
          <div className="relative" style={{ height }}>
            {HOURS.map((h) => (
              <span
                key={h}
                className="absolute -translate-y-1/2 text-[10px] text-text-tertiary"
                style={{ top: (h * 60 - START) * PX_PER_MIN }}
              >
                {h}:00
              </span>
            ))}
          </div>
        </div>

        {/* Columnas por día */}
        {DAYS_SHORT.map((label, day) => (
          <div key={label} className="flex-1">
            <div className="flex h-6 items-center justify-center text-xs font-semibold text-text-secondary">
              {label}
            </div>
            <div
              className="relative rounded-lg border border-border bg-white"
              style={{ height }}
            >
              {HOURS.map((h) => (
                <div
                  key={h}
                  className="absolute inset-x-0 border-t border-border/50"
                  style={{ top: (h * 60 - START) * PX_PER_MIN }}
                  aria-hidden
                />
              ))}
              {blocks
                .filter((b) => b.day === day)
                .map((b, i) => {
                  const c = SCHEDULE_PALETTE[colorByCode.get(b.code) ?? 0];
                  const top = (b.start - START) * PX_PER_MIN;
                  const h = (b.end - b.start) * PX_PER_MIN;
                  return (
                    <div
                      key={`${b.section.nrc}-${i}`}
                      className="absolute inset-x-0.5 overflow-hidden rounded-md px-1 py-0.5 text-[9px] leading-tight"
                      style={{
                        top,
                        height: h,
                        background: b.conflict ? '#FBEDEB' : c.bg,
                        color: b.conflict ? '#A6291B' : c.tx,
                        border: `1px solid ${b.conflict ? '#D14434' : c.bd}`,
                      }}
                      title={`${b.short} · ${meetingTypeLabel(b.type)} · ${minutesToHHMM(b.start)}-${minutesToHHMM(b.end)}${b.room ? ` · ${b.room}` : ''}`}
                    >
                      <span className="block font-semibold">{b.short}</span>
                      <span className="block truncate opacity-80">{meetingTypeLabel(b.type)}</span>
                    </div>
                  );
                })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
