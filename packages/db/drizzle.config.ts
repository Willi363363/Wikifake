import { defineConfig } from 'drizzle-kit';

// `DATABASE_URL` is read straight from the environment here rather than through
// `@wikifake/env`: `drizzle-kit` is a CLI run by hand and by CI, and it should
// say which variable is missing rather than fail a schema validation that also
// wants a Redis URL and a model key.
const url = process.env['DATABASE_URL'];
if (url === undefined || url === '') {
  throw new Error('DATABASE_URL is not set — drizzle-kit needs a database to talk to');
}

export default defineConfig({
  schema: './src/schema/index.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: { url },
  // Every rule the repository has about diffs applies to migrations too: a
  // reviewer has to be able to read what changes.
  verbose: true,
  strict: true,
});
