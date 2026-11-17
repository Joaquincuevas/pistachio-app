import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { GitBranch, Network, TrendingUp } from 'lucide-react';
import { CountdownTimer } from '@/components/landing/CountdownTimer';
import { ReededGlassBackground } from '@/components/landing/ReededGlassBackground';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Logo } from '@/components/ui/Logo';
import { ThemeToggleButton } from '@/components/ui/ThemeToggle';
import { PageTransition } from '@/components/ui/PageTransition';
import { Skeleton } from '@/components/ui/Skeleton';
import { SpecialtyIcon } from '@/components/ui/SpecialtyIcon';
import { PISTACHIO_FACT } from '@/lib/utils';
import { useAuthStore } from '@/stores/useAuthStore';
import { useCatalogStore } from '@/stores/useCatalogStore';
import { useToastStore } from '@/stores/useToastStore';

const features = [
  {
    icon: Network,
    title: 'Malla interactiva',
    description:
      'Explora tu Plan de Estudios (2022 o 2025) completo como grid por semestre o como grafo de dependencias con zoom y pan.',
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

  // Easter egg: 3 taps seguidos en Pisti (footer) muestran el dato botánico.
  const taps = useRef(0);
  const resetTimer = useRef<number | null>(null);
  const handleNutTap = () => {
    taps.current += 1;
    if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
    if (taps.current >= 3) {
      taps.current = 0;
      show(PISTACHIO_FACT, 'info');
      return;
    }
    resetTimer.current = window.setTimeout(() => {
      taps.current = 0;
    }, 1600);
  };

  return (
    <PageTransition className="relative isolate min-h-dvh">
      <ReededGlassBackground />
      {/* Nav */}
      <header className="pt-safe">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5">
          <div className="flex items-center gap-2.5">
            <Logo size="sm" />
            <span className="font-display text-2xl font-semibold tracking-tight">Pistachio</span>
          </div>
          <div className="-mr-3 flex items-center gap-1">
            <ThemeToggleButton />
            <Link
              to={user ? '/malla' : '/login'}
              className="flex min-h-11 items-center rounded-btn px-3 text-sm font-medium text-text-secondary transition-colors hover:text-text-primary"
            >
              {user ? 'Ir a mi malla' : 'Iniciar sesión'}
            </Link>
          </div>
        </div>
      </header>

      {/* Hero: mensaje + CTA a la izquierda, cuenta regresiva a la derecha */}
      <section className="mx-auto max-w-5xl px-5 pb-10 pt-6 md:pb-20 md:pt-20">
        <div className="grid items-center gap-8 md:grid-cols-2 md:gap-12">
          {/* Columna de mensaje */}
          <div className="text-center md:text-left">
            <h1 className="font-display text-[clamp(2.375rem,11.5vw,2.875rem)] font-semibold leading-[1.04] tracking-tighter text-text-primary md:text-[72px]">
              Tu malla curricular,
              <br />
              <span className="font-extrabold text-accent">al alcance.</span>
            </h1>
            <p className="mx-auto mt-4 max-w-lg text-[17px] leading-relaxed md:mt-6 text-text-secondary md:mx-0 md:text-xl">
              Planifica tu 2027 antes de la toma de ramos: revisa tu malla, tus
              prerrequisitos y tu avance, todo en un lugar.
            </p>
            <div className="mx-auto mt-7 flex max-w-sm flex-col md:mt-9 gap-3 sm:max-w-none sm:flex-row md:mx-0 md:justify-start">
              {user ? (
                <Link to="/malla">
                  <Button size="lg" fullWidth className="h-14 px-8 text-lg md:h-16 md:px-9">
                    Ir a mi malla
                  </Button>
                </Link>
              ) : (
                <>
                  <Link to="/register" className="sm:w-auto">
                    <Button
                      size="lg"
                      fullWidth
                      className="h-14 px-8 text-lg shadow-[0_8px_24px_-6px_rgba(74,124,89,0.55)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_32px_-8px_rgba(74,124,89,0.65)] active:translate-y-0 active:scale-[0.98] active:shadow-[0_4px_12px_-4px_rgba(74,124,89,0.5)] motion-reduce:transform-none md:h-16 md:px-9"
                    >
                      Crear cuenta
                    </Button>
                  </Link>
                  <Link to="/login" className="sm:w-auto">
                    <Button size="lg" variant="secondary" fullWidth className="h-14 px-8 text-lg md:h-16 md:px-9">
                      Ya tengo cuenta
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>

          {/* Columna de la cuenta regresiva */}
          <div className="rounded-card border border-card/70 bg-card/85 p-5 shadow-raised sm:p-7 md:bg-card/70 md:backdrop-blur-md">
            <CountdownTimer />
          </div>
        </div>
      </section>

      {/* ¿Qué es Pistachio? */}
      <section className="py-12 md:py-16">
        <div className="mx-auto max-w-5xl px-5">
          <h2 className="text-center font-display text-[28px] font-semibold tracking-tight text-text-primary md:text-3xl">
            ¿Qué es Pistachio?
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-center text-sm text-text-secondary">
            Una plataforma para estudiantes de Ingeniería U. Andes que convierte el PDF de tu
            malla en una experiencia interactiva, con los planes de estudio oficiales.
          </p>
          <div className="mt-7 grid gap-3 md:mt-10 md:grid-cols-3 md:gap-4">
            {features.map(({ icon: Icon, title, description }) => (
              <Card
                key={title}
                className="flex gap-4 border-card/70 bg-card/85 p-5 md:block md:bg-card/75 md:p-6 md:backdrop-blur-md"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-btn bg-accent-light">
                  <Icon className="h-5 w-5 text-accent" aria-hidden />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-text-primary md:mt-4">{title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-text-secondary md:mt-1.5">
                    {description}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Especialidades */}
      <section className="py-12 md:py-16">
        <div className="mx-auto max-w-5xl px-5 text-center">
          <h2 className="font-display text-3xl font-semibold tracking-tight text-text-primary">
            Cinco especialidades
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-text-secondary">
            Plan común de 4 semestres y luego tu especialidad: 60 ramos y 11 semestres según el
            Plan de Estudios 2022 o 2025.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-2.5">
            {specialties.length === 0
              ? Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-32 rounded-full" />
                ))
              : specialties.map((specialty) => (
                  <span
                    key={specialty.id}
                    className="flex items-center gap-2 rounded-full border border-card/70 bg-card/85 px-4 py-2 text-sm font-medium text-text-primary shadow-subtle md:bg-card/75 md:backdrop-blur-md"
                  >
                    <SpecialtyIcon icon={specialty.icon} className="h-4 w-4 text-accent" />
                    {specialty.name}
                  </span>
                ))}
          </div>
        </div>
      </section>

      {/* Footer con easter egg */}
      <footer className="border-t border-card/60 pb-safe pt-8">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-2 px-5 text-center">
          <button
            type="button"
            onClick={handleNutTap}
            aria-label="Pisti, la mascota de Pistachio"
            className="mb-1 rounded-2xl transition-transform duration-200 hover:-rotate-3 hover:scale-105 active:scale-95 motion-reduce:transform-none"
          >
            <img
              src="/pisti.png"
              alt=""
              width={383}
              height={720}
              loading="lazy"
              draggable={false}
              className="h-32 w-auto select-none drop-shadow-[0_10px_14px_rgba(25,50,35,0.18)] md:h-40"
            />
          </button>
          <p className="text-xs text-text-secondary">
            Pistachio · Hecho para estudiantes de Ingeniería U. Andes
          </p>
          <p className="pb-14 text-xs font-medium text-text-tertiary">By Ocaoj</p>
        </div>
      </footer>
    </PageTransition>
  );
}
