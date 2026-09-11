// Step J.3 — the two legal documents, drawn by one component.
//
// **On the reading sheet, and that is the direction's own rule rather than a
// preference.** `01-art-direction.md` exempts the surface being *read* from the
// brutalist grammar, and a privacy policy is nine paragraphs somebody has to get
// through. A policy in a 3px box with a yellow fill is a policy nobody reads —
// which is the failure mode a policy already has without any help from us.
// The chassis around it stays loud; the prose does not.
//
// One component for all three because they are the same shape: a title, a date,
// one paragraph of introduction, and sections of a heading and a body. The FAQ
// of J.5 joined them rather than growing a second renderer — it is a standing
// document of headings and paragraphs, whatever its subject, and the `legal`
// zone is where the standing documents live.
// The order lives here, in `SECTIONS`, rather than being read off the catalogue
// — `Object.keys` on a message object is an order that depends on how a
// translator saved the file, and the order of a legal document is part of it.
import { useTranslations } from 'next-intl';

import { ReadingSheet } from '@wikifake/ui';

import { LICENCE } from '../round/attribution.js';
import { LEGAL_CONTACT } from './contact.js';

/**
 * The sections, in the order they are read.
 *
 * Adding one is two catalogue entries and one line here. Forgetting the line
 * means the section is translated and never shown, which `legal.test.tsx`
 * catches by holding this list against the catalogue's own keys.
 */
export const SECTIONS = {
  privacy: [
    'controller',
    'guest',
    'account',
    'play',
    'technical',
    'cookies',
    'processors',
    'retention',
    'rights',
    'changes',
  ],
  terms: [
    'what',
    'wikipedia',
    'age',
    'account',
    'coins',
    'fair',
    'reports',
    'availability',
    'liability',
    'law',
  ],
  /*
   * The questions, in the order they are asked.
   *
   * `trust` sits second on purpose. Everything else on this page is about how
   * the game works; that one is about not believing what it shows you, and a
   * reader who leaves after two answers should have read it.
   */
  faq: [
    'what',
    'trust',
    'free',
    'articles',
    'errors',
    'scoring',
    'friends',
    'coins',
    'french',
    'realerror',
    'data',
  ],
} as const;

export type LegalDocumentName = keyof typeof SECTIONS;

export interface LegalDocumentProps {
  readonly name: LegalDocumentName;
}

export function LegalDocument({ name }: LegalDocumentProps) {
  const t = useTranslations(`legal.${name}`);

  return (
    <main className="w-full px-4 py-12">
      {/* The padding is the sheet, and it belongs here rather than in the
          component: `ReadingSheet` owns the measure and the prose colours for
          every screen that reads, and a legal page is the only one that puts
          the surface itself in front of a reader with nothing else on it. Left
          flush against its own background it does not read as a sheet at all. */}
      <ReadingSheet as="article" className="mx-auto p-6 sm:p-10">
        <h1 className="text-3xl font-extrabold tracking-tight">{t('title')}</h1>

        {/* The date is what tells a reader whether the page describes the site
            they are on. Muted, because it is metadata, and never a fill. */}
        <p className="mt-2 text-sm text-muted">{t('updated')}</p>

        <p className="mt-6">{t('intro')}</p>

        {SECTIONS[name].map((section) => (
          <section key={section} className="mt-8">
            <h2 className="text-xl font-bold tracking-tight">
              {t(`sections.${section}.heading`)}
            </h2>
            <p className="mt-2">
              {t.rich(`sections.${section}.body`, {
                /*
                 * The address, from one constant, and the licence, from the one
                 * the round already credits.
                 *
                 * Both are injected rather than written into the catalogue: an
                 * address spelled twice is an address that will disagree with
                 * itself in one language, and a licence name copied out of
                 * `attribution.tsx` is a second answer to a question CC BY-SA
                 * only allows one answer to.
                 */
                address: LEGAL_CONTACT,
                licenceName: LICENCE.name,
                contact: (chunks) => (
                  <a
                    className="underline underline-offset-2"
                    href={`mailto:${LEGAL_CONTACT}`}
                  >
                    {chunks}
                  </a>
                ),
                licence: (chunks) => (
                  <a
                    className="underline underline-offset-2"
                    href={LICENCE.url}
                    rel="license noreferrer"
                    target="_blank"
                  >
                    {chunks}
                  </a>
                ),
              })}
            </p>
          </section>
        ))}
      </ReadingSheet>
    </main>
  );
}
