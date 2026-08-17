module.exports = {
  root: true,
  env: {
    browser: true,
    es2020: true,
    node: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', 'node_modules', '.eslintrc.cjs', 'tailwind.config.ts'],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  settings: {
    react: { version: '18.3' },
  },
  plugins: ['react-refresh'],
  rules: {
    // React 17+ JSX transform — no need to import React in every file.
    'react/react-in-jsx-scope': 'off',
    // This project does not use prop-types (types come from TypeScript).
    'react/prop-types': 'off',
    // Allow exporting plain constants next to components.
    'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
  },
  overrides: [
    {
      // TypeScript files get full type-aware linting rules.
      files: ['**/*.ts', '**/*.tsx'],
      parser: '@typescript-eslint/parser',
      plugins: ['@typescript-eslint'],
      extends: ['plugin:@typescript-eslint/recommended'],
      rules: {
        // The base rule misfires on TS (type-only imports etc.); the
        // typescript-eslint version replaces it.
        'no-unused-vars': 'off',
        '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
        // Migration rule of record: explicit `any` is never allowed.
        '@typescript-eslint/no-explicit-any': 'error',
      },
    },
  ],
};
