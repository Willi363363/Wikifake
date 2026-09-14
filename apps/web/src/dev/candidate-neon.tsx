'use client';

// Candidate D — electric violet, and the deepest dark of the three. Step L.1.
//
// The bet: the owner liked the dark and asked for vivid colour, so this takes
// both at full strength. One violet, one cyan used once, and a play button that
// is the brightest object on the page by a wide margin.
//
// The risk: violet-on-near-black is the palette every launch page has worn since
// 2023. It reads as *current* and it may read as *anonymous* — which is the
// exact complaint that started this track.
import { Beats, Shell } from './shell.js';
import type { Copy } from './copy.js';
import type { Palette, Theme } from './tone.js';

export const NEON: Palette = {
  dark: {
    bg: '#08080C',
    surface: '#111119',
    line: '#232333',
    ink: '#ECECF5',
    muted: '#8E8EA8',
    accent: '#7C5CFF',
    onAccent: '#0A0612',
    second: '#00E5C0',
  },
  light: {
    bg: '#FAFAFF',
    surface: '#FFFFFF',
    line: '#E6E6F2',
    ink: '#13131C',
    muted: '#6B6B85',
    accent: '#5B3DF5',
    onAccent: '#FFFFFF',
    second: '#00A98C',
  },
};

export interface CandidateProps {
  readonly copy: Copy;
  readonly theme: Theme;
  readonly onAdminPage: boolean;
}

export function CandidateNeon({ copy, theme, onAdminPage }: CandidateProps) {
  const tone = NEON[theme];

  return (
    <Shell copy={copy} tone={tone} onAdminPage={onAdminPage} menuId="d-menu">
      <main>
        <section className="mx-auto max-w-3xl px-5 py-24 text-center sm:px-10 sm:py-32">
          <p
            style={{ color: tone.second }}
            className="m-0 mb-6 font-mono text-[12px] tracking-[0.2em] uppercase"
          >
            {copy.brand}
          </p>
          <h1 className="m-0 text-[clamp(3rem,12vw,6rem)] leading-[0.95] font-semibold tracking-[-0.04em]">
            {copy.question}
          </h1>
          <p
            style={{ color: tone.muted }}
            className="mx-auto mt-8 max-w-xl text-[16px] leading-[1.7]"
          >
            {copy.description}
          </p>

          {/* The brightest object on the page, centred, and given room on every
              side — the owner asked for an element that catches the eye. */}
          <a
            href="#"
            style={{
              background: tone.accent,
              color: tone.onAccent,
              boxShadow: `0 0 0 1px ${tone.accent}, 0 18px 50px -12px ${tone.accent}`,
            }}
            className="mt-12 inline-block rounded-full px-14 py-5 text-[19px] font-semibold"
          >
            {copy.play}
          </a>
          <p style={{ color: tone.muted }} className="mt-6 text-[13px]">
            {copy.noAccount}
          </p>
        </section>

        <Beats copy={copy} tone={tone} />
      </main>
    </Shell>
  );
}
