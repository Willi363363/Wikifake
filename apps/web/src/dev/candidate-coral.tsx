'use client';

// Candidate E — warm coral, and the most air of the three. Step L.1.
//
// The bet: vivid does not have to mean electric. A single hot orange on a warm
// ground, enormous margins, and a headline given a whole screen to itself. The
// play button is a wide block rather than a pill — it reads as a door.
//
// The risk: warmth reads as *friendly*, and this game is about catching a liar.
// If the owner wants edge, this is the candidate that softens it away.
import { Beats, Shell } from './shell.js';
import type { Copy } from './copy.js';
import type { Palette, Theme } from './tone.js';

export const CORAL: Palette = {
  dark: {
    bg: '#141010',
    surface: '#1E1717',
    line: '#332626',
    ink: '#F6EEEA',
    muted: '#A8938C',
    accent: '#FF5A36',
    onAccent: '#1A0A05',
    second: '#FFC93C',
  },
  light: {
    bg: '#FFF8F4',
    surface: '#FFFFFF',
    line: '#F0DFD6',
    ink: '#1A1210',
    muted: '#7A6258',
    accent: '#E8340C',
    onAccent: '#FFF8F4',
    second: '#B87400',
  },
};

export interface CandidateProps {
  readonly copy: Copy;
  readonly theme: Theme;
  readonly onAdminPage: boolean;
}

export function CandidateCoral({ copy, theme, onAdminPage }: CandidateProps) {
  const tone = CORAL[theme];

  return (
    <Shell copy={copy} tone={tone} onAdminPage={onAdminPage} menuId="e-menu">
      <main>
        <section className="mx-auto flex min-h-[78vh] max-w-4xl flex-col items-center justify-center px-5 py-24 text-center sm:px-10">
          <h1 className="m-0 text-[clamp(3.25rem,14vw,7rem)] leading-[0.9] font-medium tracking-[-0.045em]">
            {copy.question}
          </h1>
          <p
            style={{ color: tone.muted }}
            className="mx-auto mt-10 max-w-xl text-[17px] leading-[1.75]"
          >
            {copy.description}
          </p>

          {/* A wide block rather than a pill: it should read as a door, not as
              a control. Full width on a phone, where a thumb is the pointer. */}
          <a
            href="#"
            style={{ background: tone.accent, color: tone.onAccent }}
            className="mt-14 w-full max-w-sm rounded-2xl px-10 py-6 text-[22px] font-semibold"
          >
            {copy.play}
          </a>
          <p style={{ color: tone.muted }} className="mt-7 text-[13px]">
            {copy.noAccount}
          </p>
        </section>

        <Beats copy={copy} tone={tone} />
      </main>
    </Shell>
  );
}
