'use client';

// The quests, three arrangements — step L.1, round seven.
//
// J2 is settled and S2 confirmed it, so nothing about the surface moves: no
// hairline, flat blue, larger figures, air. What varies is how two lots — a
// day's and a week's — sit beside each other, and how loudly a finished quest
// asks to be collected.
//
// **The state that matters is `ready`.** A quest that is complete and unclaimed
// is the only thing on this page a player must not miss: it is coins sitting
// there. Done-and-collected, in progress, and ready must therefore read as
// three things, not two — which is the mistake every progress list makes.
import { Shell } from './shell.js';
import type { Copy } from './copy.js';
import { QUESTS, type Quest } from './sample.js';
import { J2 } from './variants.js';
import type { Theme, Tone } from './tone.js';

export interface QuestProps {
  readonly copy: Copy;
  readonly theme: Theme;
  readonly onAdminPage: boolean;
}

type State = 'ready' | 'claimed' | 'doing';

function stateOf(quest: Quest): State {
  if (quest.claimed) return 'claimed';
  return quest.done >= quest.target ? 'ready' : 'doing';
}

function Bar({ quest, tone }: { readonly quest: Quest; readonly tone: Tone }) {
  const share = Math.min(1, quest.done / quest.target);
  return (
    <div style={{ background: tone.bg }} className="h-2 overflow-hidden rounded-full">
      <span
        style={{
          background: stateOf(quest) === 'doing' ? tone.muted : tone.accent,
          width: `${String(share * 100)}%`,
        }}
        className="block h-full"
      />
    </div>
  );
}

/** The one line the three arrangements share: what this quest is worth now. */
function Action({
  quest,
  copy,
  tone,
}: {
  readonly quest: Quest;
  readonly copy: Copy;
  readonly tone: Tone;
}) {
  const how = stateOf(quest);
  if (how === 'ready') {
    return (
      <span
        style={{ background: tone.accent, color: tone.onAccent }}
        className="rounded-lg px-3.5 py-2 text-[13px] font-bold whitespace-nowrap"
      >
        {copy.claim} · {copy.reward(quest.reward)}
      </span>
    );
  }
  if (how === 'claimed') {
    return (
      <span style={{ color: tone.muted }} className="text-[12.5px] whitespace-nowrap">
        {copy.claimed}
      </span>
    );
  }
  return (
    <span style={{ color: tone.second }} className="text-[12.5px] whitespace-nowrap">
      {copy.reward(quest.reward)}
    </span>
  );
}

function Line({
  quest,
  copy,
  tone,
}: {
  readonly quest: Quest;
  readonly copy: Copy;
  readonly tone: Tone;
}) {
  return (
    <li className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-[14px] font-medium">
          {copy.rule(quest.rule, quest.target)}
        </span>
        <Action quest={quest} copy={copy} tone={tone} />
      </div>
      <Bar quest={quest} tone={tone} />
      <span style={{ color: tone.muted }} className="text-[12px] tabular-nums">
        {copy.progress(quest.done, quest.target)}
      </span>
    </li>
  );
}

/** Q1 — two columns: today on the left, the week on the right. */
export function QuestsColumns({ copy, theme, onAdminPage }: QuestProps) {
  const tone = J2[theme];
  return (
    <Shell copy={copy} tone={tone} onAdminPage={onAdminPage} menuId="q1-menu">
      <main className="mx-auto max-w-6xl px-4 py-5 sm:px-8 sm:py-8">
        <p
          style={{ color: tone.muted }}
          className="m-0 mb-4 max-w-2xl text-[13.5px] leading-[1.65]"
        >
          {copy.questsLead}
        </p>
        <div className="grid gap-4 lg:grid-cols-2">
          {(
            [
              { label: copy.daily, lot: QUESTS.daily },
              { label: copy.weekly, lot: QUESTS.weekly },
            ] as const
          ).map((group) => (
            <section
              key={group.label}
              style={{ background: tone.surface }}
              className="rounded-2xl p-5"
            >
              <h2 className="m-0 mb-4 text-[15px] font-bold">{group.label}</h2>
              <ul className="m-0 flex list-none flex-col gap-5 p-0">
                {group.lot.map((quest) => (
                  <Line key={quest.rule} quest={quest} copy={copy} tone={tone} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      </main>
    </Shell>
  );
}

/** Q2 — what is collectable first, everything else underneath. */
export function QuestsReady({ copy, theme, onAdminPage }: QuestProps) {
  const tone = J2[theme];
  const all = [...QUESTS.daily, ...QUESTS.weekly];
  const ready = all.filter((quest) => stateOf(quest) === 'ready');
  const rest = all.filter((quest) => stateOf(quest) !== 'ready');
  return (
    <Shell copy={copy} tone={tone} onAdminPage={onAdminPage} menuId="q2-menu">
      <main className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-5 sm:px-8 sm:py-8">
        {ready.length === 0 ? null : (
          <section
            style={{ background: tone.accent, color: tone.onAccent }}
            className="rounded-2xl p-5"
          >
            <h2 className="m-0 mb-3 text-[15px] font-bold">{copy.claim}</h2>
            <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
              {ready.map((quest) => (
                <li key={quest.rule} className="flex items-center justify-between gap-4">
                  <span className="text-[14.5px] font-medium">
                    {copy.rule(quest.rule, quest.target)}
                  </span>
                  <span className="text-[14px] font-bold whitespace-nowrap">
                    {copy.reward(quest.reward)} →
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section style={{ background: tone.surface }} className="rounded-2xl p-5">
          <ul className="m-0 flex list-none flex-col gap-5 p-0">
            {rest.map((quest) => (
              <Line key={quest.rule} quest={quest} copy={copy} tone={tone} />
            ))}
          </ul>
        </section>

        <p style={{ color: tone.muted }} className="m-0 text-[12.5px]">
          {copy.questsLead}
        </p>
      </main>
    </Shell>
  );
}

/** Q3 — tiles, the same grammar the home page uses. */
export function QuestsTiles({ copy, theme, onAdminPage }: QuestProps) {
  const tone = J2[theme];
  const all = [...QUESTS.daily, ...QUESTS.weekly];
  return (
    <Shell copy={copy} tone={tone} onAdminPage={onAdminPage} menuId="q3-menu">
      <main className="mx-auto max-w-6xl px-4 py-5 sm:px-8 sm:py-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {all.map((quest, at) => {
            const how = stateOf(quest);
            return (
              <section
                key={quest.rule}
                style={{
                  background: how === 'ready' ? tone.accent : tone.surface,
                  color: how === 'ready' ? tone.onAccent : tone.ink,
                }}
                className="flex flex-col gap-3 rounded-2xl p-5"
              >
                <span
                  style={{ color: how === 'ready' ? tone.onAccent : tone.muted }}
                  className="text-[11px] tracking-[0.08em] uppercase"
                >
                  {at < QUESTS.daily.length ? copy.daily : copy.weekly}
                </span>
                <span className="text-[15.5px] leading-snug font-bold">
                  {copy.rule(quest.rule, quest.target)}
                </span>
                <span className="text-[26px] leading-none font-bold tabular-nums">
                  {quest.done}/{quest.target}
                </span>
                {how === 'ready' ? null : <Bar quest={quest} tone={tone} />}
                <span className="mt-auto text-[13px] font-semibold">
                  {how === 'ready'
                    ? `${copy.claim} · ${copy.reward(quest.reward)}`
                    : how === 'claimed'
                      ? copy.claimed
                      : copy.reward(quest.reward)}
                </span>
              </section>
            );
          })}
        </div>
      </main>
    </Shell>
  );
}
