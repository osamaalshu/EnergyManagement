/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'surface-dark': '#0f172a',
        surface: '#111c34',
        card: '#15223c',
        accent: '#38bdf8',
      },
      boxShadow: {
        card: '0 12px 30px rgba(15, 23, 42, 0.35)',
      },
      borderRadius: {
        xl: '1.25rem',
      },
    },
  },
  plugins: [],
};
