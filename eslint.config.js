// Configuration ESLint racine : elle rend `eslint <fichier>` utilisable depuis
// n'importe où, ce dont dépendent l'éditeur et `scripts/checks.sh`.
import shared from "@wikifake/config/eslint";

export default [
  {
    // Le front Vite en JavaScript est l'ancienne stack : il disparaît à la
    // phase 10 et n'a jamais été écrit sous ces règles. Le linter le laisse
    // tranquille plutôt que de crier sur du code condamné.
    ignores: [
      "frontend/**",
      "backend/**",
      "**/dist/**",
      "**/coverage/**",
      "**/.turbo/**",
    ],
  },
  ...shared,
];
