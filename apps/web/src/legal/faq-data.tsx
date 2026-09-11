// Step J.5 — the FAQ as data a search engine reads, and not only as prose.
//
// The one piece of structured data on this site, and it is here rather than
// everywhere for a reason: a `FAQPage` is a shape schema.org describes exactly,
// the page really is a list of questions and answers, and search engines have
// been reading it for years. Marking up a game screen would be inventing a
// claim about what it is; marking up this page is describing what it plainly is.
//
// **Built from the same catalogue the page renders**, never a second copy. A
// hand-written block of JSON-LD is a promise to keep two things in step for
// ever, and `faq-data.test.tsx` holds that promise instead: every question in
// the markup is a question on the page, in the language the page is in.
import { useTranslations } from 'next-intl';

import { SECTIONS } from './document.js';

/**
 * The block, as a script tag React renders verbatim.
 *
 * `dangerouslySetInnerHTML` is how JSON-LD is emitted — a script's contents are
 * text, not children — and the danger the name warns about is somebody else's
 * HTML. This is `JSON.stringify` of an object built here, which cannot close a
 * tag: the only string that could, `</script`, is escaped below rather than
 * assumed impossible, because the answers are translated by hand and the next
 * hand is not this one.
 */
export function FaqStructuredData() {
  const t = useTranslations('legal.faq');

  const document = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: SECTIONS.faq.map((section) => ({
      '@type': 'Question',
      name: t(`sections.${section}.heading`),
      acceptedAnswer: {
        '@type': 'Answer',
        text: t(`sections.${section}.body`),
      },
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(document).replaceAll('<', '\\u003c'),
      }}
    />
  );
}
