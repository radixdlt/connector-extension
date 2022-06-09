module.exports = {
  plugins: ["unused-imports"],
  rules: {
    "arrow-body-style": ["error", "as-needed"],
    "unused-imports/no-unused-imports": "error"
  },
  extends: [
    'alloy',
    'alloy/react',
    'alloy/typescript',
  ],
  settings: {
    react: {
      version: '18'
    },
  }};
