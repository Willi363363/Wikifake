'use client';

// The round, three arrangements — step L.1, round eleven.
//
// **The one screen where the direction has to get out of the way.** Track A's
// exemption survives every repaint: the chassis is loud, the article is not.
// `ReadingSheet` enforces it by construction — it takes no prop for a border, a
// fill, a shadow or a tone — and these mockups honour the same rule by hand,
// because a bench that broke it would be proposing something the component
// refuses to build.
//
// The reason is not taste. The task is to spot a factual anomaly in prose, and
// every unit of visual noise around that prose is noise the player must filter
// before doing the thing the game is for.
//
// **So what varies is never the paragraph.** It is where the clock and the
// submit live, and how a marked paragraph is shown — which is the one place
// this screen is allowed to be loud, because marking is an act and not a text.
import { Shell } from './shell.js';
import type { Copy } from './copy.js';
import { ROUND, type Paragraph } from './sample.js';
import { J2 } from './variants.js';
import type { Theme, Tone } from './tone.js';

export interface RoundProps {
  readonly copy: Copy;
  readonly theme: Theme;
  readonly onAdminPage: boolean;
}

const marked = ROUND.paragraphs.filter((one) => one.marked).length;

function clock(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes)}:${String(seconds % 60).padStart(2, '0')}`;
}

/**
 * One paragraph of the article.
 *
 * **The prose never changes colour, weight or size when marked.** What changes
 * is a rule down its left edge and its number turning solid — the mark is
 * beside the text, never on it. A highlighted paragraph is a paragraph somebody
 * stops reading.
 */
function Para({
  para,
  index,
  copy,
  tone,
}: {
  readonly para: Paragraph;
  readonly index: number;
  readonly copy: Copy;
  readonly tone: Tone;
}) {
  return (
    <li className="flex gap-4">
      <span className="flex w-7 shrink-0 flex-col items-center gap-2 pt-1">
        <span
          style={
            para.marked
              ? { background: tone.accent, color: tone.onAccent }
              : { background: tone.bg, color: tone.muted }
          }
          className="flex size-7 items-center justify-center rounded-full text-[12px] font-bold tabular-nums"
        >
          {index + 1}
        </span>
        {/* The rule, beside the prose and never behind it. */}
        <span
          style={{ background: para.marked ? tone.accent : 'transparent' }}
          className="w-0.5 flex-1 rounded-full"
        />
      </span>
      <p className="m-0 pb-6 text-[17px] leading-[1.75]">
        <span className="sr-only">{copy.paragraphNumber(index + 1)}</span>
        {para.text}
      </p>
    </li>
  );
}

function Sheet({ copy, tone }: { readonly copy: Copy; readonly tone: Tone }) {
  return (
    // The one surface with no fill of its own beyond a declared ground, no
    // border, no shadow, no accent. 21:1 in light, 15.5:1 in dark.
    <article
      style={{ background: tone.surface }}
      className="rounded-2xl px-5 py-6 sm:px-8"
    >
      <h1 className="m-0 mb-1 text-[26px] leading-tight font-semibold">{ROUND.topic}</h1>
      <p style={{ color: tone.muted }} className="m-0 mb-6 text-[12.5px]">
        {copy.source} · {copy.modifiedTag}
      </p>
      <ul className="m-0 flex list-none flex-col p-0">
        {ROUND.paragraphs.map((para, at) => (
          <Para key={para.text} para={para} index={at} copy={copy} tone={tone} />
        ))}
      </ul>
      <p
        style={{ color: tone.muted }}
        className="m-0 border-t pt-4 text-[12px] leading-[1.6]"
      >
        {copy.gradesNote}
      </p>
    </article>
  );
}

/** R1 — a bar above, a bar below. Nothing overlaps the prose. */
export function RoundBars({ copy, theme, onAdminPage }: RoundProps) {
  const tone = J2[theme];
  return (
    <Shell copy={copy} tone={tone} onAdminPage={onAdminPage} menuId="r1-menu">
      <div
        style={{ background: tone.surface }}
        className="flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3 sm:px-8"
      >
        <span className="text-[20px] font-bold tabular-nums">
          {clock(ROUND.secondsLeft)}
        </span>
        <span style={{ color: tone.muted }} className="text-[12.5px]">
          {copy.timeLeft}
        </span>
        <span style={{ color: tone.muted }} className="text-[12.5px]">
          {copy.alteredCount(ROUND.altered)}
        </span>
        <span className="ml-auto text-[13px]">
          {marked} {copy.markedLabel}
        </span>
      </div>

      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-8">
        <Sheet copy={copy} tone={tone} />
      </main>

      <div
        style={{ background: tone.surface }}
        className="sticky bottom-0 flex items-center gap-4 px-4 py-3 sm:px-8"
      >
        <span style={{ color: tone.muted }} className="text-[13px]">
          {copy.briefTop} · {copy.intel}
        </span>
        <a
          href="#"
          style={{ background: tone.accent, color: tone.onAccent }}
          className="ml-auto rounded-xl px-7 py-3 text-[15px] font-bold"
        >
          {copy.submit}
        </a>
      </div>
    </Shell>
  );
}

/** R2 — one floating pill, bottom centre. The page is the article. */
export function RoundFloating({ copy, theme, onAdminPage }: RoundProps) {
  const tone = J2[theme];
  return (
    <Shell copy={copy} tone={tone} onAdminPage={onAdminPage} menuId="r2-menu">
      <main className="mx-auto max-w-3xl px-4 py-6 pb-28 sm:px-8">
        <Sheet copy={copy} tone={tone} />
      </main>

      {/* Everything the round needs, in one object that follows the reader.
          It covers a strip of the page, which is the cost of the idea. */}
      <div className="pointer-events-none sticky bottom-5 flex justify-center px-4">
        <div
          style={{ background: tone.accent, color: tone.onAccent }}
          className="pointer-events-auto flex items-center gap-4 rounded-full py-2.5 pr-2.5 pl-6 shadow-lg"
        >
          <span className="text-[19px] font-bold tabular-nums">
            {clock(ROUND.secondsLeft)}
          </span>
          <span className="text-[13px] opacity-90">
            {marked} {copy.markedLabel}
          </span>
          <span
            style={{ background: tone.surface, color: tone.ink }}
            className="rounded-full px-5 py-2 text-[14px] font-bold"
          >
            {copy.submit}
          </span>
        </div>
      </div>
    </Shell>
  );
}

/** R3 — a rail beside the article on a wide screen, a bar below on a phone. */
export function RoundRail({ copy, theme, onAdminPage }: RoundProps) {
  const tone = J2[theme];
  return (
    <Shell copy={copy} tone={tone} onAdminPage={onAdminPage} menuId="r3-menu">
      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-6 pb-24 sm:px-8 lg:grid-cols-[1fr_260px] lg:pb-6">
        <Sheet copy={copy} tone={tone} />

        <aside className="hidden flex-col gap-4 lg:flex">
          <div style={{ background: tone.surface }} className="rounded-2xl p-5">
            <span style={{ color: tone.muted }} className="text-[12px]">
              {copy.timeLeft}
            </span>
            <p className="m-0 mt-1 text-[36px] leading-none font-bold tabular-nums">
              {clock(ROUND.secondsLeft)}
            </p>
            <p style={{ color: tone.muted }} className="m-0 mt-3 text-[12.5px]">
              {copy.alteredCount(ROUND.altered)} · {marked} {copy.markedLabel}
            </p>
          </div>
          <a
            href="#"
            style={{ background: tone.accent, color: tone.onAccent }}
            className="rounded-2xl px-5 py-4 text-center text-[15px] font-bold"
          >
            {copy.submit}
          </a>
          <div
            style={{ background: tone.surface }}
            className="rounded-2xl p-5 text-[13px]"
          >
            <p className="m-0">{copy.briefTop}</p>
            <p style={{ color: tone.muted }} className="m-0 mt-2">
              {copy.intel}
            </p>
          </div>
        </aside>
      </main>

      {/* On a phone the rail has nowhere to be, so it becomes a bar. */}
      <div
        style={{ background: tone.surface }}
        className="sticky bottom-0 flex items-center gap-4 px-4 py-3 lg:hidden"
      >
        <span className="text-[19px] font-bold tabular-nums">
          {clock(ROUND.secondsLeft)}
        </span>
        <span style={{ color: tone.muted }} className="text-[12.5px]">
          {marked} {copy.markedLabel}
        </span>
        <a
          href="#"
          style={{ background: tone.accent, color: tone.onAccent }}
          className="ml-auto rounded-xl px-6 py-2.5 text-[14px] font-bold"
        >
          {copy.submit}
        </a>
      </div>
    </Shell>
  );
}
