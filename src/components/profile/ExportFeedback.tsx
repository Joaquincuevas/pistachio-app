import { useEffect, useState } from 'react';
import { Download, Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { downloadText } from '@/lib/scheduleExport';
import { useToastStore } from '@/stores/useToastStore';

/**
 * Exportar el feedback que el alumno dio a las respuestas de Export (👍/👎).
 *
 * Los registros viven SOLO en este dispositivo (localStorage): nunca se envían
 * a un servidor. Esta tarjeta permite descargarlos para alimentar el dataset de
 * entrenamiento del modelo (ver ml/feedback-to-dataset.ts). Si no hay feedback,
 * no se muestra nada.
 */
const FEEDBACK_KEY = 'pistachio:export-feedback';

interface FeedbackEntry {
  ts: string;
  query: string;
  intent: string;
  helpful: boolean;
}

function readFeedback(): FeedbackEntry[] {
  try {
    const raw = localStorage.getItem(FEEDBACK_KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list) ? (list as FeedbackEntry[]) : [];
  } catch {
    return [];
  }
}

export function ExportFeedback() {
  const [entries, setEntries] = useState<FeedbackEntry[]>([]);
  const show = useToastStore((s) => s.show);

  useEffect(() => {
    setEntries(readFeedback());
  }, []);

  if (entries.length === 0) return null;

  const bad = entries.filter((e) => !e.helpful).length;

  const handleDownload = () => {
    const date = new Date().toISOString().slice(0, 10);
    downloadText(`export-feedback-${date}.json`, JSON.stringify(entries, null, 2), 'application/json');
    show('Feedback descargado. ¡Gracias por ayudar a mejorar a Export!', 'success');
  };

  const handleClear = () => {
    localStorage.removeItem(FEEDBACK_KEY);
    setEntries([]);
    show('Feedback borrado de este dispositivo.', 'info');
  };

  return (
    <Card className="p-4">
      <h3 className="text-sm font-semibold text-text-primary">Ayuda a mejorar a Export</h3>
      <p className="mt-1 text-xs text-text-secondary">
        Guardaste {entries.length} {entries.length === 1 ? 'valoración' : 'valoraciones'} de las
        respuestas del asistente
        {bad > 0 && ` (${bad} ${bad === 1 ? 'marcada' : 'marcadas'} como incorrecta${bad === 1 ? '' : 's'})`}. Están
        solo en este dispositivo. Si nos las envías, sirven para entrenar mejor al modelo.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleDownload}
          className="inline-flex items-center gap-2 rounded-btn bg-accent px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
        >
          <Download className="h-4 w-4" aria-hidden />
          Descargar
        </button>
        <button
          type="button"
          onClick={handleClear}
          className="inline-flex items-center gap-2 rounded-btn border border-border bg-white px-3.5 py-2 text-sm font-medium text-text-secondary transition-colors hover:border-danger/40 hover:text-danger"
        >
          <Trash2 className="h-4 w-4" aria-hidden />
          Borrar
        </button>
      </div>
    </Card>
  );
}
