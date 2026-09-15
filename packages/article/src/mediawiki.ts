// Talking to MediaWiki, with nothing implicit.
//
// The `wikipedia` Python library keeps the language and the user agent in module
// globals, set by `scraper.py` and never by anything else. So
// `flag_verifier.py` — which never sets either — asks whichever Wikipedia the
// last caller happened to configure. On a freshly restarted process, before any
// game has been generated, that is the **English** Wikipedia with the library's
// default user agent: a report about a French article gets fact-checked against
// the wrong encyclopedia, or against nothing.
//
// Here there is no global to be wrong. Language and user agent are parameters on
// every call, and the type will not let a caller omit them.
import { failed, ok, type Result } from './result.js';

/** Wikimedia's policy asks for an identifiable agent; an empty one gets refused. */
/**
 * The Wikipedia this game reads. French, and it is not a setting.
 *
 * The topics players type, the article they read and the falsifications the
 * model writes are all French. A deployment reading another Wikipedia would be a
 * different game, not a configured one — and two deployments each naming their
 * own language is D13 with better manners.
 */
export const WIKI_LANGUAGE = 'fr';

export interface WikiRequest {
  /** A wiki language code: `fr`, `en`, `pt-br`. */
  readonly language: string;
  /** Something that identifies this application and a way to reach its owner. */
  readonly userAgent: string;
  /**
   * Where the API actually is, when it is not where the language says.
   *
   * Absent in every deployment, and that is the point: the endpoint is derived
   * from the language, and this is the one way to say otherwise. It exists for
   * the browser tests of step 9.5, which serve the article from a fixture rather
   * than reading Wikipedia four times a run — and it is configuration rather
   * than a seam in the code, so nothing about the request path differs between a
   * test run and a real one.
   */
  readonly endpoint?: string | undefined;
}

/** Injected so tests never touch the network and can read the URL that was built. */
export interface WikiTransport {
  readonly fetch: typeof globalThis.fetch;
}

export interface RenderedPage {
  readonly title: string;
  /** The revision the HTML came from: what makes a fixture reproducible. */
  readonly revisionId: number;
  readonly url: string;
  readonly html: string;
}

const LANGUAGE = /^[a-z]{2,3}(-[a-z0-9]+)*$/;

/**
 * The API endpoint for one language.
 *
 * The language is validated rather than interpolated blindly: it reaches a
 * hostname, and a hostname built from unvalidated input is a request to
 * somewhere else entirely.
 */
function endpoint(request: WikiRequest): Result<string> {
  if (!LANGUAGE.test(request.language)) {
    return failed('unexpected_response', `not a wiki language code: ${request.language}`);
  }
  if (request.userAgent.trim() === '') {
    return failed('unexpected_response', 'a user agent is required by Wikimedia policy');
  }
  // The language is still validated when an endpoint is given: it is carried in
  // the query and read back, and the checks above are not the endpoint's alone.
  if (request.endpoint !== undefined && request.endpoint !== '')
    return ok(request.endpoint);
  return ok(`https://${request.language}.wikipedia.org/w/api.php`);
}

