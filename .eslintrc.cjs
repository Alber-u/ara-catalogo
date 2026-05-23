/* eslint-env node */
// ============================================================
// ESLint · ARA CATÁLOGO
// ============================================================
// Mismo patrón que ara-os. Ver ara-os/.eslintrc.cjs para detalle.
//
// Cómo usar:
//   npm run lint        → reporta problemas
//   npm run lint:fix    → arregla los auto-fixables
// ============================================================
module.exports = {
  root: true,
  env: { browser: true, es2020: true, node: true },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
    'prettier',
  ],
  ignorePatterns: ['dist', 'build', 'node_modules', '.eslintrc.cjs'],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  settings: { react: { version: '18.3' } },
  plugins: ['react-refresh'],
  rules: {
    'react/prop-types': 'off',
    'react/no-unescaped-entities': 'off',
    'react/display-name': 'off',
    'no-unused-vars': ['warn', {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
      caughtErrorsIgnorePattern: '^_',
    }],
    'no-console': 'off',
    'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    'no-empty': ['warn', { allowEmptyCatch: true }],
    'no-constant-condition': ['warn', { checkLoops: false }],
    'no-useless-escape': 'warn', // escapes innecesarios en regex: cosmético
  },
}
