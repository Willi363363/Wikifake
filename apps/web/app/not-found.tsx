// Step 11.8 — the 404 for a URL that never reached a locale.
//
// `[locale]/not-found.tsx` handles an unknown page *inside* a locale. This one
// handles a URL whose first segment is not a locale at all, which the proxy does
// not route into the segment — so the `[locale]` layout never runs, and neither
// the provider nor the messages exist here.
//
// It therefore renders its own `<html>` and its own English words. That is not
// an oversight to fix later: the request never said which language it wanted, and
// guessing one from `Accept-Language` in a 404 would mean running locale
// detection in the one place the routing has already declined to.
//
// The stylesheet is imported directly, so the page is a WikiFake page rather
// than the browser's default serif on white.
import './globals.css';

export default function RootNotFound() {
  return (
    <html lang="en">
      <body className="bg-bg text-ink">
        <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-4 py-12 text-center">
          <h1 className="text-3xl font-semibold text-ink">That page is not here</h1>
          <p className="mt-3 text-sm text-muted">
            The address does not name a language WikiFake serves, so there is nothing to
            show. The front door will pick one for you.
          </p>
          {/* A plain anchor, not `next/link`: this page is outside the router's
              locale tree, and a hard navigation is what puts the request back
              through the proxy that does the detection. */}
          <p className="mt-8">
            <a href="/" className="text-accent underline underline-offset-4">
              wikifake — start here
            </a>
          </p>
        </main>
      </body>
    </html>
  );
}
