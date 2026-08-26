// The two upstreams, answered locally.
//
// "No real LLM call: article served from a fixture, fake key as today" — so
// neither Wikipedia nor the model is reached during a browser run. What makes
// that possible without a seam in the application is that both are addresses:
// `WIKIPEDIA_API_URL` and `MODEL_BASE_URL` point here, and every other line of
// the request path is the one production takes.
//
// The fixtures are `@wikifake/article/testing`, the same ones the unit suites
// use. That matters for more than economy: they stamp unique markers —
// `ORIGINALMARKER`, `TRUTHMARKER-…`, `HINTMARKER-…` — into the original text,
// the explanations and the hints, which is what lets a browser assert "none of
// the solution is in this page" by **value** rather than by field name.
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

import { PAGE, PARAGRAPHS, SEARCH } from '@wikifake/article/testing';

/** The port the two applications are pointed at. */
export const UPSTREAM_PORT = 4319;

/** What the mocked model answers with, for the paragraphs it is offered. */
export const FALSE_TEXT = (index: number): string =>
  `FAUX-${String(index)} le chat dort quatre heures par jour selon les études récentes.`;

function readBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let body = '';
    request.on('data', (chunk: Buffer) => (body += chunk.toString('utf8')));
    request.on('end', () => {
      resolve(body);
    });
  });
}

function json(response: ServerResponse, body: unknown): void {
  response.writeHead(200, { 'content-type': 'application/json' });
  response.end(JSON.stringify(body));
}

/**
 * The falsification the model "returns".
 *
 * Every paragraph it is offered, so the round has three falsifications at
 * paragraphs 1, 2 and 3 — the same shape `@wikifake/article/testing`'s own
 * falsifier produces, and the same markers.
 */
function falsified(prompt: string): unknown {
  const offered = [...prompt.matchAll(/paragraph_index\\?":\s*(\d+)/g)].map((match) =>
    Number(match[1]),
  );
  const numbers = offered.length > 0 ? offered : PARAGRAPHS.map((_text, at) => at + 1);

  return {
    falsifications: numbers.map((index) => ({
      paragraphIndex: index,
      swappedText: FALSE_TEXT(index),
      explanation: `TRUTHMARKER-${String(index)} en réalité il en dort seize.`,
      hint: `HINTMARKER-${String(index)} comptez les heures.`,
    })),
  };
}

/** A Gemini `generateContent` answer carrying that JSON as its only part. */
function asModelAnswer(payload: unknown): unknown {
  return {
    candidates: [
      {
        content: { parts: [{ text: JSON.stringify(payload) }], role: 'model' },
        finishReason: 'STOP',
      },
    ],
    usageMetadata: {
      promptTokenCount: 100,
      candidatesTokenCount: 100,
      totalTokenCount: 200,
    },
  };
}

export function upstream() {
  return createServer((request, response) => {
    const url = new URL(request.url ?? '/', `http://localhost:${String(UPSTREAM_PORT)}`);

    // MediaWiki: the search, then the page. Both from the frozen fixture.
    if (url.pathname === '/w/api.php') {
      json(response, url.searchParams.get('action') === 'parse' ? PAGE : SEARCH);
      return;
    }

    // The model. One shape of request, and the prompt is all that is read.
    if (url.pathname.includes(':generateContent')) {
      void readBody(request).then((body) => {
        json(response, asModelAnswer(falsified(body)));
      });
      return;
    }

    response.writeHead(404, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ error: `nothing here: ${url.pathname}` }));
  });
}

// Started as a process by Playwright's `webServer`, which is why this file is
// both a module and a script.
if (process.argv[1]?.endsWith('serve.ts') === true) {
  upstream().listen(UPSTREAM_PORT, () => {
    process.stdout.write(`upstream on ${String(UPSTREAM_PORT)}\n`);
  });
}
