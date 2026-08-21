// Root ESLint configuration: it makes `eslint <file>` usable from anywhere,
// which the editor and scripts/checks.sh both rely on.
import shared from "@wikifake/config/eslint";

export default [
  {
    // The Vite frontend in JavaScript is the old stack: it goes away in phase
    // 10 and was never written under these rules. The linter leaves it alone
    // rather than shouting at condemned code.
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
