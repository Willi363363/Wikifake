// Next.js instrumentation hook — runs once at server startup, before any
// request is handled. The standard place to initialise global observability:
// Sentry must be registered here rather than inside a route handler, because
// the handler that catches an error may never be reached.
//
// https://nextjs.org/docs/app/guides/instrumentation
export async function register(): Promise<void> {
  if (process.env['NEXT_RUNTIME'] === 'nodejs') {
    const { initSentry } = await import('./src/sentry.js');
    initSentry();
  }
}
