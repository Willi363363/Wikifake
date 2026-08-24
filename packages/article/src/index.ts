// Producing the falsified articles: retrieval, paragraph collection,
// falsification, cache.
//
// The falsification arrives with step 3.4 and the Redis cache with 3.6.
export {
  collectParagraphs,
  injectFalsifications,
  normaliseText,
  MIN_CONTENT_CHARS,
} from './paragraphs.js';
export type { CollectedArticle } from './paragraphs.js';
export { fetchRenderedPage, searchTitles } from './mediawiki.js';
export type { RenderedPage, WikiRequest, WikiTransport } from './mediawiki.js';
export { failed, ok } from './result.js';
export type { FailureReason, Result } from './result.js';