async function callApi(
  parameters: Readonly<Record<string, string>>,
  request: WikiRequest,
  transport: WikiTransport,
): Promise<Result<unknown>> {
  const base = endpoint(request);
  if (!base.ok) return base;

  const url = new URL(base.value);
  for (const [key, value] of Object.entries({
    format: 'json',
    formatversion: '2',
    ...parameters,
  })) {
    url.searchParams.set(key, value);
  }

  let response: Response;
  try {
    response = await transport.fetch(url, {
      headers: { 'User-Agent': request.userAgent, Accept: 'application/json' },
    });
  } catch (error) {
    // A network failure is not a missing page, and a caller that cannot tell
    // them apart will keep asking for other topics while Wikipedia is down.
    return failed('unreachable', error instanceof Error ? error.message : String(error));
  }

  if (response.status === 429)
    return failed('rate_limited', 'Wikimedia asked us to slow down');
  if (!response.ok) {
    return failed('unexpected_response', `HTTP ${String(response.status)}`);
  }

  try {
    return ok(await response.json());
  } catch (error) {
    return failed(
      'unexpected_response',
      `body was not JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

interface SearchBody {
  readonly query?: { readonly search?: readonly { readonly title?: unknown }[] };
}

/** Titles matching a query, best first. Empty results are a failure, not an empty list. */
export async function searchTitles(
  query: string,
  request: WikiRequest,
  transport: WikiTransport,
): Promise<Result<readonly string[]>> {
  const trimmed = query.trim();
  if (trimmed === '') return failed('no_results', 'an empty query matches nothing');

  const body = await callApi(
    { action: 'query', list: 'search', srsearch: trimmed, srlimit: '3' },
    request,
    transport,
  );
  if (!body.ok) return body;

  const hits = (body.value as SearchBody).query?.search;
  if (hits === undefined)
    return failed('unexpected_response', 'no query.search in the answer');

  const titles = hits
    .map((hit) => hit.title)
    .filter((title): title is string => typeof title === 'string');

  return titles.length === 0
    ? failed('no_results', `nothing matches ${trimmed}`)
    : ok(titles);
}

/**
 * The main namespace, and the only one that is an article.
 *
 * `list=mostviewed` answers across namespaces — a live call on 2026-09-15
 * returned `Wikipédia:Accueil principal` and `Spécial:Recherche` among its first
 * five — and neither is a page anybody can be graded on. `list=random` takes the
 * namespace as a parameter and this is passed to it; `mostviewed` does not, so
 * it is filtered from the answer instead.
 */
const ARTICLE_NAMESPACE = 0;

interface TitleListBody {
  readonly query?: Readonly<
    Record<string, readonly { readonly title?: unknown; readonly ns?: unknown }[]>
  >;
}

/** The titles in one `list=` answer that are articles, in the order given. */
function articleTitles(body: unknown, list: string): readonly string[] {
  const rows = (body as TitleListBody).query?.[list];
  if (rows === undefined) return [];

  return rows
    .filter((row) => row.ns === ARTICLE_NAMESPACE)
    .map((row) => row.title)
    .filter((title): title is string => typeof title === 'string');
}

/**
 * The most read articles of the last day, most read first — step N.2.
 *
 * **Why this and not `list=random`.** A random article is usually a stub about a
 * village or a species: measured on 2026-09-15, one draw of four gave `Rajaz`,
 * `Église Saint-Pierre de Vievy-le-Rayé` and a disambiguation page. An article
 * nobody has heard of makes a poor shared subject, which is the one thing the
 * article of the day exists to be. The same draw from this list gave `Cookie
 * (informatique)` and `Julia (film, 1977)`.
 *
 * It is the PageViewInfo extension, deployed on every Wikimedia wiki, so it
 * needs no endpoint the rest of this module does not already use. A wiki without
 * it answers with no list rather than an error — which reads here as an empty
 * result, and `randomTitles` is what a caller falls back to.
 */
export async function mostViewedTitles(
  limit: number,
  request: WikiRequest,
  transport: WikiTransport,
): Promise<Result<readonly string[]>> {
  const body = await callApi(
    {
      action: 'query',
      list: 'mostviewed',
      pvimmetric: 'pageviews',
      // Wide, because the namespace filter and the paragraph filter above both
      // throw candidates away. The ceiling is ours rather than the API's: asked
      // for 600 on 2026-09-15 it warned "must be between 1 and 500" and answered
      // with 500 anyway, so this bounds what we ask for and not what it accepts.
      pvimlimit: String(Math.max(1, Math.min(limit, 100))),
    },
    request,
    transport,
  );
  if (!body.ok) return body;

  const titles = articleTitles(body.value, 'mostviewed');

  return titles.length === 0
    ? failed('no_results', 'the wiki returned no most-viewed articles')
    : ok(titles);
}

/** Random articles, for a wiki or a day where the most-viewed list is no help. */
export async function randomTitles(
  limit: number,
  request: WikiRequest,
  transport: WikiTransport,
): Promise<Result<readonly string[]>> {
  const body = await callApi(
    {
      action: 'query',
      list: 'random',
      rnnamespace: String(ARTICLE_NAMESPACE),
      // Tighter than the most-viewed list on purpose: this is the fallback, and
      // a caller only ever fetches `attempts` of them. The API's own ceiling is
      // 500 and it warns rather than refuses past it — measured, not assumed.
      rnlimit: String(Math.max(1, Math.min(limit, 20))),
    },
    request,
    transport,
  );
  if (!body.ok) return body;

  const titles = articleTitles(body.value, 'random');

  return titles.length === 0
    ? failed('no_results', 'the wiki returned no random articles')
    : ok(titles);
}

interface ParseBody {
  readonly error?: { readonly code?: unknown };
  readonly parse?: {
    readonly title?: unknown;
    readonly revid?: unknown;
    readonly text?: unknown;
  };
}

/**
 * The rendered HTML of a page, by exact title.
 *
 * **No auto-suggestion.** `action=parse` fails on a title that does not exist
 * rather than guessing a near match: the current code calls
 * `wikipedia.page(results[0])` without `auto_suggest=False` in one place, so a
 * lookup can land on a different article than the one that was searched for, and
 * the player is then graded on an article nobody chose.
 *
 * Redirects **are** followed — a redirect is a page saying where it moved, which
 * is not a guess.
 */
export async function fetchRenderedPage(
  title: string,
  request: WikiRequest,
  transport: WikiTransport,
): Promise<Result<RenderedPage>> {
  const trimmed = title.trim();
  if (trimmed === '') return failed('not_found', 'an empty title is not a page');

  const body = await callApi(
    { action: 'parse', page: trimmed, prop: 'text|revid', redirects: '1' },
    request,
    transport,
  );
  if (!body.ok) return body;

  const answer = body.value as ParseBody;
  if (answer.error !== undefined) {
    // `missingtitle` is the ordinary "no such page"; anything else is a problem
    // with the request rather than with the topic.
    return answer.error.code === 'missingtitle'
      ? failed('not_found', `no page titled ${trimmed}`)
      : failed('unexpected_response', `API error ${String(answer.error.code)}`);
  }

  const parsed = answer.parse;
  if (
    parsed === undefined ||
    typeof parsed.title !== 'string' ||
    typeof parsed.revid !== 'number' ||
    typeof parsed.text !== 'string'
  ) {
    return failed('unexpected_response', 'the answer has no usable parse block');
  }

  return ok({
    title: parsed.title,
    revisionId: parsed.revid,
    url: `https://${request.language}.wikipedia.org/wiki/${encodeURIComponent(parsed.title.replaceAll(' ', '_'))}`,
    html: parsed.text,
  });
}
