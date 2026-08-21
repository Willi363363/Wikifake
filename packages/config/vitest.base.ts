import { defineConfig } from 'vitest/config';

// Base partagée : chaque paquet la réexporte. La couverture est mesurée mais
// sans seuil bloquant — un seuil sur un dépôt qui démarre ne mesure rien.
export const baseConfig = defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text-summary'],
      reportsDirectory: 'coverage',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts'],
    },
  },
});
