'use client';

// Candidate B — light, spacious, editorial. Step L.1.
//
// The bet: the subject of this game is an article, so the site should read like
// something you read. Typography carries the hierarchy, one warm accent marks
// the single action, and the page breathes.
//
// The risk: empty at phone width, where most players are. The mockup is
// deliberately checked there first.
//
// **The narrow menu is a checkbox, not state.** A hidden input and `peer-*`
// open the full-screen menu with no JavaScript at all, which is the lesson the
// last lab paid for: a layout that needs JavaScript is unreadable exactly when
// JavaScript is what broke.
import type { Copy } from './copy.js';

const T = {
  bg: '#FBFBF9',
  ink: '#16161A',
  muted: '#6B6B73',
  line: '#E5E4DF',
  accent: '#C2410C',
  onAccent: '#FFF8F4',
};

export interface CandidateProps {
  readonly copy: Copy;
  readonly onAdminPage: boolean;
}

export function CandidateEditorial({ copy, onAdminPage }: CandidateProps) {
  return (
    <div style={{ background: T.bg, color: T.ink }} className="min-h-full font-sans">
      <header
        style={{ borderColor: T.line }}
        className="flex items-center gap-4 border-b px-5 py-4 sm:px-8"
      >
        <span className="shrink-0 text-[19px] font-medium tracking-[-0.01em]">
          {copy.brand}
        </span>

        {onAdminPage ? (
          <a
            href="#"
            style={{ color: T.accent }}
            className="ml-auto text-[14px] underline underline-offset-4"
          >
            ← {copy.backToGame}
          </a>
        ) : (
          <>
            <nav
              aria-label={copy.menu}
              className="ml-auto hidden items-center gap-7 sm:flex"
            >
              {copy.entries.map((entry) => (
                <a
                  key={entry.route}
                  href="#"
                  style={{ color: T.muted }}
                  className="text-[14px] whitespace-nowrap"
                >
                  {entry.label}
                </a>
              ))}
            </nav>

            {/* The phone menu. A checkbox and `peer-checked`, so it opens with
                the stylesheet alone. */}
            <input id="b-menu" type="checkbox" className="peer sr-only sm:hidden" />
            <label
              htmlFor="b-menu"
              style={{ borderColor: T.line }}
              className="ml-auto cursor-pointer rounded-full border px-4 py-1.5 text-[14px] sm:hidden"
            >
              {copy.menu}
            </label>
            <div
              style={{ background: T.bg }}
              className="fixed inset-0 z-20 hidden flex-col gap-1 px-5 pt-24 peer-checked:flex sm:hidden"
            >
              <label
                htmlFor="b-menu"
                style={{ color: T.muted }}
                className="absolute top-5 right-5 cursor-pointer text-[14px]"
              >
                {copy.close}
              </label>
              {copy.entries.map((entry) => (
                <a
                  key={entry.route}
                  href="#"
                  style={{ borderColor: T.line }}
                  className="border-b py-4 text-[22px]"
                >
                  {entry.label}
                </a>
              ))}
            </div>
          </>
        )}
      </header>

      {onAdminPage ? (
        <main className="px-5 py-10 sm:px-8">
          <h1 className="m-0 text-[28px] font-medium">{copy.adminTitle}</h1>
        </main>
      ) : (
        <main className="px-5 sm:px-8">
          <section className="mx-auto max-w-2xl py-16 text-center sm:py-28">
            <h1 className="m-0 text-[clamp(2.75rem,11vw,5rem)] leading-[1.02] font-medium tracking-[-0.03em]">
              {copy.question}
            </h1>
            <p
              style={{ color: T.muted }}
              className="mx-auto mt-7 max-w-lg text-[16px] leading-[1.7]"
            >
              {copy.description}
            </p>
            <a
              href="#"
              // `text-white` is refused by `fills.test.ts`, and rightly: a
              // literal colour is a pair nobody measured. The value is on the
              // palette instead, where L.2 will have to measure it.
              style={{ background: T.accent, color: T.onAccent }}
              className="mt-9 inline-block rounded-full px-8 py-3 text-[16px]"
            >
              {copy.play}
            </a>
            <p style={{ color: T.muted }} className="mt-5 text-[13px]">
              {copy.noAccount}
            </p>
          </section>

          <section
            style={{ borderColor: T.line }}
            className="mx-auto max-w-4xl border-t py-14"
          >
            <ol className="m-0 grid list-none gap-12 p-0 sm:grid-cols-3 sm:gap-8">
              {copy.beats.map((beat, at) => (
                <li key={beat.title}>
                  <span style={{ color: T.accent }} className="text-[13px]">
                    {at + 1}
                  </span>
                  <h2 className="mt-2 mb-3 text-[17px] leading-snug font-medium">
                    {beat.title}
                  </h2>
                  <p
                    style={{ color: T.muted }}
                    className="m-0 text-[14px] leading-[1.75]"
                  >
                    {beat.body}
                  </p>
                </li>
              ))}
            </ol>
          </section>
        </main>
      )}
    </div>
  );
}
