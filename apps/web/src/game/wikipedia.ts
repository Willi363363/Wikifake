// Which Wikipedia this deployment reads, and how it introduces itself.
//
// `@wikifake/article` takes the language and the user agent as parameters on
// every call and refuses to default them — that is D13, the defect where the
// Python library's module globals made the flag checker query the *English*
// Wikipedia until the first game had been generated. So the values have to be
// decided somewhere, and the composition root is where they belong.
import type { WikiRequest, WikiTransport } from '@wikifake/article';

import { VERSION } from '../deployment.js';

/**
 * French, and it is not a setting.
 *
 * The topics players type, the article they read and the falsifications the
 * model writes are all French. A deployment reading another Wikipedia would be a
 * different game, not a configured one.
 */
export const WIKI_LANGUAGE = 'fr';

/**
 * How we identify ourselves to Wikimedia, whose policy asks for an application
 * and a way to reach whoever runs it.
 *
 * The version is the app's own, so a Wikimedia operator reading their logs can
 * tell which build is making the requests.
 */
export function wikiRequest(baseUrl: string): WikiRequest {
  return {
    language: WIKI_LANGUAGE,
    userAgent: `WikiFake/${VERSION} (educational fact-checking game; ${baseUrl})`,
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
