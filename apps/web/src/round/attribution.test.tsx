/** @vitest-environment jsdom */

// C6.1 in every locale — step 11.7.
//
// The attribution is a licence term, not interface copy: CC BY-SA obliges the
// page to say the text was deliberately modified, to name the licence and to
// link the source article, during **and** after the round. Elsewhere a missing
// catalogue key shows a raw identifier; here it is a licence violation. So this
// suite does two things no other test does:
//
// - it holds the **full expected wording per locale in the test itself** —
//   asserting against the catalogue would bless whatever the catalogue says,
//   and the point is that a catalogue edit to this sentence must be flagged;
// - it reads every catalogue directory on disk, so a locale added tomorrow
//   without its attribution fails today's test, not a player's rights.
import { cleanup, screen, within } from '@testing-library/react';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Locale } from '../i18n/locales.js';
import { renderIn } from '../i18n/testing.js';
import { LICENCE } from './attribution.js';
import { Round } from './round.js';
import { ARTICLE, noEffects, noHints } from './testing.js';

afterEach(() => {
  cleanup();
});

/**
 * The legal sentences, verbatim, with the fixture's topic already in place.
 *
 * `satisfies` on purpose: adding a locale without adding its wording here is a
 * compile error before it is a failing test.
 */
const WORDING = {
  en: {
    title: 'Text deliberately modified.',
    body: 'Facts have been altered for the game: this is not a reliable source.',
    credit:
      'After the Wikipedia article “Chat” by its contributors, under CC BY-SA 4.0. The modifications are WikiFake’s, released under the same licence.',
  },
  fr: {
    title: 'Texte volontairement modifié.',
    body: 'Des faits ont été altérés pour le jeu : ce n’est pas une source fiable.',
    credit:
      'D’après l’article Wikipédia « Chat » de ses contributeurs, sous CC BY-SA 4.0. Les modifications sont celles de WikiFake, publiées sous la même licence.',
  },
} satisfies Record<Locale, { title: string; body: string; credit: string }>;

const LOCALES_UNDER_TEST = Object.keys(WORDING) as readonly Locale[];

/** The whole attribution, not just its presence. */
function expectFullAttribution(locale: Locale): void {
  const wording = WORDING[locale];

  // The modification warning, word for word.
  expect(screen.getByText(wording.title)).not.toBeNull();
  expect(screen.getByText(wording.body)).not.toBeNull();

  // The licence: its exact name, linking to the licence text.
  const licence = screen.getByRole('link', { name: LICENCE.name });
  expect(licence.getAttribute('href')).toBe(LICENCE.url);

  // The credit sentence as one whole — quotes, topic and licence name in the
  // locale's own word order, nothing dropped by a translation.
  const credit = licence.closest('p');
  expect(credit).not.toBeNull();
  expect(credit?.textContent).toBe(wording.credit);

  // The source link: intact, and marked French whatever the interface speaks —
  // the topic is fr.wikipedia.org data, not interface text.
  const source = within(credit as HTMLElement)
    .getAllByRole('link')
    .find((link) => link.getAttribute('href') === ARTICLE.wikipediaUrl);
  expect(source).not.toBeUndefined();
  expect(source?.textContent).toContain(ARTICLE.topic);
  expect(source?.getAttribute('lang')).toBe('fr');
}

/** A round in the given locale, mid-game or with the debrief up. */
function paintIn(locale: Locale, over: { readonly ended?: boolean } = {}): void {
  const breakdown = {
    truePositives: 1,
    falsePositives: 0,
    hintsUsed: 0,
    hintPenalty: 0,
    scoreStolen: 0,
    timeBonus: 0,
  };
  renderIn(
    locale,
    <Round
      article={ARTICLE}
      timeLimit={300}
      submitted={over.ended === true}
      busy={false}
      refusal={null}
      hints={noHints()}
      effects={noEffects()}
      onSubmit={vi.fn()}
      onUnlockHint={vi.fn()}
      {...(over.ended === true
        ? {
            debrief: {
              score: 100,
              breakdown,
              solution: [
                {
                  paragraphIndex: 0,
                  falseInfoNumber: 1,
                  falseStatement: ARTICLE.paragraphs[0] ?? '',
                  explanation: 'Il en dort douze.',
                  hint: 'Regardez la durée.',
                },
              ],
              standings: [{ name: 'ada', colour: '#e63946', breakdown, you: true }],
              onwardLabel: 'Play again',
              onOnward: vi.fn(),
            },
          }
        : {})}
    />,
  );
}

describe('11.7 — the full attribution, in every locale (C6.1)', () => {
  it.each(LOCALES_UNDER_TEST)('%s — during the round', (locale) => {
    paintIn(locale);
    expectFullAttribution(locale);
  });

  it.each(LOCALES_UNDER_TEST)('%s — after the round, debrief up', (locale) => {
    paintIn(locale, { ended: true });
    expect(screen.getByRole('region', { name: /Debrief|Débriefing/ })).not.toBeNull();
    expectFullAttribution(locale);
  });
});

// The catalogue side: the render tests above prove the locales the harness
// mounts, this one holds **every catalogue directory on disk** — including a
// locale someone adds without touching any test — to the keys the attribution
// cannot render without.
describe('11.7 — no catalogue may miss an attribution key', () => {
  const MESSAGES = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'messages');
  const localesOnDisk = readdirSync(MESSAGES, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  function attributionOf(locale: string): Record<string, unknown> {
    const zone = JSON.parse(
      readFileSync(join(MESSAGES, locale, 'round.json'), 'utf8'),
    ) as {
      attribution?: {
        modifiedWarning?: { title?: unknown; body?: unknown };
        credit?: unknown;
      };
    };
    return {
      'attribution.modifiedWarning.title': zone.attribution?.modifiedWarning?.title,
      'attribution.modifiedWarning.body': zone.attribution?.modifiedWarning?.body,
      'attribution.credit': zone.attribution?.credit,
    };
  }

  it('sees every locale the interface declares', () => {
    for (const locale of LOCALES_UNDER_TEST) {
      expect(localesOnDisk).toContain(locale);
    }
  });

  it.each(localesOnDisk)('%s carries every attribution key, none empty', (locale) => {
    for (const [key, message] of Object.entries(attributionOf(locale))) {
      // A missing or empty key here is not a cosmetic fallback: it is the
      // licence obligation silently not rendered.
      expect(typeof message, `${locale}: ${key}`).toBe('string');
      expect(String(message).trim(), `${locale}: ${key}`).not.toBe('');
    }
  });

  it.each(localesOnDisk)('%s keeps the credit’s placeholders and links', (locale) => {
    // A translation that drops a placeholder drops the topic, the licence name
    // or one of the two links — each of which the licence requires.
    const credit = String(attributionOf(locale)['attribution.credit']);
    for (const required of [
      '{topic}',
      '{licenceName}',
      '<article>',
      '</article>',
      '<licence>',
      '</licence>',
    ]) {
      expect(credit, `${locale}: attribution.credit must keep ${required}`).toContain(
        required,
      );
    }
  });
});
