// Which Wikipedia this service reads, and how it introduces itself.
//
// `@wikifake/article` takes the language and the user agent as parameters on
// every call and refuses to default them — that is D13, the defect where the
// Python library's module globals made the flag checker query the *English*
// Wikipedia until the first game had been generated. So the values have to be
// decided somewhere, and a composition root is where they belong.
//
// The language itself is not decided here: it is `WIKI_LANGUAGE`, in the package
// that reads Wikipedia. Two deployments each naming their own would be D13 with
// better manners.
import { WIKI_LANGUAGE, type WikiRequest, type WikiTransport } from '@wikifake/article';

import pkg from '../package.json' with { type: 'json' };

/**
 * How we identify ourselves to Wikimedia, whose policy asks for an application
 * and a way to reach whoever runs it.
 *
 * The version is this service's own, so a Wikimedia operator reading their logs
 * can tell which of the two deployments is making the requests.
 */
export function wikiRequest(baseUrl: string, endpoint?: string): WikiRequest {
  return {
    language: WIKI_LANGUAGE,
    userAgent: `WikiFake-realtime/${pkg.version} (educational fact-checking game; ${baseUrl})`,
    // Absent in every deployment; step 9.5's browser tests set it.
    ...(endpoint === undefined ? {} : { endpoint }),
  };
}

/**
 * The real network.
 *
 * Wrapped in an arrow rather than passed as `globalThis.fetch`: the reference
 * alone loses its receiver, which some runtimes reject outright.
 */
export const networkTransport: WikiTransport = {
  fetch: (input, init) => globalThis.fetch(input, init),
};
