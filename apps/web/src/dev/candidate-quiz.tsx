'use client';

// Candidate G — the quiz genre. Step L.1, round three.
//
// **The most established shape on this list, and the one nobody calls
// generated.** Duolingo, Kahoot, Quizlet: chunky buttons with a solid bottom
// edge that disappears when pressed, high contrast, one confident green, and
// type large enough to read at arm's length. It is a genre with a decade of
// mobile evidence behind it.
//
// No gradient, no glow, no shadow that pretends to be light. The depth is a
// hard edge, which is a physical idea rather than an atmospheric one.
//
// The risk: it reads as *for children*. This game is about catching a liar in
// an encyclopaedia, and the genre's manners may be too eager for that.
import { Beats, Shell } from './shell.js';
import type { Copy } from './copy.js';
import type { Palette, Theme } from './tone.js';

const FACE = '"Nunito", "Trebuchet MS", "Segoe UI", system-ui, sans-serif';

export const QUIZ: Palette = {
  light: {
    bg: '#FFFFFF',
    surface: '#F7F9FA',
    line: '#E5E5E5',
    ink: '#3C3C3C',
    muted: '#777777',
    accent: '#58CC02',
    onAccent: '#FFFFFF',
    second: '#1CB0F6',
    font: FACE,
  },
  dark: {
    bg: '#131F24',
    surface: '#1B2B32',
    line: '#2B4048',
    ink: '#F1F7FB',
    muted: '#8FA5AE',
    accent: '#58CC02',
    onAccent: '#0F1A1E',
    second: '#1CB0F6',
    font: FACE,
  },
};

export interface CandidateProps {
  readonly copy: Copy;
  readonly theme: Theme;
  readonly onAdminPage: boolean;
}

export function CandidateQuiz({ copy, theme, onAdminPage }: CandidateProps) {
  const tone = QUIZ[theme];

  return (
    <Shell copy={copy} tone={tone} onAdminPage={onAdminPage} menuId="g-menu">
      <main>
        <section className="mx-auto max-w-2xl px-6 py-20 text-center sm:py-28">
          <h1 className="m-0 text-[clamp(2.25rem,9vw,3.75rem)] leading-[1.1] font-extrabold tracking-[-0.02em]">
            {copy.question}
          </h1>
          <p
            style={{ color: tone.muted }}
            className="mx-auto mt-6 max-w-md text-[16px] leading-[1.6] font-medium"
          >
            {copy.description}
          </p>

          {/* The genre's one idea: a solid bottom edge instead of a shadow.
              Depth you could press, not light you cannot locate. */}
          <a
            href="#"
            style={{
              background: tone.accent,
              color: tone.onAccent,
              borderBottom: '4px solid #46A302',
            }}
            className="mt-10 block w-full rounded-2xl px-8 py-4 text-[17px] font-extrabold tracking-[0.04em] uppercase sm:mx-auto sm:w-80"
          >
            {copy.play}
          </a>
          <p style={{ color: tone.muted }} className="mt-5 text-[13px] font-medium">
            {copy.noAccount}
          </p>
        </section>

        <Beats copy={copy} tone={tone} />
      </main>
    </Shell>
  );
}
