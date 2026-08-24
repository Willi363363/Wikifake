// `DATABASE_URL`, for a tool rather than for the application.
//
// `connectFromEnv` validates the *whole* environment: a Redis URL, a model key,
// everything the running service needs. That is right for the service — a
// half-configured process should refuse to start — and wrong for a command whose
// only job is to talk to Postgres. A seed script has no business demanding a
// model key, and a message naming two variables it does not need is a message
// that sends the reader looking in the wrong place.
export function requireDatabaseUrl(): string {
  const url = process.env['DATABASE_URL'];
  if (url === undefined || url === '') {
    throw new Error('DATABASE_URL is not set — this command needs a database to talk to');
  }
  return url;
}
