'use client';

// The frame the three candidates share — step L.1, round two.
//
// **The navigation is deliberately not the variable this round.** Round one
// offered three shapes and the owner commented on none of them; what he
// commented on was the colour and the air. So all three candidates wear the
// same slim bar, and the shape becomes its own question once a direction is
// settled — one decision at a time, which is how he asked for it.
//
// The phone menu is a checkbox and `peer-checked`: it opens with the stylesheet
// alone. A layout that needs JavaScript is unreadable exactly when JavaScript is
// what broke, and this bench learned that the expensive way.
import type { ReactNode } from 'react';

import type { Copy } from './copy.js';
import type { Tone } from './tone.js';

export interface ShellProps {
  readonly copy: Copy;
  readonly tone: Tone;
  readonly onAdminPage: boolean;
  /** Unique per candidate: two checkboxes cannot share an id on one page. */
  readonly menuId: string;
  readonly children: ReactNode;
}

export function Shell({ copy, tone, onAdminPage, menuId, children }: ShellProps) {
  return (
    <div style={{ background: tone.bg, color: tone.ink }} className="min-h-full">
      <header
        style={{ borderColor: tone.line }}
        className="flex items-center gap-4 border-b px-5 py-4 sm:px-10"
      >
        <span className="shrink-0 text-[17px] font-semibold tracking-[-0.01em]">
          {copy.brand}
        </span>

        {onAdminPage ? (
          <a
            href="#"
            style={{ color: tone.accent }}
            className="ml-auto text-[14px] font-medium"
          >
            ← {copy.backToGame}
          </a>
        ) : (
          <>
            <nav
              aria-label={copy.menu}
              className="ml-auto hidden items-center gap-8 md:flex"
            >
              {copy.entries.map((entry) => (
                <a
                  key={entry.route}
                  href="#"
                  style={{ color: tone.muted }}
                  className="text-[14px] whitespace-nowrap"
                >
                  {entry.label}
                </a>
              ))}
            </nav>

            <input id={menuId} type="checkbox" className="peer sr-only md:hidden" />
            <label
              htmlFor={menuId}
              style={{ borderColor: tone.line }}
              className="ml-auto cursor-pointer rounded-full border px-4 py-1.5 text-[14px] md:hidden"
            >
              {copy.menu}
            </label>
            <div
              style={{ background: tone.bg }}
              className="fixed inset-0 z-20 hidden flex-col gap-1 px-6 pt-24 peer-checked:flex md:hidden"
            >
              <label
                htmlFor={menuId}
                style={{ color: tone.muted }}
                className="absolute top-6 right-6 cursor-pointer text-[14px]"
              >
                {copy.close}
              </label>
              {copy.entries.map((entry) => (
                <a
                  key={entry.route}
                  href="#"
                  style={{ borderColor: tone.line }}
                  className="border-b py-4 text-[24px] font-medium"
                >
                  {entry.label}
                </a>
              ))}
            </div>
          </>
        )}
      </header>

      {onAdminPage ? (
        <main className="px-5 py-10 sm:px-10">
          <h1 className="m-0 text-[26px] font-semibold">{copy.adminTitle}</h1>
        </main>
      ) : (
        children
      )}
    </div>
  );
}

/** The three beats, in the airy rhythm all three candidates now share. */
export function Beats({ copy, tone }: { readonly copy: Copy; readonly tone: Tone }) {
  return (
    <section className="mx-auto max-w-5xl px-5 pb-24 sm:px-10">
      <ol className="m-0 grid list-none gap-10 p-0 sm:grid-cols-3 sm:gap-8">
        {copy.beats.map((beat, at) => (
          <li key={beat.title}>
            <span
              style={{ color: tone.accent }}
              className="font-mono text-[12px] tracking-[0.14em]"
            >
              {String(at + 1).padStart(2, '0')}
            </span>
            <h2 className="mt-3 mb-2.5 text-[16px] leading-snug font-semibold">
              {beat.title}
            </h2>
            <p style={{ color: tone.muted }} className="m-0 text-[14px] leading-[1.75]">
              {beat.body}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
