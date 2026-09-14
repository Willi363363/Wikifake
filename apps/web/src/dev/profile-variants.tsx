'use client';

// The profile, three arrangements — step L.1, round nine.
//
// The page a player opens to see whether they are getting better. Six figures,
// a history, and — at the bottom of it — the two irreversible things: export
// and erasure.
//
// **Two rules all three obey, and neither is a design preference.**
//
// The address is never shown to anybody else, and the page says so where it
// appears: E.3.3's promise is that an email is on no screen but your own, and
// a profile that printed it without that sentence would look like a leak.
//
// And **deletion is never beside a figure**. It is the one control on this
// page that cannot be undone, so it goes at the end, after everything somebody
// came here to read — never in a toolbar where a thumb can find it first.
import { Shell } from './shell.js';
import type { Copy } from './copy.js';
import { SAMPLE } from './sample.js';
import { J2 } from './variants.js';
import type { Theme, Tone } from './tone.js';

export interface ProfileProps {
  readonly copy: Copy;
  readonly theme: Theme;
  readonly onAdminPage: boolean;
}

const ME = { name: 'Théodule', email: 'theodule@example.test', since: '4 août 2026' };
const BREAKDOWN = { found: 96, missed: 41, wrong: 18 };

function Figure({
  label,
  value,
  note,
  tone,
  big = false,
}: {
  readonly label: string;
  readonly value: string;
  readonly note?: string;
  readonly tone: Tone;
  readonly big?: boolean;
}) {
  return (
    <div style={{ background: tone.surface }} className="rounded-2xl p-5">
      <span style={{ color: tone.muted }} className="text-[12px]">
        {label}
      </span>
      <p
        className={`m-0 mt-1.5 ${big ? 'text-[38px]' : 'text-[30px]'} leading-none font-bold tabular-nums`}
      >
        {value}
      </p>
      {note === undefined ? null : (
        <p style={{ color: tone.muted }} className="m-0 mt-1.5 text-[12px]">
          {note}
        </p>
      )}
    </div>
  );
}

/** The block nobody should meet before they meant to. */
function Danger({ copy, tone }: { readonly copy: Copy; readonly tone: Tone }) {
  return (
    <section style={{ background: tone.surface }} className="rounded-2xl p-5">
      <h2 className="m-0 text-[15px] font-bold">{copy.dataTitle}</h2>
      <p
        style={{ color: tone.muted }}
        className="m-0 mt-2 max-w-2xl text-[13px] leading-[1.6]"
      >
        {copy.exportLead}
      </p>
      <a
        href="#"
        style={{ color: tone.accent }}
        className="mt-1.5 inline-block text-[13px] font-semibold"
      >
        {copy.exportLink}
      </a>
      <p
        style={{ color: tone.muted }}
        className="m-0 mt-4 max-w-2xl text-[13px] leading-[1.6]"
      >
        {copy.deleteLead}
      </p>
      <a
        href="#"
        style={{ color: tone.second }}
        className="mt-1.5 inline-block text-[13px] font-semibold"
      >
        {copy.deleteStart}
      </a>
    </section>
  );
}

