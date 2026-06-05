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
        // "Encre chaude" : brun-noir feutré (re-skin sans toucher aux classes bg-slate-*)
        slate: {
          50: '#f5efe4',
          100: '#e8ddc8', // texte crème
          200: '#ddd2c0',
          300: '#c4b5a0',
          400: '#9a8a76', // texte atténué
          500: '#6b5847',
          600: '#3a2d22', // bordures
          700: '#33271d',
          800: '#261d16', // panneaux
          900: '#1a1410', // fond
          950: '#120d0a',
        },
        // Accent primaire : bronze (boutons, liens actifs)
        indigo: {
          300: '#d8be94',
          400: '#c4a574',
          500: '#b08d57',
          600: '#8f6d3c',
          700: '#74562f',
        },
        // Signature : or chaud (titre, états actifs)
        gold: {
          300: '#e0c89a',
          400: '#cdaf76',
          500: '#b08d57',
          600: '#947341',
          700: '#7a5e34',
        },
        // Valeur / gains : vert doux (au lieu de l'émeraude vive)
        emerald: {
          300: '#9ccc8f',
          400: '#7bbf78',
          500: '#5fa45f',
          600: '#4d8a4d',
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
