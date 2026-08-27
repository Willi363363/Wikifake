// Root ESLint configuration: it makes `eslint <file>` usable from anywhere,
// which the editor and scripts/checks.sh both rely on.
import shared from '@wikifake/config/eslint';

export default [
  {
    ignores: ['**/dist/**', '**/coverage/**', '**/.turbo/**'],
  },
  ...shared,
];
