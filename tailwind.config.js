/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'surface-dark': '#0f172a',
        'surface-light': '#f5f7fb',
        surface: '#111c34',
        'card-dark': '#15223c',
        'card-light': '#ffffff',
        accent: '#38bdf8',
      },
      boxShadow: {
        card: '0 12px 30px rgba(15, 23, 42, 0.25)',
      },
      borderRadius: {
        xl: '1.25rem',
      },
    },
  },
  plugins: [],
};
