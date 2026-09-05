'use client';

// The paragraph token, in all eight of its looks — inside the surface it
// actually lives on.
//
// The first block is the pairing `01-art-direction.md` is built around: a
// `ReadingSheet` of real prose with markable tokens in it. Showing the token on
// its own would show the loud half and hide the decision — that the paragraph
// being judged stays calm while the act of judging it does not.
//
// One of them is live: the first card is a real toggle, so "reachable by tab and
// activated by keyboard" is something a reviewer can try rather than read about.
// The other seven are pinned to a state, because five of them cannot be reached
// by clicking — a hint has to be bought, a scanner spent, a round finished.
import { ParagraphToken, ReadingSheet, TOKEN_STATES, tokenStateFor } from '@wikifake/ui';
import type { TokenState } from '@wikifake/ui';
import { useState } from 'react';

const TEXT = 'Le chat dort seize heures par jour, réparties en de nombreuses siestes.';

// Article-length prose, because a measure and a line height cannot be judged on
// one short sentence — and judging them is the whole of what the reading sheet
// decides.
//
// In English, unlike the game's real articles. The scan of `language.test.ts`
// covers `app/`, and it is right to: a gallery is a source file like any other.
// Writing the sample in French would mean either weakening that scan or
// choosing sentences that dodge its word list, and both are worse than a
// sample that demonstrates typography in the repository's own language.
const PROSE =
  'Born in Warsaw in 1867 to a family of teachers, Maria Skłodowska left Poland in 1891 ' +
  'to study at the Sorbonne, where she took a degree in physics and then a second in ' +
  'mathematics. She met Pierre Curie there, and married him four years later.';

const PROSE_TWO =
  'In 1903 she shared the Nobel Prize in Physics with Pierre Curie and Henri Becquerel ' +
  'for their work on radioactivity. She became, in 1911, the first person to receive a ' +
  'second Nobel Prize.';

const WHEN: Readonly<Record<TokenState, string>> = {
  idle: 'untouched — the round is running',
  selected: 'the player marked it',
  edited: 'a correction was typed into it (expert mode)',
  scanned: 'C1.6 — the SCANNER pointed here',
  hinted: 'C1.4 — a hint was bought on it',
  found: 'C1.2 — falsified, and caught',
  missed: 'C1.2 — falsified, and let through',
  'false-positive': 'C1.2 — marked, and not falsified',
};

function Card({ state, children }: { state: TokenState; children: React.ReactNode }) {
  return (
    <li className="rounded-lg border border-line bg-surface p-4">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <code className="min-w-0 text-sm text-ink">{state}</code>
        <span className="text-right text-xs text-muted">{WHEN[state]}</span>
      </div>
      {/* Room above for the badges, which sit outside the box. */}
      <div className="pt-5">{children}</div>
    </li>
  );
}

export function TokenGallery() {
  const [marked, setMarked] = useState(false);

  return (
    <div className="rounded-xl border border-line bg-bg p-6 text-ink">
      <p className="mb-4 max-w-prose text-sm text-muted">
        The gesture the whole game is made of. The first card is live — tab to it and
        press Enter or Space. The rest are pinned: five of these states cannot be reached
        by clicking, because a hint has to be bought, a scanner spent, or a round
        finished.
      </p>

      <ReadingSheet className="mb-6 border-3 border-line-strong p-5">
        <p className="mb-3 text-sm text-muted">
          The reading surface, with two markable paragraphs on it.
        </p>
        <ParagraphToken
          state={tokenStateFor({ marked })}
          onClick={() => {
            setMarked((was) => !was);
          }}
        >
          {PROSE}
        </ParagraphToken>
        <ParagraphToken state="hinted">{PROSE_TWO}</ParagraphToken>
      </ReadingSheet>

      <ul className="grid gap-3 md:grid-cols-2">
        <Card state={tokenStateFor({ marked })}>
          <ParagraphToken
            state={tokenStateFor({ marked })}
            onClick={() => {
              setMarked((was) => !was);
            }}
          >
            {TEXT}
          </ParagraphToken>
        </Card>

        {TOKEN_STATES.filter((state) => state !== 'idle' && state !== 'selected').map(
          (state) => (
            <Card key={state} state={state}>
              <ParagraphToken state={state}>{TEXT}</ParagraphToken>
            </Card>
          ),
        )}
      </ul>
    </div>
  );
}
