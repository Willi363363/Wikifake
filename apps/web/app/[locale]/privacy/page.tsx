// `/privacy` — step J.3.
//
// Indexable, unlike every other page this effort has added. A privacy policy is
// the one page a person may go looking for from outside the site, and one a
// crawler is entitled to keep: `src/indexing.ts` names it in the sitemap
// alongside the front door, and nothing here says `noindex`.
//
// The document is `src/legal/document.tsx`; this file is the route and its
// title.
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { LegalDocument } from '../../../src/legal/document.js';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('legal.privacy');
  return { title: t('title') };
}

export default function PrivacyPage() {
  return <LegalDocument name="privacy" />;
}
