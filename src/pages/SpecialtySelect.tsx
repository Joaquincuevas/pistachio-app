import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/ui/Logo';
import { PageTransition } from '@/components/ui/PageTransition';
import { specialties } from '@/data/curriculum';
import { cn } from '@/lib/utils';
import { useCurriculumStore } from '@/stores/useCurriculumStore';
import { useToastStore } from '@/stores/useToastStore';

export function SpecialtySelect() {
  const currentId = useCurriculumStore((s) => s.specialtyId);
  const setSpecialty = useCurriculumStore((s) => s.setSpecialty);
  const show = useToastStore((s) => s.show);
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string | null>(currentId);

  const confirm = () => {
    const specialty = specialties.find((s) => s.id === selected);
    if (!specialty) return;
    setSpecialty(specialty.id);
    show(`Especialidad seleccionada: ${specialty.name} ${specialty.emoji}`);
    navigate('/malla');
  };

  return (
    <PageTransition className="flex min-h-dvh flex-col bg-surface pt-safe">
      <div className="mx-auto w-full max-w-3xl flex-1 px-5 pb-36 pt-10">
        <Logo size="lg" />
        <h1 className="mt-5 font-display text-3xl text-text-primary md:text-4xl">
          Elige tu especialidad
        </h1>
        <p className="mt-2 max-w-md text-sm text-text-secondary">
          Cargaremos tu malla completa. Podrás cambiarla después desde tu perfil sin perder tu
          progreso.
        </p>

        <div role="radiogroup" aria-label="Especialidades" className="mt-8 grid gap-3 sm:grid-cols-2">
          {specialties.map((specialty) => {
            const isSelected = selected === specialty.id;
            return (
              <motion.button
                key={specialty.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => setSelected(specialty.id)}
                whileTap={{ scale: 0.98 }}
                className={cn(
                  'relative flex items-start gap-4 rounded-card border bg-white p-5 text-left shadow-subtle transition-colors duration-150',
                  isSelected
                    ? 'border-accent ring-2 ring-accent'
                    : 'border-border hover:border-accent/40',
                )}
              >
                <span
                  aria-hidden
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-btn bg-beige-light text-2xl"
                >
                  {specialty.emoji}
                </span>
                <span className="min-w-0 pr-6">
                  <span className="block text-base font-semibold text-text-primary">
                    {specialty.name}
                  </span>
                  <span className="mt-1 block text-sm leading-snug text-text-secondary">
                    {specialty.tagline}
                  </span>
                  <span className="mt-2 block text-xs text-text-secondary">
                    {specialty.courses.length} ramos
                  </span>
                </span>
                <AnimatePresence>
                  {isSelected && (
                    <motion.span
                      className="absolute right-4 top-4 text-accent"
                      initial={{ scale: 0.4, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.4, opacity: 0 }}
                      transition={{ duration: 0.15 }}
                    >
                      <CheckCircle2 className="h-5 w-5" aria-hidden />
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Barra de confirmación fija */}
      <div className="fixed inset-x-0 bottom-0 border-t border-border bg-white/95 pb-safe backdrop-blur">
        <div className="mx-auto max-w-3xl px-5 py-4">
          <Button size="lg" fullWidth disabled={!selected} onClick={confirm}>
            {selected
              ? `Confirmar ${specialties.find((s) => s.id === selected)?.name}`
              : 'Selecciona una especialidad'}
          </Button>
        </div>
      </div>
    </PageTransition>
  );
}
