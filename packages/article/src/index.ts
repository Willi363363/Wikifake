// Producing the falsified articles: retrieval, paragraph collection,
// falsification, cache.
//
// The counters arrive with step 3.7.
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
export {
  falsifiableCandidates,
  falsify,
  FALSIFICATIONS_PER_ARTICLE,
  MIN_FALSIFIABLE_CHARS,
} from './falsify.js';
export type {
  Candidate,
  Falsification,
  FalsifyOptions,
  FalsifyOutcome,
} from './falsify.js';
export { generateArticle, MIN_ARTICLE_PARAGRAPHS } from './generate.js';
export type { GeneratedArticle, GenerateOptions } from './generate.js';
export { createArticleCache } from './cache/cache.js';
export type {
  ArticleCache,
  CachedArticle,
  CacheLookup,
  CacheOptions,
  CacheStats,
  CacheWrite,
  RedisCommands,
} from './cache/cache.js';
export {
  CACHE_TTL_SECONDS,
  MAX_CATEGORIES,
  normaliseCategory,
  VARIANTS_PER_CATEGORY,
} from './cache/keys.js';
