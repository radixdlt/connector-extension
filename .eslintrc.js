module.exports = {
  plugins: ["unused-imports"],
  rules: {
    "arrow-body-style": ["error", "as-needed"],
    "unused-imports/no-unused-imports": "error",
    "no-undef": "off"
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
  },
};
