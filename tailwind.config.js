/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#FFFFFF',
        surface: '#FAFAF9',
        border: {
          DEFAULT: '#ECEBE8',
          strong: '#DEDCD7',
        },
        text: {
          primary: '#191917',
          secondary: '#6B6B66',
          tertiary: '#9C9C96',
        },
        accent: {
          DEFAULT: '#4A7C59',
          hover: '#3D6749',
          light: '#EAF2ED',
        },
        beige: {
          DEFAULT: '#E8DCC4',
          light: '#F5EFE3',
        },
        status: {
          completed: '#6BA876',
          progress: '#4A90E2',
          pending: '#C9C9C6',
        },
        danger: {
          DEFAULT: '#D14434',
          light: '#FBEDEB',
        },
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
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
