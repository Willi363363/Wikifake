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
export interface WikiRequest {
  /** A wiki language code: `fr`, `en`, `pt-br`. */
  readonly language: string;
  /** Something that identifies this application and a way to reach its owner. */
  readonly userAgent: string;
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
