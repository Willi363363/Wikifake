// A round source that asks nobody anything.
//
// The step's criterion is "with the model and Wikipedia mocked", and this is
// what mocks them: a canned article, and a record of what was asked for. Every
// wire test that needs a round in progress uses it, so no test settles
// `article_ready` by hand any more — the pipeline does, which is the point of
// step 5.8.
import type { ArticleView, FalsifiedPosition } from '@wikifake/protocol';

import type { RoundOutcome, RoundRequest, RoundSource } from '../generation.js';

/** The round the wire tests play. Two paragraphs, one falsification. */
export const ARTICLE: ArticleView = {
  topic: 'Chat',
  paragraphs: ['Le chat dort seize heures par jour.', 'Sa vision nocturne est bonne.'],
  totalFakes: 1,
  wikipediaUrl: 'https://fr.wikipedia.org/wiki/Chat',
};

export const SOLUTION: readonly FalsifiedPosition[] = [
  {
    paragraphIndex: 1,
    falseInfoNumber: 1,
    falseStatement: 'Le chat dort seize heures par jour.',
    explanation: 'TRUTHMARKER-quatre-heures',
    hint: 'HINTMARKER-comptez',
  },
];

export interface StubSource extends RoundSource {
  /** Every request, in order. What the room asked for, and for whom. */
  readonly asked: RoundRequest[];
}

function recording(answer: (request: RoundRequest) => RoundOutcome): StubSource {
  const asked: RoundRequest[] = [];
  return {
    asked,
    open: (request) => {
      asked.push(request);
      return Promise.resolve(answer(request));
    },
  };
}

/** Answers every topic with the same round. */
export function canned(
  article: ArticleView,
  solution: readonly FalsifiedPosition[],
): StubSource {
  return recording(() => ({ ok: true, article, solution }));
}

/** C3.7 — answers nothing, whatever it is asked. */
export function refusing(): StubSource {
  return recording(() => ({ ok: false }));
}

/**
 * Refuses the first `count` topics and answers the rest.
 *
 * C3.7's actual shape: a topic nobody wrote about is followed by the next
 * candidate, and the round starts on whichever one works.
 */
export function refusingFirst(
  count: number,
  article: ArticleView,
  solution: readonly FalsifiedPosition[],
): StubSource {
  let refused = 0;
  return recording(() => {
    if (refused < count) {
      refused += 1;
      return { ok: false };
    }
    return { ok: true, article, solution };
  });
}

/** The default: one canned round, whatever is asked for. */
export const stubArticles = (): StubSource => canned(ARTICLE, SOLUTION);
