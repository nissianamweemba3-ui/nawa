import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['node_modules/', 'dist/', 'data/', 'legacy/'] },
  js.configs.recommended,
  {
    files: ['server/**/*.js', 'scripts/**/*.{js,mjs}', 'tests/**/*.js', 'demo/build.mjs', 'eslint.config.js'],
    languageOptions: { ecmaVersion: 2024, sourceType: 'module', globals: { ...globals.node } },
  },
  {
    files: ['demo/main.js', 'demo/mock-api.js'],
    languageOptions: { ecmaVersion: 2024, sourceType: 'module', globals: { ...globals.browser } },
  },
  {
    files: ['web/app.js'],
    languageOptions: { ecmaVersion: 2024, sourceType: 'script', globals: { ...globals.browser } },
  },
  {
    rules: {
      'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none' }],
      'no-console': ['error', { allow: ['log', 'error'] }],
      eqeqeq: ['error', 'always'],
    },
  },
];
