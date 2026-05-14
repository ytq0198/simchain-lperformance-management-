/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{vue,ts}'],
  theme: {
    extend: {
      colors: {
        shell: {
          bg: '#0b1220',
          sidebar: '#0f172a',
          panel: 'rgba(15, 23, 42, 0.72)',
          border: 'rgba(51, 65, 85, 0.65)',
          accent: '#22d3ee',
          accent2: '#6366f1',
        },
      },
      boxShadow: {
        glow: '0 0 24px rgba(34, 211, 238, 0.15)',
      },
    },
  },
  plugins: [],
};
