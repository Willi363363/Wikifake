// Producing the falsified articles: retrieval, paragraph collection,
// falsification, cache.
//
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
  FalsifyReport,
} from './falsify.js';
export { callFailed, callSucceeded, requestedModel } from './accounting.js';
export type { CallAnswer, CallShape } from './accounting.js';
export { storedPosition } from './solution.js';
export type { StoredPosition } from './solution.js';
export { generateArticle, MIN_ARTICLE_PARAGRAPHS } from './generate.js';
export type { GeneratedArticle, GenerateOptions, GenerationReport } from './generate.js';
export { verifyFlag, CONTEXT_CHARS } from './verify.js';
export type { VerifyOptions, VerifyReport } from './verify.js';
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
  NAMESPACE,
  normaliseCategory,
  VARIANTS_PER_CATEGORY,
} from './cache/keys.js';
