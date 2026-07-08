import { useRef, useState } from 'react';
import { FileSpreadsheet, Loader2, Upload } from 'lucide-react';
import { parseHorario } from '@/lib/schedule';
import { useScheduleStore } from '@/stores/useScheduleStore';
import { useToastStore } from '@/stores/useToastStore';

/** Carga y parseo (en el navegador) del Excel de horario oficial. */
export function ScheduleUpload({ compact = false }: { compact?: boolean }) {
  const setOffering = useScheduleStore((s) => s.setOffering);
  const show = useToastStore((s) => s.show);
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setLoading(true);
    try {
      const offering = await parseHorario(await file.arrayBuffer(), file.name);
      setOffering(offering);
      show(`Horario cargado: ${offering.sections.length} secciones, ${offering.label}.`);
    } catch (error) {
      show(error instanceof Error ? error.message : 'No se pudo leer el archivo.', 'error');
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0])}
      />
      {compact ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-btn border border-border bg-white px-3.5 py-2 text-sm font-medium text-text-primary transition-colors hover:border-accent/40 disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Upload className="h-4 w-4" aria-hidden />}
          {loading ? 'Leyendo…' : 'Subir horario'}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={loading}
          className="flex w-full flex-col items-center gap-3 rounded-card border border-dashed border-border-strong bg-white px-6 py-10 text-center transition-colors hover:border-accent/50 disabled:opacity-60"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-btn bg-accent-light">
            {loading ? (
              <Loader2 className="h-6 w-6 animate-spin text-accent" aria-hidden />
            ) : (
              <FileSpreadsheet className="h-6 w-6 text-accent" aria-hidden />
            )}
          </span>
          <span className="text-sm font-semibold text-text-primary">
            {loading ? 'Leyendo el archivo…' : 'Sube el horario oficial (.xlsx)'}
          </span>
          <span className="max-w-xs text-xs leading-relaxed text-text-secondary">
            El mismo Excel que la Facultad publica en Canvas con los ramos del próximo semestre. Se
            procesa en tu dispositivo; no se sube a ningún servidor.
          </span>
        </button>
      )}
    </>
  );
}