function History({ copy, tone }: { readonly copy: Copy; readonly tone: Tone }) {
  return (
    <section style={{ background: tone.surface }} className="rounded-2xl p-5">
      <h2 className="m-0 mb-3 text-[15px] font-bold">{copy.finished}</h2>
      <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
        {SAMPLE.rounds.map((round) => (
          <li key={round.topic} className="flex items-baseline gap-3 text-[13.5px]">
            <span className="min-w-0 flex-1 truncate">{round.topic}</span>
            <span style={{ color: tone.muted }} className="text-[12px]">
              {round.found}/{round.total}
            </span>
            <span className="w-11 text-right font-semibold tabular-nums">
              {round.score}%
            </span>
            <span style={{ color: tone.muted }} className="w-8 text-right text-[12px]">
              {round.when}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** P1 — the six figures first, then the history, then the data. */
export function ProfileFigures({ copy, theme, onAdminPage }: ProfileProps) {
  const tone = J2[theme];
  return (
    <Shell copy={copy} tone={tone} onAdminPage={onAdminPage} menuId="p1-menu">
      <main className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-5 sm:px-8 sm:py-8">
        <div
          style={{ background: tone.accent, color: tone.onAccent }}
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl px-5 py-4"
        >
          <span className="text-[22px] leading-none font-bold">{ME.name}</span>
          <span className="text-[12.5px] opacity-90">{copy.since(ME.since)}</span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Figure
            tone={tone}
            label={copy.finished}
            value={String(SAMPLE.gamesFinished)}
          />
          <Figure
            tone={tone}
            label={copy.average}
            value={`${String(SAMPLE.averageScore)}%`}
          />
          <Figure tone={tone} label={copy.best} value={`${String(SAMPLE.bestScore)}%`} />
          <Figure
            tone={tone}
            label={copy.streak}
            value={String(SAMPLE.streak)}
            note={copy.onAStreak(SAMPLE.streak)}
          />
          <div className="sm:col-span-2 lg:col-span-2">
            <Figure
              tone={tone}
              label={copy.accuracy}
              value={`${String(BREAKDOWN.found)}`}
              note={copy.breakdown(BREAKDOWN.found, BREAKDOWN.missed, BREAKDOWN.wrong)}
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-2">
            <Figure tone={tone} label={copy.abandoned} value="3" />
          </div>
        </div>

        <History copy={copy} tone={tone} />
        <p style={{ color: tone.muted }} className="m-0 text-[12.5px]">
          {copy.emailPrivate(ME.email)}
        </p>
        <Danger copy={copy} tone={tone} />
      </main>
    </Shell>
  );
}

/** P2 — one figure leads, the rest are a strip. */
export function ProfileHeadline({ copy, theme, onAdminPage }: ProfileProps) {
  const tone = J2[theme];
  return (
    <Shell copy={copy} tone={tone} onAdminPage={onAdminPage} menuId="p2-menu">
      <main className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-5 sm:px-8 sm:py-8">
        <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          {/* Accuracy leads, because it is the only figure that says whether
              somebody is getting better. Rounds played says they kept playing. */}
          <section
            style={{ background: tone.accent, color: tone.onAccent }}
            className="flex flex-col justify-between gap-4 rounded-2xl p-6"
          >
            <span className="text-[13px] font-semibold opacity-90">{ME.name}</span>
            <div>
              <p className="m-0 text-[64px] leading-none font-bold tabular-nums">
                {SAMPLE.averageScore}%
              </p>
              <p className="m-0 mt-2 text-[13.5px] opacity-90">{copy.average}</p>
            </div>
            <span className="text-[12px] opacity-85">{copy.since(ME.since)}</span>
          </section>

          <div className="grid grid-cols-2 gap-4">
            <Figure
              tone={tone}
              label={copy.finished}
              value={String(SAMPLE.gamesFinished)}
            />
            <Figure
              tone={tone}
              label={copy.best}
              value={`${String(SAMPLE.bestScore)}%`}
            />
            <Figure tone={tone} label={copy.streak} value={String(SAMPLE.streak)} />
            <Figure tone={tone} label={copy.abandoned} value="3" />
          </div>
        </div>

        <section style={{ background: tone.surface }} className="rounded-2xl p-5">
          <h2 className="m-0 text-[15px] font-bold">{copy.accuracy}</h2>
          <p className="m-0 mt-2 text-[13.5px]">
            {copy.breakdown(BREAKDOWN.found, BREAKDOWN.missed, BREAKDOWN.wrong)}
          </p>
        </section>

        <History copy={copy} tone={tone} />
        <p style={{ color: tone.muted }} className="m-0 text-[12.5px]">
          {copy.emailPrivate(ME.email)}
        </p>
        <Danger copy={copy} tone={tone} />
      </main>
    </Shell>
  );
}

/** P3 — history first, figures as a rail beside it. */
export function ProfileHistory({ copy, theme, onAdminPage }: ProfileProps) {
  const tone = J2[theme];
  return (
    <Shell copy={copy} tone={tone} onAdminPage={onAdminPage} menuId="p3-menu">
      <main className="mx-auto grid max-w-6xl gap-4 px-4 py-5 sm:px-8 sm:py-8 lg:grid-cols-[1.5fr_1fr]">
        <div className="flex flex-col gap-4">
          <div
            style={{ background: tone.accent, color: tone.onAccent }}
            className="flex flex-wrap items-baseline justify-between gap-3 rounded-2xl px-5 py-4"
          >
            <span className="text-[22px] leading-none font-bold">{ME.name}</span>
            <span className="text-[12.5px] opacity-90">{copy.since(ME.since)}</span>
          </div>
          <History copy={copy} tone={tone} />
          <Danger copy={copy} tone={tone} />
        </div>

        <aside className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <Figure
              tone={tone}
              label={copy.finished}
              value={String(SAMPLE.gamesFinished)}
            />
            <Figure
              tone={tone}
              label={copy.average}
              value={`${String(SAMPLE.averageScore)}%`}
            />
            <Figure
              tone={tone}
              label={copy.best}
              value={`${String(SAMPLE.bestScore)}%`}
            />
            <Figure tone={tone} label={copy.streak} value={String(SAMPLE.streak)} />
          </div>
          <section style={{ background: tone.surface }} className="rounded-2xl p-5">
            <h2 className="m-0 text-[14px] font-bold">{copy.accuracy}</h2>
            <p
              style={{ color: tone.muted }}
              className="m-0 mt-2 text-[13px] leading-[1.6]"
            >
              {copy.breakdown(BREAKDOWN.found, BREAKDOWN.missed, BREAKDOWN.wrong)}
            </p>
          </section>
          <p style={{ color: tone.muted }} className="m-0 text-[12.5px]">
            {copy.emailPrivate(ME.email)}
          </p>
        </aside>
      </main>
    </Shell>
  );
}
