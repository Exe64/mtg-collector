/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Cinzel', 'Georgia', 'serif'],
      },
      colors: {
        // Anthracite : charbon neutre (re-skin sans toucher aux classes bg-slate-*)
        slate: {
          50: '#f5f6f7',
          100: '#e8eaed', // texte
          200: '#d2d6db',
          300: '#b4bac1',
          400: '#8a9099', // texte atténué
          500: '#565b62',
          600: '#3a3e44', // bordures
          700: '#2c2f33',
          800: '#202225', // panneaux
          900: '#17181a', // fond
          950: '#0f1011',
        },
        // Accent primaire : ambre/miel chaud (boutons, liens actifs)
        indigo: {
          300: '#e3c178',
          400: '#d4ab55',
          500: '#c2953a',
          600: '#a87f2e',
          700: '#8a6824',
        },
        // Signature : or chaud (titre, états actifs)
        gold: {
          300: '#e8cd8a',
          400: '#d9b85f',
          500: '#c2953a',
          600: '#a87f2e',
          700: '#8a6824',
        },
        // Valeur / gains : vert net
        emerald: {
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
        },
        // Identité couleur Magic (liserés de cartes)
        mana: {
          w: '#e9e4c8', u: '#4f8df0', b: '#6b6478', r: '#e0483f', g: '#3aa45b',
          c: '#9aa0a6', multi: '#c9a227',
        },
      },
    },
  },
  plugins: [],
};
