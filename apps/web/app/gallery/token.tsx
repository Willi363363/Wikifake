'use client';

// The paragraph token, in all eight of its looks.
//
// One of them is live: the first card is a real toggle, so "reachable by tab and
// activated by keyboard" is something a reviewer can try rather than read about.
// The other seven are pinned to a state, because five of them cannot be reached
// by clicking — a hint has to be bought, a scanner spent, a round finished.
import { ParagraphToken, TOKEN_STATES, tokenStateFor } from '@wikifake/ui';
import type { TokenState } from '@wikifake/ui';
import { useState } from 'react';

const TEXT = 'Le chat dort seize heures par jour, réparties en de nombreuses siestes.';

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
        <code className="text-sm text-ink">{state}</code>
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
