'use client';

// Candidate C — sober, near-neutral. Step L.1.
//
// The bet: the interface disappears behind the content. Greys, one blue kept
// for actions and nothing else, no decoration — everything is spacing.
//
// The risk, and it is the honest one: forgettable. "Clean" is the easiest thing
// to agree to and the easiest to forget, and a game people are meant to come
// back to may want a face.
//
// **Its navigation is the third shape**: one dropdown holding everything, built
// on `<details>`, which opens with no JavaScript and closes on its own when the
// page changes.
import type { Copy } from './copy.js';

const T = {
  bg: '#FFFFFF',
  ink: '#0A0A0A',
  muted: '#737373',
  line: '#E5E5E5',
  wash: '#FAFAFA',
  accent: '#2563EB',
  onAccent: '#FFFFFF',
};

export interface CandidateProps {
  readonly copy: Copy;
  readonly onAdminPage: boolean;
}

export function CandidateSober({ copy, onAdminPage }: CandidateProps) {
  return (
    <div style={{ background: T.bg, color: T.ink }} className="min-h-full font-sans">
      <header
        style={{ borderColor: T.line }}
        className="flex items-center gap-4 border-b px-4 py-3 sm:px-6"
      >
        <span className="shrink-0 text-[15px] font-medium">{copy.brand}</span>

        {onAdminPage ? (
          <a href="#" style={{ color: T.muted }} className="ml-auto text-[14px]">
            ← {copy.backToGame}
          </a>
        ) : (
          <details className="relative ml-auto">
            <summary
              style={{ borderColor: T.line }}
              className="flex cursor-pointer list-none items-center gap-2 rounded-md border px-3 py-1.5 text-[14px]"
            >
              {copy.menu}
              <span style={{ color: T.muted }} aria-hidden>
                ▾
              </span>
            </summary>
            {/* Anchored right so it never leaves the screen on a phone. */}
            <nav
              aria-label={copy.menu}
              style={{ background: T.bg, borderColor: T.line }}
              className="absolute right-0 z-20 mt-2 flex w-56 flex-col rounded-md border py-1 shadow-lg"
            >
              {copy.entries.map((entry) => (
                <a
                  key={entry.route}
                  href="#"
                  className="px-4 py-2.5 text-[14px] hover:bg-[#F5F5F5]"
                >
                  {entry.label}
                </a>
              ))}
            </nav>
          </details>
        )}
      </header>

      {onAdminPage ? (
        <main className="px-4 py-8 sm:px-6">
          <h1 className="m-0 text-[24px] font-medium">{copy.adminTitle}</h1>
        </main>
      ) : (
        <main className="px-4 sm:px-6">
          <section className="mx-auto max-w-2xl py-16 sm:py-24">
            <h1 className="m-0 text-[clamp(2.25rem,8vw,3.5rem)] leading-[1.05] font-medium tracking-[-0.025em]">
              {copy.question}
            </h1>
            <p
              style={{ color: T.muted }}
              className="mt-5 max-w-xl text-[15px] leading-[1.7]"
            >
              {copy.description}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <a
                href="#"
                style={{ background: T.accent, color: T.onAccent }}
                className="rounded-md px-5 py-2.5 text-[15px] font-medium"
              >
                {copy.play}
              </a>
              <span style={{ color: T.muted }} className="text-[13px]">
                {copy.noAccount}
              </span>
            </div>
          </section>

          <section className="mx-auto max-w-3xl pb-16">
            <div className="grid gap-3 sm:grid-cols-3">
              {copy.beats.map((beat) => (
                <article
                  key={beat.title}
                  style={{ background: T.wash, borderColor: T.line }}
                  className="rounded-lg border p-5"
                >
                  <h2 className="mt-0 mb-2 text-[14px] font-medium">{beat.title}</h2>
                  <p style={{ color: T.muted }} className="m-0 text-[13px] leading-[1.7]">
                    {beat.body}
                  </p>
                </article>
              ))}
            </div>
          </section>
        </main>
      )}
    </div>
  );
}
