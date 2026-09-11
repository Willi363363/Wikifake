// `/terms` — step J.3.
//
// Indexable, for `/privacy`'s reason: these two are content rather than one
// player's screen, and they are named in the sitemap.
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { LegalDocument } from '../../../src/legal/document.js';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('legal.terms');
  return { title: t('title') };
}

export default function TermsPage() {
  return <LegalDocument name="terms" />;
}
