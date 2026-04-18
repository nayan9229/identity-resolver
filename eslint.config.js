/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    files: ['src/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType:  'module',
      globals: {
        document:  'readonly',
        navigator: 'readonly',
        atob:      'readonly',
        Buffer:    'readonly',
      },
    },
    rules: {
      'no-unused-vars':     ['error', { argsIgnorePattern: '^_' }],
      'no-console':          'error',
      'eqeqeq':             'error',
      'prefer-const':        'error',
      'no-var':              'error',
      'object-shorthand':    'error',
      'prefer-arrow-callback':'error',
    },
  },
];
