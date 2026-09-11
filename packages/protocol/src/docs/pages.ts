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

/**
 * The routes no player's browser calls.
 *
 * The probes, and step F.5's cron. They are on their own page because the REST
 * page crossed the 200-line documentation limit when the cron was added, and
 * `docs.test.ts` says in as many words what happens then: the pages get split.
 *
 * This boundary rather than an arbitrary halving — *is there a browser at the
 * other end* — because it is the one that stays true as routes are added. A
 * split down the middle of a list has to be redone every time the list grows.
 */
const OPERATIONAL: readonly string[] = [
  '/ping',
  '/api/health',
  '/api/usage',
  '/api/cron/quests',
];

/**
 * The routes about the account rather than about the round.
 *
 * A **second** split, forced by the same limit: H.7 added `/api/shop/buy` and
 * the player page reached 212 lines. `docs.test.ts` says in as many words what
 * happens then, and the boundary is chosen on the same principle as
 * `OPERATIONAL`'s — *is this about playing, or about the person playing* —
 * because that is what stays true as routes are added.
 *
 * The shop and the quest claim are here rather than with the round for that
 * reason: neither happens while a round is running, and both are about what an
 * account has earned. A halving down the middle of the list would have to be
 * redone the next time one is added.
 */
const ACCOUNT: readonly string[] = [
  '/api/account/pseudonym',
  '/api/account/export',
  '/api/account/delete',
  '/api/account/region',
  '/api/account/cosmetics',
  '/api/shop/buy',
  '/api/quests/claim',
];

/** One section per route: its request, if it has a body, and its response. */
function routeSections(routes: typeof ROUTES): string[] {
  return routes.flatMap((route) => [
    `## \`${route.method} ${route.path}\``,
    '',
    ...(route.request === undefined
      ? []
      : ['**Request**', '', describeSchema(route.request), '']),
    '**Response**',
    '',
    describeSchema(route.response),
    '',
  ]);
}

/**
 * The counts are derived, and they are digits rather than words on purpose.
 *
 * The index page said "the nine REST routes" while there were twelve, and this
 * page said "Twelve routes" as the thirteenth was being added. A number written
 * by hand in prose is a number that goes stale silently, and the house style of
 * spelling them out is what made it easy to leave alone.
 */
export function restPage(): string {
  const round = ROUTES.filter(
    (route) => !OPERATIONAL.includes(route.path) && !ACCOUNT.includes(route.path),
  );

  return page(
    'REST — the round',
    [
      `${String(round.length)} routes a browser calls while a round is being`,
      'played. A `GET` takes no body. The account and the shop are in',
      '`rest-account.md`; the probes and the cron in `rest-operations.md`.',
    ],
    routeSections(round),
  );
}

export function accountPage(): string {
  const account = ROUTES.filter((route) => ACCOUNT.includes(route.path));

  return page(
    'REST — the account',
    [
      `${String(account.length)} routes about the account rather than the round:`,
      'the pseudonym, the export and the erasure, the region, the cosmetics and',
      'the shop. The round is in `rest.md`.',
    ],
    routeSections(account),
  );
}

export function operationsPage(): string {
  const operational = ROUTES.filter((route) => OPERATIONAL.includes(route.path));

  return page(
    'REST — probes and schedules',
    [
      `${String(operational.length)} routes with no browser at the other end: the`,
      'liveness and health probes, the spend report, and the quest cron. The',
      'routes a player calls are in `rest.md` and `rest-account.md`.',
    ],
    routeSections(operational),
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
      '| `rest.md` | the REST routes called while a round is played |',
      '| `rest-account.md` | the account, the cosmetics and the shop |',
      '| `rest-operations.md` | the probes, and the schedules |',
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
    'protocol/rest-account.md': accountPage(),
    'protocol/rest-operations.md': operationsPage(),
  };
}
