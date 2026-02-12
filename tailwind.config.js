/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#1A365D', // Midnight Navy
        secondary: '#82C91E', // Tech Green
        accent: '#FAB005', // Energy Amber
        background: '#F8FAFC', // Clean Slate
        'text-main': '#334155', // Charcoal
        
        // Mapping to existing theme vars where appropriate
        'surface-dark': '#0f172a', // Keep dark bg
        'surface-light': '#F8FAFC', // Use Clean Slate for light bg
        surface: '#111c34',
        'card-dark': '#15223c',
        'card-light': '#FFFFFF',
      },
      fontFamily: {
        sans: ['Inter', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
        heading: ['Inter', 'sans-serif'],
        body: ['Roboto', 'sans-serif'],
      },
      boxShadow: {
        card: '0 12px 30px rgba(15, 23, 42, 0.25)',
        'glass': '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
      },
      borderRadius: {
        xl: '1.25rem', // 20px
      },
    },
  },
  plugins: [],
};
