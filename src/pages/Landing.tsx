import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { GitBranch, Network, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Logo } from '@/components/ui/Logo';
import { PageTransition } from '@/components/ui/PageTransition';
import { Skeleton } from '@/components/ui/Skeleton';
import { PISTACHIO_FACT } from '@/lib/utils';
import { useAuthStore } from '@/stores/useAuthStore';
import { useCatalogStore } from '@/stores/useCatalogStore';
import { useToastStore } from '@/stores/useToastStore';

const features = [
  {
    icon: Network,
    title: 'Malla interactiva',
    description:
      'Explora el Plan de Estudios 2022 completo como grid por semestre o como grafo de dependencias con zoom y pan.',
  },
  {
    icon: GitBranch,
    title: 'Prerrequisitos claros',
    description:
      'Selecciona cualquier ramo y ve al instante qué necesitas antes y qué desbloqueas después, según el catálogo oficial.',
  },
  {
    icon: TrendingUp,
    title: 'Progreso personal',
    description:
      'Marca tus ramos cursados y en progreso. Tu avance y créditos SCT se guardan en tu cuenta.',
  },
];

export function Landing() {
  const user = useAuthStore((s) => s.user);
  const specialties = useCatalogStore((s) => s.specialties);
  const show = useToastStore((s) => s.show);

  // Easter egg: 3 taps seguidos en el 🥜 del footer muestran el dato botánico.
  const taps = useRef(0);
  const resetTimer = useRef<number | null>(null);
  const handleNutTap = () => {
    taps.current += 1;
    if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
    if (taps.current >= 3) {
      taps.current = 0;
      show(`🥜 ${PISTACHIO_FACT}`, 'info');
      return;
    }
    resetTimer.current = window.setTimeout(() => {
      taps.current = 0;
    }, 1600);
  };

  return (
    <PageTransition className="min-h-dvh bg-background">
      {/* Nav */}
      <header className="pt-safe">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5">
          <div className="flex items-center gap-2.5">
            <Logo size="sm" />
            <span className="font-display text-2xl">Pistachio</span>
          </div>
          <Link
            to={user ? '/malla' : '/login'}
            className="rounded-btn px-3 py-2 text-sm font-medium text-text-secondary transition-colors hover:text-text-primary"
          >
            {user ? 'Ir a mi malla' : 'Iniciar sesión'}
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-5 pb-16 pt-14 text-center md:pt-24">
        <h1 className="mx-auto max-w-2xl font-display text-[42px] leading-[1.08] text-text-primary md:text-6xl">
          Tu malla curricular,
          <br />
          <span className="text-accent">al alcance.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-sm italic leading-relaxed text-text-secondary md:text-base">
          “{PISTACHIO_FACT}”
        </p>
        <div className="mx-auto mt-9 flex max-w-xs flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center">
          {user ? (
            <Link to="/malla">
              <Button size="lg" fullWidth>
                Ir a mi malla
              </Button>
            </Link>
          ) : (
            <>
              <Link to="/register" className="sm:w-auto">
                <Button size="lg" fullWidth>
                  Crear cuenta
                </Button>
              </Link>
              <Link to="/login" className="sm:w-auto">
                <Button size="lg" variant="secondary" fullWidth>
                  Ya tengo cuenta
                </Button>
              </Link>
            </>
          )}
        </div>
      </section>

      {/* ¿Qué es Pistachio? */}
      <section className="bg-surface py-16">
        <div className="mx-auto max-w-5xl px-5">
          <h2 className="text-center font-display text-3xl text-text-primary">
            ¿Qué es Pistachio?
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-center text-sm text-text-secondary">
            Una plataforma para estudiantes de Ingeniería U. Andes que convierte el PDF de tu
            malla en una experiencia interactiva, con los planes de estudio oficiales.
          </p>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {features.map(({ icon: Icon, title, description }) => (
              <Card key={title} className="p-6">
                <div className="flex h-11 w-11 items-center justify-center rounded-btn bg-accent-light">
                  <Icon className="h-5 w-5 text-accent" aria-hidden />
                </div>
                <h3 className="mt-4 text-base font-semibold text-text-primary">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-text-secondary">{description}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Especialidades */}
      <section className="py-16">
        <div className="mx-auto max-w-5xl px-5 text-center">
          <h2 className="font-display text-3xl text-text-primary">Cinco especialidades</h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-text-secondary">
            Plan común de 4 semestres y luego tu especialidad: 60 ramos y 11 semestres según el
            Plan de Estudios 2022.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-2.5">
            {specialties.length === 0
              ? Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-32 rounded-full" />
                ))
              : specialties.map((specialty) => (
                  <span
                    key={specialty.id}
                    className="flex items-center gap-2 rounded-full border border-border bg-beige-light px-4 py-2 text-sm font-medium text-text-primary"
                  >
                    <span aria-hidden>{specialty.emoji}</span>
                    {specialty.name}
                  </span>
                ))}
          </div>
        </div>
      </section>

      {/* Footer con easter egg */}
      <footer className="border-t border-border py-8 pb-safe">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-2 px-5 text-center">
          <button
            type="button"
            onClick={handleNutTap}
            aria-label="Un pistacho misterioso"
            className="flex h-11 w-11 items-center justify-center rounded-full text-xl transition-transform hover:scale-110 active:scale-95"
          >
            🥜
          </button>
          <p className="text-xs text-text-secondary">
            Pistachio · Hecho para estudiantes de Ingeniería U. Andes
          </p>
        </div>
      </footer>
    </PageTransition>
  );
}
