// The four generated pages.
//
// Split by audience rather than by convenience: a client author reads what it
// may send, a server author reads what it must send, and neither needs the
// other. The 200-line documentation limit makes the split mandatory anyway.
import type { z } from 'zod';

import { ERROR_CODES } from '../errors.js';
import { ITEM_IDS } from '../items.js';
import { ROUTES } from '../rest/routes.js';
import { INCOMING_TYPES, incomingMessage } from '../ws/incoming.js';
import { OUTGOING_TYPES, outgoingMessage } from '../ws/outgoing.js';
import { describeSchema } from './render.js';

const WARNING = [
  '<!-- Generated from the Zod schemas in packages/protocol. Do not edit. -->',
  '<!-- Regenerate with: pnpm --filter @wikifake/protocol docs -->',
].join('\n');

function page(title: string, intro: readonly string[], body: readonly string[]): string {
  return (
    [WARNING, '', `# ${title}`, '', ...intro, '', ...body].join('\n').trimEnd() + '\n'
  );
}

/** One section per message, in the order the union declares them. */
function messageSections(
  union: z.ZodDiscriminatedUnion<readonly z.ZodObject[]>,
  types: readonly string[],
): string[] {
  return union.options.flatMap((option, at) => [
    `## \`${types[at] ?? '?'}\``,
    '',
    describeSchema(option),
    '',
  ]);
}

export function clientPage(): string {
  return page(
    'WebSocket — messages a client sends',
    [
      'Thirteen messages, one per entry of the dispatch table. Anything else is',
      'refused: the type is a closed union, so an unknown message is a rejection',
      'rather than a silence (C5.3).',
      '',
      'Why a field is shaped the way it is lives in the schemas themselves, and',
      'the departures from the current protocol in',
      '`../rewrite/phase-01-protocol-decisions.md`.',
    ],
    messageSections(incomingMessage, INCOMING_TYPES),
  );
}

export function serverPage(): string {
  return page(
    'WebSocket — messages the server sends',
    [
      'Fifteen messages. `game_end` is the only one that carries the solution',
      '(C1.2), and no round-start payload can represent it (C1.1).',
    ],
    messageSections(outgoingMessage, OUTGOING_TYPES),
  );
}

export function restPage(): string {
  return page(
    'REST — routes and payloads',
    ['Nine routes. A `GET` takes no body.'],
    ROUTES.flatMap((route) => [
      `## \`${route.method} ${route.path}\``,
      '',
      ...(route.request === undefined
        ? []
        : ['**Request**', '', describeSchema(route.request), '']),
      '**Response**',
      '',
      describeSchema(route.response),
      '',
    ]),
  );
}

export function indexPage(): string {
  return page(
    'The protocol',
    [
      'Generated from `packages/protocol`, which is the single source of every',
      'contract: one Zod schema per WebSocket message and per REST payload, and',
      'the TypeScript types inferred from those schemas rather than declared',
      'beside them.',
      '',
      'A test compares these files to what the schemas produce, so a contract',
      'that changes without its documentation fails CI (C8.2).',
    ],
    [
      '| Page | Contents |',
      '|---|---|',
      '| `websocket-client.md` | the thirteen messages a client may send |',
      '| `websocket-server.md` | the fifteen messages the server sends |',
      '| `rest.md` | the nine REST routes |',
      '',
      '## Error codes',
      '',
      'A closed union. Every rejection carries one, so a client can branch on it',
      'rather than on prose (C5.1).',
      '',
      ...ERROR_CODES.map((code) => `- \`${code}\``),
      '',
      '## Item identifiers',
      '',
      'A closed union too, which is what stops the client and the server from',
      'holding different lists (D8). What each item does is in',
      '`@wikifake/domain`; what it is called belongs to the interface.',
      '',
      ...ITEM_IDS.map((id) => `- \`${id}\``),
    ],
  );
}

/** Every page, keyed by the path it is committed at, relative to `plans/`. */
export function pages(): Readonly<Record<string, string>> {
  return {
    'protocol/README.md': indexPage(),
    'protocol/websocket-client.md': clientPage(),
    'protocol/websocket-server.md': serverPage(),
    'protocol/rest.md': restPage(),
  };
}
