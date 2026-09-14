'use client';

// Candidate H — the encyclopaedia, borrowed on purpose. Step L.1, round three.
//
// **The one direction that could only belong to this game.** The subject is a
// Wikipedia article, so the site wears the manners of one: a serif for reading,
// a content column rather than a hero, the link blue everyone on the web already
// knows, and a thin rule under the title. Then exactly one modern object — the
// play button — which is the joke and the invitation at once.
//
// It is also the least copyable brief on the list. Nobody looks at a serif
// column with a blue link and says a model produced it, because models produce
// the opposite of this.
//
// The risk: it reads as *a document*, and a document is not obviously a game.
// The play button is carrying the whole promise of fun on its own.
import { Beats, Shell } from './shell.js';
import type { Copy } from './copy.js';
import type { Palette, Theme } from './tone.js';

const FACE = 'Georgia, "Iowan Old Style", "Times New Roman", serif';

export const ENCYCLOPEDIA: Palette = {
  light: {
    bg: '#FFFFFF',
    surface: '#F8F9FA',
    line: '#A2A9B1',
    ink: '#202122',
    muted: '#54595D',
    accent: '#3366CC',
    onAccent: '#FFFFFF',
    second: '#B32424',
    font: FACE,
  },
  dark: {
    bg: '#101418',
    surface: '#171F24',
    line: '#38424B',
    ink: '#EAECF0',
    muted: '#A2A9B1',
    accent: '#6699FF',
    onAccent: '#0B0F13',
    second: '#FF6E6E',
    font: FACE,
  },
};

export interface CandidateProps {
  readonly copy: Copy;
  readonly theme: Theme;
  readonly onAdminPage: boolean;
}

export function CandidateEncyclopedia({ copy, theme, onAdminPage }: CandidateProps) {
  const tone = ENCYCLOPEDIA[theme];

  return (
    <Shell copy={copy} tone={tone} onAdminPage={onAdminPage} menuId="h-menu">
      <main>
        <section className="mx-auto max-w-3xl px-6 py-16 sm:py-24">
          {/* A title with a rule under it, which is what an article looks
              like. Left-aligned, because a column is read and not scanned. */}
          <h1 className="m-0 text-[clamp(2.5rem,8vw,4rem)] leading-[1.08] font-normal">
            {copy.question}
          </h1>
          <hr style={{ borderColor: tone.line }} className="mt-4 mb-8 border-t" />

          <p className="m-0 max-w-2xl text-[18px] leading-[1.75]">{copy.description}</p>

          {/* The one object that does not belong to a document. */}
          <div className="mt-12 flex flex-wrap items-center gap-5">
            <a
              href="#"
              style={{ background: tone.accent, color: tone.onAccent }}
              className="rounded px-9 py-3.5 text-[17px] font-sans font-semibold"
            >
              {copy.play}
            </a>
            <span style={{ color: tone.muted }} className="text-[14px]">
              {copy.noAccount}
            </span>
          </div>
        </section>

        <Beats copy={copy} tone={tone} />
      </main>
    </Shell>
  );
}
