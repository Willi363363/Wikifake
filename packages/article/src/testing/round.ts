// A round any suite can produce without a network and without a model.
//
// Here rather than in an application, because both of them need it: the solo
// route generates a round and so does the realtime service (step 5.8), through
// the very same `sourceArticle`. The fixtures below decide what the solution
// looks like — which paragraphs are falsified, which hint belongs to which
// number — and two copies drifting would make two suites disagree about the same
// round while both passed.
//
// The markers are unique strings. Searching for one in a serialised payload is
// what makes a "by values" assertion real: a substring check against natural
// French prose passes by accident.
import type { WikiTransport } from '../mediawiki.js';
import { MockLanguageModelV4 } from 'ai/test';

export const TRUTH = 'TRUTHMARKER-le-chat-dort-seize-heures';
export const HINT = 'HINTMARKER-comptez-les-heures';
export const ORIGINAL = 'ORIGINALMARKER';

/**
 * Three paragraphs, each past the hundred characters a paragraph needs to be
 * worth falsifying. The mocked model falsifies every one it is offered, so the
 * round has exactly three fakes, at paragraphs 1, 2 and 3.
 */
export const PARAGRAPHS = [
  `${ORIGINAL}-1 Le chat est un mammifère carnivore de la famille des félidés, domestiqué depuis plusieurs milliers d'années par l'être humain.`,
  `${ORIGINAL}-2 Il dort en moyenne seize heures par jour, réparties en de nombreuses siestes courtes tout au long de la journée et de la nuit.`,
  `${ORIGINAL}-3 Sa vision nocturne est excellente, mais il distingue mal les couleurs, en particulier les nuances situées dans le rouge.`,
];

export const HTML = `<div id="bodyContent">${PARAGRAPHS.map(
  (text) => `<p>${text}</p>`,
).join('')}</div>`;

export const SEARCH = { query: { search: [{ title: 'Chat' }] } };
export const PAGE = { parse: { title: 'Chat', revid: 238_196_699, text: HTML } };

/** A transport that answers the search, then the page, then repeats the page. */
export function wikipedia(answers: readonly unknown[]): WikiTransport {
  let at = 0;
  const fetch: typeof globalThis.fetch = () => {
    const body = answers[Math.min(at, answers.length - 1)];
    at += 1;
    return Promise.resolve(
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  };
  return { fetch };
}

/**
 * A model that falsifies every paragraph it is offered, stamping the markers.
 *
 * The index it was handed goes into all three fields, so a hint that belongs to
 * a different falsification is visible rather than plausible.
 */
export function falsifier(): MockLanguageModelV4 {
  return new MockLanguageModelV4({
    doGenerate: (options) => {
      const sent = JSON.stringify(options.prompt);
      const offered = [...sent.matchAll(/paragraph_index\\?":\s*(\d+)/g)].map((match) =>
        Number(match[1]),
      );
      return Promise.resolve({
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              falsifications: offered.map((index) => ({
                paragraphIndex: index,
                swappedText: `FAUX-${String(index)} le chat dort quatre heures par jour selon les études les plus récentes.`,
                explanation: `${TRUTH}-${String(index)}`,
                hint: `${HINT}-${String(index)}`,
              })),
            }),
          },
        ],
        finishReason: { unified: 'stop' as const, raw: undefined },
        usage: {
          inputTokens: {
            total: 500,
            noCache: 500,
            cacheRead: undefined,
            cacheWrite: undefined,
          },
          outputTokens: { total: 90, text: 90, reasoning: undefined },
        },
        warnings: [],
      });
    },
  });
}

/** A model that refuses. C4.5 — the call still happened and still costs. */
export function refuser(): MockLanguageModelV4 {
  return new MockLanguageModelV4({
    doGenerate: () => Promise.reject(new Error('the model is unreachable')),
  });
}
