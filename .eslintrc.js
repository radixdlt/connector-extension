module.exports = {
  plugins: ['unused-imports'],
  rules: {
    'arrow-body-style': ['error', 'as-needed'],
    'unused-imports/no-unused-imports': 'error',
    'no-undef': 'off',
    '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
    'array-callback-return': 'off',
    'max-nested-callbacks': 'off',
  },
  extends: [
    'alloy',
    'alloy/react',
    'alloy/typescript',
    'plugin:react-hooks/recommended',
  ],
  settings: {
    react: {
      version: '18',
    },
  },
  overrides: [
    {
      files: ['**/chrome-api.test.ts'],
      rules: {
        'max-nested-callbacks': 'off',
        'max-params': 'off',
      },
    },
  ],
}
