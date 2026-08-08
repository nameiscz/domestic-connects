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
  ignorePatterns: ['dist', 'node_modules', '.eslintrc.cjs'],
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
    // This project does not use prop-types.
    'react/prop-types': 'off',
    // Allow exporting plain constants next to components.
    'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
  },
};
