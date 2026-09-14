'use client';

// The grid the owner chose, written once — step L.1, round five.
//
// Both audiences live here: a returning player sees their figures, and a first
// visitor sees the pitch in the same tiles, because a dashboard that draws
// zeroes says the game is empty.
//
// **Play is the largest tile in both.** It earns the eye by area and position
// rather than by glowing, which is the whole reason this arrangement survived
// four rounds of refusals.
import { Shell } from './shell.js';
import type { Copy } from './copy.js';
import { SAMPLE } from './sample.js';
import type { Skin } from './skin.js';
import type { Tone } from './tone.js';

export interface BentoProps {
  readonly copy: Copy;
  readonly tone: Tone;
  readonly skin: Skin;
  readonly signedIn: boolean;
  readonly onAdminPage: boolean;
  readonly menuId: string;
}

export function Bento({ copy, tone, skin, signedIn, onAdminPage, menuId }: BentoProps) {
  const tile = `${skin.radius} ${skin.pad} ${skin.bordered ? 'border' : ''}`;
  const edge = {
    background: skin.fill === 'surface' ? tone.surface : tone.bg,
    borderColor: tone.line,
  };
  const play = { background: tone.accent, color: tone.onAccent };

  return (
    <Shell copy={copy} tone={tone} onAdminPage={onAdminPage} menuId={menuId}>
      <main className="mx-auto max-w-6xl px-4 py-5 sm:px-8 sm:py-8">
        <div className={`grid ${skin.gap} sm:grid-cols-4`}>
          <a
            href="#"
            style={play}
            className={`flex min-h-48 flex-col justify-between ${skin.radius} ${skin.pad} sm:col-span-2 sm:row-span-2`}
          >
            <span className="text-[15px] leading-snug font-medium opacity-90">
              {signedIn ? `${copy.streak} · ${String(SAMPLE.streak)}` : copy.question}
            </span>
            <span>
              <span className="block text-[34px] leading-none font-bold tracking-[-0.02em]">
                {copy.play}
              </span>
              {signedIn ? null : (
                <span className="mt-2 block text-[12.5px] opacity-85">{copy.guest}</span>
              )}
            </span>
          </a>

          {signedIn ? (
            <div style={edge} className={`${tile} sm:col-span-2`}>
              <div className="flex items-baseline justify-between">
                <span className={`${skin.label} font-semibold`}>{copy.daily}</span>
                <span style={{ color: tone.second }} className="text-[12px]">
                  {copy.reward(SAMPLE.daily.reward)}
                </span>
              </div>
              <p style={{ color: tone.muted }} className={`m-0 mt-1 ${skin.body}`}>
                {copy.progress(SAMPLE.daily.done, SAMPLE.daily.target)}
              </p>
              <div
                style={{ background: tone.line }}
                className="mt-3 h-2 overflow-hidden rounded-full"
              >
                <span
                  style={{
                    background: tone.accent,
                    width: `${String((SAMPLE.daily.done / SAMPLE.daily.target) * 100)}%`,
                  }}
                  className="block h-full"
                />
              </div>
            </div>
          ) : (
            <div style={edge} className={`${tile} sm:col-span-2`}>
              <p className={`m-0 ${skin.body} leading-[1.65]`}>{copy.description}</p>
            </div>
          )}

          {signedIn ? (
            <>
              <Figure
                tone={tone}
                skin={skin}
                edge={edge}
                tile={tile}
                label={copy.finished}
                value={String(SAMPLE.gamesFinished)}
              />
              <Figure
                tone={tone}
                skin={skin}
                edge={edge}
                tile={tile}
                label={copy.average}
                value={`${String(SAMPLE.averageScore)}%`}
              />
            </>
          ) : (
            copy.beats.slice(0, 2).map((beat) => (
              <div key={beat.title} style={edge} className={tile}>
                <h2 className={`m-0 ${skin.label} font-semibold`}>{beat.title}</h2>
                <p
                  style={{ color: tone.muted }}
                  className={`m-0 mt-1.5 ${skin.body} leading-[1.6]`}
                >
                  {beat.body}
                </p>
              </div>
            ))
          )}

          <div style={edge} className={`${tile} sm:col-span-2`}>
            <span className={`${skin.label} font-semibold`}>{copy.board}</span>
            <ul className="m-0 mt-2.5 flex list-none flex-col gap-1.5 p-0">
              {SAMPLE.board
                .filter((row) => signedIn || row.you !== true)
                .map((row) => (
                  <li key={row.name} className={`flex items-baseline gap-3 ${skin.body}`}>
                    <span
                      style={{ color: row.you === true ? tone.accent : tone.muted }}
                      className="w-5 tabular-nums"
                    >
                      {row.place}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{row.name}</span>
                    <span style={{ color: tone.muted }} className="tabular-nums">
                      {row.rounds}
                    </span>
                  </li>
                ))}
            </ul>
          </div>

          {signedIn ? (
            <div style={edge} className={`${tile} sm:col-span-2`}>
              <span className={`${skin.label} font-semibold`}>{copy.finished}</span>
              <ul className="m-0 mt-2.5 flex list-none flex-col gap-1.5 p-0">
                {SAMPLE.rounds.slice(0, 4).map((round) => (
                  <li
                    key={round.topic}
                    className={`flex items-baseline gap-3 ${skin.body}`}
                  >
                    <span className="min-w-0 flex-1 truncate">{round.topic}</span>
                    <span className="tabular-nums">{round.score}%</span>
                    <span
                      style={{ color: tone.muted }}
                      className="w-8 text-right text-[11px]"
                    >
                      {round.when}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div style={edge} className={`${tile} sm:col-span-2`}>
              <span className={`${skin.label} font-semibold`}>{copy.keepTitle}</span>
              <p
                style={{ color: tone.muted }}
                className={`m-0 mt-1.5 ${skin.body} leading-[1.6]`}
              >
                {copy.keepLead}
              </p>
              <a
                href="#"
                style={{ color: tone.accent }}
                className={`mt-2 inline-block ${skin.body} font-semibold`}
              >
                {copy.keepCta} →
              </a>
            </div>
          )}
        </div>
      </main>
    </Shell>
  );
}

function Figure({
  tone,
  skin,
  edge,
  tile,
  label,
  value,
}: {
  readonly tone: Tone;
  readonly skin: Skin;
  readonly edge: { background: string; borderColor: string };
  readonly tile: string;
  readonly label: string;
  readonly value: string;
}) {
  return (
    <div style={edge} className={tile}>
      <span style={{ color: tone.muted }} className={skin.label}>
        {label}
      </span>
      <p className={`m-0 mt-1 ${skin.figure} leading-none font-bold tabular-nums`}>
        {value}
      </p>
    </div>
  );
}
