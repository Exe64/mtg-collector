import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['node_modules/**', 'migrations/**'] },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // Activée pour rendre justifiés les `eslint-disable-next-line no-await-in-loop`
      // (boucles à requêtes séquentielles volontaires) et signaler les futurs cas.
      'no-await-in-loop': 'warn',
    },
  },
  {
    files: ['test/**/*.js'],
    languageOptions: { globals: { ...globals.node } },
  },
];
