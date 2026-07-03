/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#FFFFFF',
        surface: '#FAFAF8',
        border: '#ECECEA',
        text: {
          primary: '#1F1F1E',
          secondary: '#6B6B68',
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
        danger: '#D84D42',
      },
      fontFamily: {
        display: ['"Instrument Serif"', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      borderRadius: {
        card: '16px',
        btn: '12px',
        input: '10px',
      },
      boxShadow: {
        subtle: '0 1px 3px rgba(0,0,0,0.04)',
        raised: '0 4px 16px rgba(0,0,0,0.06)',
        sheet: '0 -8px 30px rgba(0,0,0,0.08)',
        modal: '0 12px 40px rgba(0,0,0,0.12)',
      },
    },
  },
  plugins: [],
};
