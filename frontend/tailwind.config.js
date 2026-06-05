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
        // "Encre" violet-plum : re-skin sans toucher aux classes existantes (bg-slate-*)
        slate: {
          50: '#f5f4f8',
          100: '#e7e4ee',
          200: '#cbc6d8',
          300: '#a8a1bd',
          400: '#7b7393',
          500: '#4a4262',
          600: '#352e48',
          700: '#272235',
          800: '#1b1827',
          900: '#13111c',
          950: '#0c0a12',
        },
        // Accent primaire : violet royal (plus arcane que l'indigo par défaut)
        indigo: {
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
          700: '#6d28d9',
        },
        // Signature : or vieilli (titre, états actifs, mythiques)
        gold: {
          300: '#e6cf80',
          400: '#d9b94a',
          500: '#c9a227',
          600: '#a8851c',
          700: '#876a14',
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
