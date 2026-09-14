'use client';

// Candidate I — grotesk, grid, one flat colour. Step L.1, round three.
//
// **The house style of designed websites**, and it has been for sixty years:
// an enormous neutral sans, a strict grid you can see, black on white, and one
// flat colour that is never shaded. Agencies, galleries, festivals, portfolios.
//
// Nothing here is atmospheric. No shadow, no glow, no rounded corner, no
// gradient — the page is lines and blocks, which is why it cannot be mistaken
// for a template: templates decorate, and this one refuses to.
//
// The risk: it is cold, and it has no obvious place for a score, a streak or a
// reward. Tracks F, G and H put confetti on this game, and confetti has nowhere
// to land here.
import { Beats, Shell } from './shell.js';
import type { Copy } from './copy.js';
import type { Palette, Theme } from './tone.js';

const FACE = '"Helvetica Neue", Helvetica, "Inter", "Arial", system-ui, sans-serif';

export const SWISS: Palette = {
  light: {
    bg: '#F2F2F0',
    surface: '#FFFFFF',
    line: '#111111',
    ink: '#111111',
    muted: '#6E6E6E',
    accent: '#E63312',
    onAccent: '#FFFFFF',
    second: '#111111',
    font: FACE,
  },
  dark: {
    bg: '#111111',
    surface: '#1A1A1A',
    line: '#E8E8E6',
    ink: '#E8E8E6',
    muted: '#9A9A97',
    accent: '#FF4A22',
    onAccent: '#111111',
    second: '#E8E8E6',
    font: FACE,
  },
};

export interface CandidateProps {
  readonly copy: Copy;
  readonly theme: Theme;
  readonly onAdminPage: boolean;
}

export function CandidateSwiss({ copy, theme, onAdminPage }: CandidateProps) {
  const tone = SWISS[theme];

  return (
    <Shell copy={copy} tone={tone} onAdminPage={onAdminPage} menuId="i-menu">
      <main>
        <section className="mx-auto max-w-6xl px-6 py-16 sm:px-10 sm:py-20">
          <h1 className="m-0 text-[clamp(3rem,15vw,9rem)] leading-[0.85] font-bold tracking-[-0.05em] uppercase">
            {copy.question}
          </h1>

          {/* The grid, made visible: a rule and two columns, one of which is
              deliberately empty on a wide screen. */}
          <div
            style={{ borderColor: tone.line }}
            className="mt-12 grid gap-8 border-t pt-8 sm:grid-cols-12"
          >
            <p className="m-0 text-[17px] leading-[1.6] sm:col-span-5">
              {copy.description}
            </p>
            <div className="sm:col-span-4 sm:col-start-9">
              <a
                href="#"
                style={{ background: tone.accent, color: tone.onAccent }}
                className="block w-full px-8 py-5 text-center text-[19px] font-bold tracking-[-0.01em] uppercase"
              >
                {copy.play}
              </a>
              <p style={{ color: tone.muted }} className="mt-3 text-[12.5px]">
                {copy.noAccount}
              </p>
            </div>
          </div>
        </section>

        <Beats copy={copy} tone={tone} />
      </main>
    </Shell>
  );
}
