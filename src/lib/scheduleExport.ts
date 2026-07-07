import {
  buildColorMap,
  DAYS_SHORT,
  meetingTypeLabel,
  minutesToHHMM,
  SCHEDULE_PALETTE,
  type Offering,
  type Section,
} from './schedule';

/**
 * Exportar el horario armado: copiar los NRC para la toma de ramos real,
 * descargar un .ics para importarlo al calendario, o una imagen para
 * compartirlo. Todo se genera en el navegador, sin librerías externas.
 */

export interface ScheduleItem {
  code: string;
  title: string;
  credits: number;
  section: Section;
}

// ─── Copiar NRC ───────────────────────────────────────────────────

/** Lista de NRC uno por línea, con el ramo al lado, lista para pegar/leer. */
export function buildNrcList(items: ScheduleItem[]): string {
  return items.map((it) => `${it.section.nrc}  ·  ${it.title} (Sección ${it.section.section})`).join('\n');
}

/** Solo los números de NRC, separados por coma (para pegar en Banner). */
export function buildNrcCsv(items: ScheduleItem[]): string {
  return items.map((it) => it.section.nrc).join(', ');
}

export async function copyToClipboard(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}

// ─── Exportar a calendario (.ics) ─────────────────────────────────

const ICS_DOW = ['MO', 'TU', 'WE', 'TH', 'FR'];

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Escapa texto para un campo ICS (coma, punto y coma, backslash, saltos de línea). */
function escapeIcs(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/,/g, '\\,').replace(/;/g, '\\;').replace(/\n/g, '\\n');
}

/** Pliega una línea a <=74 caracteres por línea física, como exige RFC 5545. */
function foldLine(line: string): string {
  if (line.length <= 74) return line;
  let out = line.slice(0, 74);
  let rest = line.slice(74);
  while (rest.length > 0) {
    out += '\r\n ' + rest.slice(0, 73);
    rest = rest.slice(73);
  }
  return out;
}

/** Primera fecha >= startDate cuyo día de semana coincide con `dayIndex` (0=lun). */
function firstOccurrence(startDateISO: string, dayIndex: number): Date {
  const d = new Date(`${startDateISO}T00:00:00`);
  const targetDow = dayIndex + 1; // JS: lunes=1 … viernes=5
  const diff = (targetDow - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + diff);
  return d;
}

/** Fecha+hora local en formato ICS "flotante" (sin Z ni TZID): YYYYMMDDTHHMMSS. */
function icsLocalDateTime(date: Date, minutesFromMidnight: number): string {
  const y = date.getFullYear();
  const mo = pad2(date.getMonth() + 1);
  const d = pad2(date.getDate());
  const h = pad2(Math.floor(minutesFromMidnight / 60));
  const mi = pad2(minutesFromMidnight % 60);
  return `${y}${mo}${d}T${h}${mi}00`;
}

function icsStamp(date: Date): string {
  return `${date.getUTCFullYear()}${pad2(date.getUTCMonth() + 1)}${pad2(date.getUTCDate())}T${pad2(
    date.getUTCHours(),
  )}${pad2(date.getUTCMinutes())}${pad2(date.getUTCSeconds())}Z`;
}

/**
 * Genera un calendario .ics con un evento recurrente semanal por cada bloque
 * (clase, ayudantía, laboratorio) de los ramos elegidos, en horario local
 * flotante (sin zona horaria: se interpreta con la del dispositivo).
 */
export function buildIcs(items: ScheduleItem[], offering: Offering): string {
  const now = new Date();
  const stamp = icsStamp(now);
  const lines: (string | null)[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Pistachio//Toma de ramos//ES',
    'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:${escapeIcs(`Horario — ${offering.label}`)}`,
  ];

  let n = 0;
  for (const item of items) {
    for (const m of item.section.meetings) {
      if (!m.startDate || !m.endDate) continue;
      n += 1;
      const first = firstOccurrence(m.startDate, m.day);
      const dtstart = icsLocalDateTime(first, m.start);
      const dtend = icsLocalDateTime(first, m.end);
      const until = m.endDate.replace(/-/g, '') + 'T235959';
      const summary = `${item.code} — ${item.title} (${meetingTypeLabel(m.type)})`;
      // Salto de línea real: escapeIcs() lo convierte a la secuencia "\n"
      // literal que exige el formato ICS (si se pre-escapara aquí, quedaría
      // doblemente escapado al pasar por escapeIcs más abajo).
      const description = [
        `Sección ${item.section.section} · NRC ${item.section.nrc}`,
        item.section.professor ? `Profesor: ${item.section.professor}` : null,
      ]
        .filter(Boolean)
        .join('\n');

      lines.push(
        'BEGIN:VEVENT',
        `UID:${item.section.nrc}-${n}@pistachio-app`,
        `DTSTAMP:${stamp}`,
        `DTSTART:${dtstart}`,
        `DTEND:${dtend}`,
        `RRULE:FREQ=WEEKLY;BYDAY=${ICS_DOW[m.day]};UNTIL=${until}`,
        `SUMMARY:${escapeIcs(summary)}`,
        `DESCRIPTION:${escapeIcs(description)}`,
        m.room ? `LOCATION:${escapeIcs(m.room)}` : null,
        'END:VEVENT',
      );
    }
  }

  lines.push('END:VCALENDAR');
  return lines.filter((l): l is string => l !== null).map(foldLine).join('\r\n');
}

