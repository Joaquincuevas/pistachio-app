/** Color del tema leído desde una variable CSS con canales RGB (ver src/index.css). */
const c = (name) => `rgb(var(--c-${name}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
export default {
  // Modo oscuro por clase: la app decide (claro / oscuro / sistema) y pone `dark` en <html>.
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // Colores del tema como variables CSS (canales RGB): cambian solos con la clase
      // `dark` en <html> y mantienen el soporte de opacidad (bg-card/80, etc.).
      colors: {
        background: c('background'),
        surface: c('surface'),
        card: c('card'),
        border: {
          DEFAULT: c('border'),
          strong: c('border-strong'),
        },
        text: {
          primary: c('text-primary'),
          secondary: c('text-secondary'),
          tertiary: c('text-tertiary'),
        },
        accent: {
          DEFAULT: c('accent'),
          hover: c('accent-hover'),
          light: c('accent-light'),
        },
        beige: {
          DEFAULT: c('beige'),
          light: c('beige-light'),
        },
        status: {
          completed: c('status-completed'),
          progress: c('status-progress'),
          pending: c('status-pending'),
          'completed-bg': c('status-completed-bg'),
          'progress-bg': c('status-progress-bg'),
          'completed-text': c('status-completed-text'),
          'progress-text': c('status-progress-text'),
        },
        danger: {
          DEFAULT: c('danger'),
          light: c('danger-light'),
        },
      },
      fontFamily: {
        // Marca (wordmark, logo, hero). Geométrica, minimalista y elegante.
        display: ['Sora', 'Inter', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      letterSpacing: {
        tight: '-0.014em',
        tighter: '-0.028em',
      },
      borderRadius: {
        card: '16px',
        btn: '12px',
        input: '12px',
      },
      boxShadow: {
        // Sombras casi imperceptibles, apoyadas en bordes (estética sobria).
        subtle: '0 1px 2px rgba(24,24,22,0.04), 0 1px 3px rgba(24,24,22,0.03)',
        raised: '0 2px 8px rgba(24,24,22,0.05), 0 10px 28px rgba(24,24,22,0.04)',
        sheet: '0 -8px 30px rgba(24,24,22,0.08)',
        modal: '0 16px 48px rgba(24,24,22,0.14)',
      },
    },
  },
  plugins: [],
};
