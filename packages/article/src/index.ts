// Producing the falsified articles: retrieval, paragraph collection,
// falsification, cache.
//
// The MediaWiki client arrives with step 3.2, the falsification with 3.4, the
// Redis cache with 3.6. What is here is the invariant the rest rests on.
export {
  collectParagraphs,
  injectFalsifications,
  normaliseText,
  MIN_CONTENT_CHARS,
} from './paragraphs.js';
export type { CollectedArticle } from './paragraphs.js';
