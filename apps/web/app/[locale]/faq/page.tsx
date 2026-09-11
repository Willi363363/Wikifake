// `/faq` — step J.5.
//
// Indexable, like the two documents beside it and unlike every screen this
// effort added before them: the questions somebody types into a search engine
// about a game are the questions on this page, and a page no crawler may keep
// answers none of them.
//
// It also carries the one piece of structured data on this site —
// `FaqStructuredData` — because a FAQ is the one shape search engines read as
// data rather than as prose.
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { LegalDocument } from '../../../src/legal/document.js';
import { FaqStructuredData } from '../../../src/legal/faq-data.js';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('legal.faq');
  return { title: t('title'), description: t('intro') };
}

export default function FaqPage() {
  return (
    <>
      <LegalDocument name="faq" />
      <FaqStructuredData />
    </>
  );
}