export function downloadText(filename: string, content: string, mime = 'text/plain'): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Exportar como imagen (PNG) ────────────────────────────────────

const IMG_START = 8 * 60;
const IMG_END = 21 * 60 + 30;
const IMG_PX_PER_MIN = 2.6;
const IMG_HOUR_COL = 56;
const IMG_DAY_COL = 190;
const IMG_HEADER_H = 44;
const IMG_TOP_PAD = 56;
const IMG_PAD = 24;

/** Dibuja la grilla semanal en un <canvas> a alta resolución (para descargar como PNG). */
export function renderScheduleCanvas(items: ScheduleItem[], offeringLabel: string): HTMLCanvasElement {
  const colorByCode = buildColorMap(items.map((it) => it.code));
  const gridHeight = (IMG_END - IMG_START) * IMG_PX_PER_MIN;
  const width = IMG_PAD * 2 + IMG_HOUR_COL + IMG_DAY_COL * 5;
  const height = IMG_TOP_PAD + IMG_HEADER_H + gridHeight + IMG_PAD;

  const scale = 2; // exporta a 2x para que se vea nítido
  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);

  // Fondo
  ctx.fillStyle = '#FAFAF9';
  ctx.fillRect(0, 0, width, height);

  // Título
  ctx.fillStyle = '#191917';
  ctx.font = '600 18px -apple-system, Inter, sans-serif';
  ctx.fillText('Mi horario', IMG_PAD, 30);
  ctx.fillStyle = '#6B6B66';
  ctx.font = '400 12px -apple-system, Inter, sans-serif';
  ctx.fillText(offeringLabel, IMG_PAD, 46);

  const gridTop = IMG_TOP_PAD + IMG_HEADER_H;
  const gridLeft = IMG_PAD + IMG_HOUR_COL;

  // Horas
  ctx.strokeStyle = '#ECEBE8';
  ctx.fillStyle = '#9C9C96';
  ctx.font = '400 10px -apple-system, Inter, sans-serif';
  for (let h = 8; h <= 21; h++) {
    const y = gridTop + (h * 60 - IMG_START) * IMG_PX_PER_MIN;
    ctx.fillText(`${h}:00`, IMG_PAD, y + 3);
    ctx.beginPath();
    ctx.moveTo(gridLeft, y);
    ctx.lineTo(gridLeft + IMG_DAY_COL * 5, y);
    ctx.stroke();
  }

  // Columnas de días
  ctx.strokeStyle = '#DEDCD7';
  for (let d = 0; d <= 5; d++) {
    const x = gridLeft + d * IMG_DAY_COL;
    ctx.beginPath();
    ctx.moveTo(x, gridTop);
    ctx.lineTo(x, gridTop + gridHeight);
    ctx.stroke();
  }
  ctx.fillStyle = '#191917';
  ctx.font = '600 13px -apple-system, Inter, sans-serif';
  DAYS_SHORT.forEach((label, d) => {
    const x = gridLeft + d * IMG_DAY_COL + IMG_DAY_COL / 2;
    ctx.textAlign = 'center';
    ctx.fillText(label, x, IMG_TOP_PAD + 16);
  });
  ctx.textAlign = 'left';

  // Bloques
  const radius = 8;
  const roundRect = (x: number, y: number, w: number, h: number, r: number) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };

  for (const item of items) {
    const color = SCHEDULE_PALETTE[colorByCode.get(item.code) ?? 0];
    for (const m of item.section.meetings) {
      const x = gridLeft + m.day * IMG_DAY_COL + 3;
      const y = gridTop + (m.start - IMG_START) * IMG_PX_PER_MIN;
      const w = IMG_DAY_COL - 6;
      const h = (m.end - m.start) * IMG_PX_PER_MIN;

      ctx.fillStyle = color.bg;
      ctx.strokeStyle = color.bd;
      ctx.lineWidth = 1.5;
      roundRect(x, y, w, h, radius);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = color.tx;
      ctx.font = '600 11px -apple-system, Inter, sans-serif';
      ctx.fillText(item.code, x + 8, y + 16);
      ctx.font = '400 10px -apple-system, Inter, sans-serif';
      ctx.fillText(meetingTypeLabel(m.type), x + 8, y + 30);
      if (h > 44) {
        ctx.fillText(`${minutesToHHMM(m.start)}–${minutesToHHMM(m.end)}`, x + 8, y + 44);
      }
    }
  }

  return canvas;
}

export function downloadCanvasPng(canvas: HTMLCanvasElement, filename: string): void {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, 'image/png');
}
