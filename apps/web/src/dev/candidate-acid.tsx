'use client';

// Candidate F — acid lime on near-black, the most graphic of the three. Step L.1.
//
// The bet: one colour so loud it can only be used once, and everything else
// reduced to black, white and one grey. The play button is not decorated — it
// is a slab of the colour, and it is the only coloured thing on the screen.
//
// The risk: the accent is unusable for anything else. A second state — a
// warning, a score, a timer — has nowhere to go, and the palette will have to
// grow a colour it was defined as not having.
import { Beats, Shell } from './shell.js';
import type { Copy } from './copy.js';
import type { Palette, Theme } from './tone.js';

export const ACID: Palette = {
  dark: {
    bg: '#0C0D0A',
    surface: '#15170F',
    line: '#262A1C',
    ink: '#F2F4EC',
    muted: '#949A85',
    accent: '#C6F24E',
    onAccent: '#10140A',
    second: '#7AD0FF',
  },
  light: {
    bg: '#FCFDF8',
    surface: '#FFFFFF',
    line: '#E4E8D8',
    ink: '#0F110B',
    muted: '#61684F',
    accent: '#4F7A0B',
    onAccent: '#FCFDF8',
    second: '#0B5E8A',
  },
};

export interface CandidateProps {
  readonly copy: Copy;
  readonly theme: Theme;
  readonly onAdminPage: boolean;
}

export function CandidateAcid({ copy, theme, onAdminPage }: CandidateProps) {
  const tone = ACID[theme];

  return (
    <Shell copy={copy} tone={tone} onAdminPage={onAdminPage} menuId="f-menu">
      <main>
        <section className="mx-auto max-w-3xl px-5 py-28 text-center sm:px-10 sm:py-36">
          <h1 className="m-0 text-[clamp(3rem,13vw,6.5rem)] leading-[0.88] font-bold tracking-[-0.05em]">
            {copy.question}
          </h1>
          <p
            style={{ color: tone.muted }}
            className="mx-auto mt-9 max-w-lg text-[16px] leading-[1.7]"
          >
            {copy.description}
          </p>

          {/* A slab, square-ish, and the only coloured object on the screen. */}
          <a
            href="#"
            style={{ background: tone.accent, color: tone.onAccent }}
            className="mt-14 inline-block rounded-sm px-16 py-5 text-[20px] font-bold tracking-[-0.01em] uppercase"
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
