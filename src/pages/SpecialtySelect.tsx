import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/ui/Logo';
import { PageTransition } from '@/components/ui/PageTransition';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn } from '@/lib/utils';
import { useCatalogStore } from '@/stores/useCatalogStore';
import { useCurriculumStore } from '@/stores/useCurriculumStore';
import { useToastStore } from '@/stores/useToastStore';

export function SpecialtySelect() {
  const specialties = useCatalogStore((s) => s.specialties);
  const catalogStatus = useCatalogStore((s) => s.status);
  const currentSpecialtyId = useCurriculumStore((s) => s.specialtyId);
  const currentPlanId = useCurriculumStore((s) => s.planId);
  const choosePlan = useCurriculumStore((s) => s.choosePlan);
  const show = useToastStore((s) => s.show);
  const navigate = useNavigate();

  const [selected, setSelected] = useState<string | null>(currentSpecialtyId);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(currentPlanId);
  const [saving, setSaving] = useState(false);

  const specialty = specialties.find((s) => s.id === selected);
  // Si la especialidad tiene un solo plan, se selecciona solo.
  const effectivePlanId =
    specialty?.plans.length === 1
      ? specialty.plans[0].id
      : specialty?.plans.some((p) => p.id === selectedPlanId)
        ? selectedPlanId
        : null;

  const pick = (id: string) => {
    setSelected(id);
    const spec = specialties.find((s) => s.id === id);
    if (spec && spec.plans.length > 1) {
      // Por defecto la versión más reciente del plan (la última publicada).
      setSelectedPlanId(spec.plans[spec.plans.length - 1].id);
    }
  };

  const confirm = async () => {
    if (!specialty || !effectivePlanId) return;
    setSaving(true);
    try {
      await choosePlan(specialty.id, effectivePlanId);
      show(`Especialidad seleccionada: ${specialty.name} ${specialty.emoji}`);
      navigate('/malla');
    } catch (error) {
      show(error instanceof Error ? error.message : 'No se pudo guardar', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageTransition className="flex min-h-dvh flex-col bg-surface pt-safe">
      <div className="mx-auto w-full max-w-3xl flex-1 px-5 pb-40 pt-10">
        <Logo size="lg" />
        <h1 className="mt-5 font-display text-3xl text-text-primary md:text-4xl">
          Elige tu especialidad
        </h1>
        <p className="mt-2 max-w-md text-sm text-text-secondary">
          Cargaremos tu malla completa del Plan de Estudios 2022. Podrás cambiarla después desde
          tu perfil sin perder tu progreso.
        </p>

        {catalogStatus !== 'ready' ? (
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-card" />
            ))}
          </div>
        ) : (
          <div role="radiogroup" aria-label="Especialidades" className="mt-8 grid gap-3 sm:grid-cols-2">
            {specialties.map((spec) => {
              const isSelected = selected === spec.id;
              return (
                <motion.button
                  key={spec.id}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => pick(spec.id)}
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
                    {spec.emoji}
                  </span>
                  <span className="min-w-0 pr-6">
                    <span className="block text-base font-semibold text-text-primary">
                      {spec.name}
                    </span>
                    <span className="mt-1 block text-sm leading-snug text-text-secondary">
                      {spec.tagline}
                    </span>
                    <span className="mt-2 block text-xs text-text-secondary">
                      {spec.plans[0]?.courses.length ?? 0} ramos · {spec.plans.length}{' '}
                      {spec.plans.length === 1 ? 'plan' : 'planes'}
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
        )}

        {/* Versión del plan de estudios (solo si hay más de una) */}
        <AnimatePresence>
          {specialty && specialty.plans.length > 1 && (
            <motion.section
              aria-label="Versión del plan de estudios"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.2 }}
              className="mt-6"
            >
              <h2 className="text-sm font-semibold text-text-primary">
                Versión del plan de estudios
              </h2>
              <div role="radiogroup" aria-label="Planes disponibles" className="mt-3 grid gap-2">
                {specialty.plans.map((plan, index) => {
                  const isActive = effectivePlanId === plan.id;
                  const isLatest = index === specialty.plans.length - 1;
                  return (
                    <button
                      key={plan.id}
                      type="button"
                      role="radio"
                      aria-checked={isActive}
                      onClick={() => setSelectedPlanId(plan.id)}
                      className={cn(
                        'flex min-h-[52px] items-center justify-between gap-3 rounded-card border bg-white px-4 py-3 text-left transition-colors',
                        isActive
                          ? 'border-accent ring-2 ring-accent'
                          : 'border-border hover:border-accent/40',
                      )}
                    >
                      <span className="text-sm font-medium text-text-primary">{plan.name}</span>
                      <span className="flex items-center gap-2">
                        {isLatest && (
                          <span className="rounded-full bg-accent-light px-2.5 py-0.5 text-[11px] font-medium text-accent-hover">
                            Nueva
                          </span>
                        )}
                        {isActive && <CheckCircle2 className="h-4 w-4 text-accent" aria-hidden />}
                      </span>
                    </button>
                  );
                })}
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </div>

      {/* Barra de confirmación fija */}
      <div className="fixed inset-x-0 bottom-0 border-t border-border bg-white/95 pb-safe backdrop-blur">
        <div className="mx-auto max-w-3xl px-5 py-4">
          <Button size="lg" fullWidth disabled={!effectivePlanId} loading={saving} onClick={confirm}>
            {specialty && effectivePlanId
              ? `Confirmar ${specialty.name}`
              : 'Selecciona una especialidad'}
          </Button>
        </div>
      </div>
    </PageTransition>
  );
}
