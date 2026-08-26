// The source attribution. Required, and not decoration.
//
// Wikipedia is published under CC BY-SA: reuse — commercial included — obliges
// us to credit the authors, name the licence, and, the critical point here, to
// **state that the text has been modified**. The game alters facts on purpose;
// showing that without saying so would be both a licence violation and
// accidental misinformation.
//
// So it is visible during the round and after it (C6.1), which is why it lives
// beside the article rather than in a debrief that only exists at the end.
//
// English, like the rest of the interface from the rewrite onwards. The
// attribution has to be correct in every locale, and phase 11 owns that — a
// missing key in this block is a licence violation, which is why
// `phase-11-i18n.md` singles it out.

/** The licence the article text and our modifications are both under. */
export const LICENCE = {
  name: 'CC BY-SA 4.0',
  url: 'https://creativecommons.org/licenses/by-sa/4.0/',
} as const;

export interface AttributionProps {
  readonly topic: string;
  readonly sourceUrl: string;
}

export function Attribution({ topic, sourceUrl }: AttributionProps) {
  return (
    <aside className="mt-8 space-y-2 border-t border-line pt-4 text-xs text-muted">
      <p>
        <strong className="font-semibold text-ink">Text deliberately modified.</strong>{' '}
        Facts have been altered for the game: this is not a reliable source.
      </p>
      <p>
        After the Wikipedia article{' '}
        <a
          className="underline hover:text-ink"
          href={sourceUrl}
          target="_blank"
          rel="noreferrer noopener"
        >
          “{topic}”
        </a>{' '}
        by its contributors, under{' '}
        <a
          className="underline hover:text-ink"
          href={LICENCE.url}
          target="_blank"
          rel="noreferrer noopener"
        >
          {LICENCE.name}
        </a>
        . The modifications are WikiFake&rsquo;s, released under the same licence.
      </p>
    </aside>
  );
}
