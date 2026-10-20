/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        // Vraies petites capitales (la police ne dessine que des capitales)
        display: ['"Cormorant SC"', 'Georgia', 'serif'],
      },
      colors: {
        // Zinc chaud (re-skin sans toucher aux classes bg-slate-*)
        slate: {
          50: '#f7f6f4',
          100: '#e9e7e3', // texte
          200: '#d6d3ce',
          300: '#bab6af', // texte secondaire
          400: '#a8a49d', // texte atténué (≥ 4.5:1 jusque sur slate-700)
          500: '#8f8b84', // texte discret (≥ 4.5:1 sur slate-800)
          600: '#45454c', // bordures
          700: '#323238', // relevé
          800: '#202024', // panneaux
          900: '#18181b', // fond
          950: '#0e0e10',
        },
        // Accent d'action : sable doré (boutons, liens actifs)
        indigo: {
          300: '#dec287',
          400: '#d4b36f',
          500: '#c8a45c',
          600: '#b08a45',
          700: '#8c6c36',
        },
        // Signature : même sable, échelle complète (titres, états actifs, foil)
        gold: {
          50: '#faf7ee',
          100: '#f5ecd6',
          200: '#ebd9ae',
          300: '#dec287',
          400: '#d4b36f',
          500: '#c8a45c',
          600: '#b08a45',
          700: '#8c6c36',
          800: '#6b5228',
          900: '#4e3c1e',
          950: '#2a2010',
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
        edge: '#6e6c72',
      },
      borderRadius: {
        tile: '1rem',
      },
    },
  },
  plugins: [],
};
