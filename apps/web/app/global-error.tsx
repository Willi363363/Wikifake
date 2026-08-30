'use client';

// Step 11.8 — the last resort: the root layout itself failed.
//
// Next replaces the whole document with this component when the error happened
// above every boundary, so it renders its own `<html>` and `<body>`. That is the
// constraint that decides everything else about the file: `NextIntlClientProvider`
// lives in the layout that just failed, so there is **no provider and no
// messages**. `useTranslations` here would throw inside the error page, which is
// the one place a second error has nowhere left to go.
//
// So the words are in this file, in English, under `lang="en"`. They are not in
// the catalogue: a key that nothing can ever read is dead weight, and
// `02-repository-rules.md` says dead code gets deleted rather than kept in case.
// The page says plainly that it is in English whatever you were reading, so a
// French player meets an explanation rather than a glitch.
//
// It also carries its own inline styles rather than a class from the design
// system: the stylesheet is one of the things that may have failed to load, and a
// last-resort page that depends on the thing that broke is not a last resort.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.75rem',
          padding: '2rem 1rem',
          textAlign: 'center',
          background: '#f6f4ef',
          color: '#18181b',
          fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
        }}
      >
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 600 }}>
          WikiFake could not start
        </h1>
        <p
          style={{ margin: 0, maxWidth: '34rem', fontSize: '0.875rem', color: '#6e6e77' }}
        >
          The page failed before it could load anything, so this message is in English
          whatever language you were reading in.
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            marginTop: '0.5rem',
            padding: '0.5rem 1rem',
            borderRadius: '12px',
            border: 0,
            background: '#1f574d',
            color: '#ffffff',
            fontSize: '0.875rem',
            cursor: 'pointer',
          }}
        >
          Reload
        </button>
        {error.digest === undefined ? null : (
          <p style={{ margin: 0, fontSize: '0.75rem', color: '#888890' }}>
            Reference: {error.digest}
          </p>
        )}
      </body>
    </html>
  );
}
