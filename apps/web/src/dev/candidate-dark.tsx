'use client';

// Candidate A — dark, dense, technical. Step L.1.
//
// The bet: the register of tools people keep open all day. Information legible
// at a glance, one accent and nothing else coloured, and a navigation that is
// always there because it costs almost no height.
//
// The risk, stated so the comparison is not rigged: a game that looks like a
// dashboard. If the owner wants play, this is the candidate that fails.
//
// **The narrow layout is CSS.** The bar scrolls sideways rather than collapsing
// into a button, because a dense bar that hides itself is no longer dense — and
// because a layout that needs JavaScript is unreadable exactly when JavaScript
// is what broke.
import type { Copy } from './copy.js';

const T = {
  bg: '#0B0D10',
  surface: '#14171C',
  line: '#23272E',
  ink: '#E6E8EB',
  muted: '#8B939E',
  accent: '#5B8DEF',
  onAccent: '#06080B',
};

export interface CandidateProps {
  readonly copy: Copy;
  readonly onAdminPage: boolean;
}

export function CandidateDark({ copy, onAdminPage }: CandidateProps) {
  return (
    <div style={{ background: T.bg, color: T.ink }} className="min-h-full font-sans">
      <header
        style={{ background: T.surface, borderColor: T.line }}
        className="sticky top-0 z-10 flex items-center gap-4 border-b px-4 py-2.5"
      >
        <span
          className="shrink-0 font-mono text-[13px] font-semibold tracking-[0.14em]"
          style={{ color: T.ink }}
        >
          {copy.brand.toUpperCase()}
        </span>

        {onAdminPage ? (
          <a
            href="#"
            style={{ borderColor: T.line, color: T.muted }}
            className="ml-auto shrink-0 rounded border px-2.5 py-1 text-[12.5px]"
          >
            ← {copy.backToGame}
          </a>
        ) : (
          <nav
            aria-label={copy.menu}
            className="-mx-1 flex min-w-0 flex-1 items-center gap-1 overflow-x-auto px-1"
          >
            {copy.entries.map((entry) => (
              <a
                key={entry.route}
                href="#"
                style={{ color: T.muted }}
                className="shrink-0 rounded px-2.5 py-1.5 text-[13px] whitespace-nowrap hover:bg-[#1B1F26]"
              >
                {entry.label}
              </a>
            ))}
          </nav>
        )}
      </header>

      {onAdminPage ? (
        <main className="px-4 py-6">
          <h1 className="m-0 text-xl font-semibold">{copy.adminTitle}</h1>
        </main>
      ) : (
        <main className="px-4 py-10 sm:px-6 sm:py-16">
          <section className="mx-auto max-w-3xl">
            <h1 className="m-0 text-[clamp(2.5rem,9vw,4.5rem)] leading-[0.95] font-semibold tracking-[-0.03em]">
              {copy.question}
            </h1>
            <p
              style={{ color: T.muted }}
              className="mt-5 max-w-xl text-[15px] leading-relaxed"
            >
              {copy.description}
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <a
                href="#"
                style={{ background: T.accent, color: T.onAccent }}
                className="rounded px-5 py-2.5 text-[15px] font-semibold"
              >
                {copy.play}
              </a>
              <span style={{ color: T.muted }} className="text-[12.5px]">
                {copy.noAccount}
              </span>
            </div>
          </section>

          <section
            className="mx-auto mt-14 grid max-w-5xl gap-px sm:grid-cols-3"
            style={{ background: T.line }}
          >
            {copy.beats.map((beat, at) => (
              <article key={beat.title} style={{ background: T.bg }} className="p-5">
                <span
                  className="font-mono text-[11px] tracking-[0.14em]"
                  style={{ color: T.accent }}
                >
                  {String(at + 1).padStart(2, '0')}
                </span>
                <h2 className="mt-3 mb-2 text-[15px] font-semibold">{beat.title}</h2>
                <p style={{ color: T.muted }} className="m-0 text-[13px] leading-relaxed">
                  {beat.body}
                </p>
              </article>
            ))}
          </section>
        </main>
      )}
    </div>
  );
}
