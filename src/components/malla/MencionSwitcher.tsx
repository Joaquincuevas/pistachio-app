import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useActivePlan } from '@/hooks/useActivePlan';
import { useCurriculumStore } from '@/stores/useCurriculumStore';
import { useToastStore } from '@/stores/useToastStore';

const shortName = (name: string) => name.replace(/^Mención\s+/i, '');

/**
 * Selector rápido de mención en la malla. Solo aparece en especialidades que
 * ofrecen menciones (ICI, IOC). Cambiar de mención conserva el progreso de los
 * ramos compartidos (el servidor los copia al plan nuevo).
 */
export function MencionSwitcher() {
  const { specialty, plan } = useActivePlan();
  const choosePlan = useCurriculumStore((s) => s.choosePlan);
  const show = useToastStore((s) => s.show);
  const [saving, setSaving] = useState(false);

  if (!specialty || !plan) return null;

  const baseId = plan.mentionOf ?? plan.id;
  const menciones = specialty.plans.filter((p) => p.mentionOf === baseId);
  if (menciones.length === 0) return null;

  const options = [
    { id: baseId, label: 'Por definir' },
    ...menciones.map((m) => ({ id: m.id, label: shortName(m.name) })),
  ];

  const onChange = async (event: React.ChangeEvent<HTMLSelectElement>) => {
    const nextId = event.target.value;
    if (nextId === plan.id || saving) return;
    setSaving(true);
    try {
      await choosePlan(specialty.id, nextId);
      const picked = options.find((o) => o.id === nextId);
      show(picked && nextId !== baseId ? `Mención: ${picked.label}` : 'Mención sin definir');
    } catch {
      show('No se pudo cambiar la mención. Revisa tu conexión.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <label className="inline-flex items-center gap-2 text-xs text-text-secondary">
      <span className="font-medium">Mención</span>
      <span className="relative inline-flex items-center">
        <select
          value={plan.id}
          onChange={onChange}
          disabled={saving}
          aria-label="Cambiar mención"
          className="appearance-none rounded-btn border border-border bg-white py-1.5 pl-3 pr-8 text-xs font-medium text-text-primary shadow-subtle transition-colors hover:border-accent/40 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30 disabled:opacity-60"
        >
          {options.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-2.5 h-3.5 w-3.5 text-text-secondary"
          aria-hidden
        />
      </span>
    </label>
  );
}
