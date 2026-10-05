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
          400: '#a0a6ae', // texte atténué (≥ 4.5:1 jusque sur slate-700)
          500: '#868c95', // texte discret (≥ 4.5:1 sur slate-800)
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
          200: '#f1dfb0',
          300: '#e8cd8a',
          400: '#d9b85f',
          500: '#c2953a',
          600: '#a87f2e',
          700: '#8a6824',
          950: '#2a1f0a',
        },
        // Valeurs / prix / courbes : bleu vif (#00b4ff)
        emerald: {
          300: '#5cccff',
          400: '#00b4ff',
          500: '#0098e0',
          600: '#0078b3',
          700: '#005f8f',
          950: '#00263a',
        },
        // Variations à la hausse uniquement : vert (les baisses restent en rose)
        gain: {
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981',
        },
        // Bordure des champs de saisie (≥ 3:1 sur slate-900 et slate-800)
        edge: '#6b7179',
      },
    },
  },
  plugins: [],
};
