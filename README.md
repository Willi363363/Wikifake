# WikiFake

**A game about spotting a lie in something that looks true.**

The server pulls a real article from Wikipedia. A language model rewrites a
few of its paragraphs — same tone, same style, same confident encyclopedic
voice, different facts. Then it hands you the article and tells you one thing
only: *how many* paragraphs it touched.

Finding them is the game.

## How a round plays

You read. That is most of it. The falsified paragraph does not look wrong —
it looks exactly as plausible as the others, because the same model wrote it
in the same register. What gives it away is a date that does not fit, a
consequence that does not follow, a name in the wrong decade.

When you think you have one, you mark it. The clock is running, the score
rewards precision over speed, and marking a paragraph that was authentic
costs you.

At the end the article opens up: every falsification is revealed, with what
the original actually said and what the model changed it to. You find out
which ones you caught, which you let through, and which you accused for
nothing.

## Alone, or against other people

**Solo** — pick a topic, or take one at random, and play against the clock.

**In a room** — up to a table's worth of players on the same article, each
seeing the others' cursors move through the text. You can watch somebody
hesitate over a paragraph. You can watch them mark the wrong one.

And you can interfere. **Items** are bought during the round and land on other
players: obscure their view, scramble what they are reading, hurry them.
Everything is resolved on the server, so an item that lands is an item that
was really paid for.

**Hints** work the other way — spend on yourself, narrow the search, take the
score penalty. The game will not sell you the same hint twice.

## The one rule the whole thing is built on

**The server is the only authority, and the solution never leaves it before
the round is over.**

Not obscured in the payload. Not sent and hidden by the interface. Not
present. What the browser receives is the article and a count — never which
paragraphs were touched, never the original text, never the explanations. The
score is computed server-side and the client is told the result.

It is the reason this project was rewritten from top to bottom, and the tests
that hold it are the ones nobody is allowed to delete.

## Where it runs

The game is live, in English and in French, on the web and on a phone. You can
play a full game without an account.

## Read next

| You want to… | Go to |
|---|---|
| **run it locally** | [`plans/current-state/07-local-setup.md`](plans/current-state/07-local-setup.md) |
| **understand the stack** | [`plans/current-state/`](plans/current-state/00-overview.md) — packages, web app, socket service, deployment |
| **contribute** | [`plans/method/`](plans/method/01-git-flow.md) — git flow, then the repository rules |
| **know what is being built now** | [`plans/product/00-overview.md`](plans/product/00-overview.md) |
| **know where the project stands** | [`plans/README.md`](plans/README.md) — the only file that says |
| **read the protocol** | [`plans/protocol/`](plans/protocol/README.md) — generated from the schemas |
| **know what must never break** | [`plans/rewrite/01-contract-to-preserve.md`](plans/rewrite/01-contract-to-preserve.md) |

All documentation lives in [`plans/`](plans/README.md). Agents read
[`CLAUDE.md`](CLAUDE.md), which restates the non-negotiable rules.

## In one paragraph, for the technically curious

A TypeScript monorepo — pnpm workspaces, Turborepo. Next.js for the app and
the REST surface, a separate WebSocket service for rooms, Postgres through
Drizzle, Redis for room state, Gemini for the falsifications. Two packages
hold every shared truth: `protocol` has the contracts as Zod schemas,
`domain` has the rules — scoring, grading, items, the room reducer. They exist
so that a client and a server can never disagree about what a message means.
The full picture is in [`plans/current-state/`](plans/current-state/00-overview.md).
