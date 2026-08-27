import { defineConfig } from 'drizzle-kit';

import { requireDatabaseUrl } from './src/database-url.js';

export default defineConfig({
  schema: './src/schema/index.ts',
  out: './migrations',
  dialect: 'postgresql',
  // Not `connectFromEnv`: a CLI should name the one variable it needs, rather
  // than fail a validation that also wants a Redis URL and a model key.
  dbCredentials: { url: requireDatabaseUrl() },
  // Every rule the repository has about diffs applies to migrations too: a
  // reviewer has to be able to read what changes.
  verbose: true,
  strict: true,
});
