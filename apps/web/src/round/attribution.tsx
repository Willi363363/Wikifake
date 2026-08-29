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

import { useTranslations } from 'next-intl';

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
  const t = useTranslations('round');

  return (
    <aside className="mt-8 space-y-2 border-t border-line pt-4 text-xs text-muted">
      <p>
        <strong className="font-semibold text-ink">
          {t('attribution.modifiedWarning.title')}
        </strong>{' '}
        {t('attribution.modifiedWarning.body')}
      </p>
      <p>
        {/* One whole message with the two links as placeholders: a legal
            sentence assembled from fragments is a sentence no translation can
            reorder. The licence name is an identifier, injected untranslated,
            and the topic is a French title — the link carries `lang="fr"`. */}
        {t.rich('attribution.credit', {
          topic,
          licenceName: LICENCE.name,
          article: (chunks) => (
            <a
              lang="fr"
              className="underline hover:text-ink"
              href={sourceUrl}
              target="_blank"
              rel="noreferrer noopener"
            >
              {chunks}
            </a>
          ),
          licence: (chunks) => (
            <a
              className="underline hover:text-ink"
              href={LICENCE.url}
              target="_blank"
              rel="noreferrer noopener"
            >
              {chunks}
            </a>
          ),
        })}
      </p>
    </aside>
  );
}
