# Current state — the web application (`apps/web`)

Next.js 16, App Router, React 19. It serves the screens, the REST API, the
authentication and the indexing surface. It does **not** hold the socket: long
-lived WebSockets are `apps/realtime`'s, on a different host, for the reason
`04-deployment.md` gives.

## The routes

| Route | Kind | Role |
|---|---|---|
| `/` | static page | The front door. HTML 200 with a title, because C7.3 says so and a redirect answers neither |
| `/play` | screen | The entry: solo, host a room, or join one |
| `/room/[code]` | screen | The waiting room, then the round |
| `/solo` | screen | A solo round, from a topic to a score |
| `/gallery` | screen | Every design-system component, rendered — the audit of phase 6 |
| `/robots.txt`, `/sitemap.xml` | generated | C6.2, from `src/indexing.ts` |
| `/ping` | route | Exactly `{"status":"alive"}`. Load balancers read it |
| `/api/health` | route | The deployment identity, field by field. The API key is not a field |
| `/api/usage` | route | Model spend and cache efficiency, from `llmCall` |
| `/api/multiplayer/create` | route | A room code, capped at a 503 |
| `/api/game/start` | route | A solo round — **without the solution** |
| `/api/game/hint` | route | Buys a hint level, billed server-side |
| `/api/game/scan` | route | The SCANNER: the server names a paragraph |
| `/api/game/submit` | route | Grades, scores, and **delivers the solution** |
| `/api/flag-report` | route | A player reporting a genuine factual error |
| `/api/auth/*` | route | Better Auth's catch-all — the library owns those paths |

`src/route-parity.test.ts` walks `app/` and asserts these are exactly the
routes `protocol`'s catalogue describes, so a handler added without a schema
fails rather than shipping unvalidated. `/api/auth` is the one exemption, and
the test asserts the exemption still matches exactly one path.

## The route group, and why it exists

`/play`, `/room/[code]` and `/solo` live inside `app/(game)/` — parentheses, so
the group is not part of the URL. `(game)/layout.tsx` mounts two things Next
will therefore **not** unmount when a player moves between those screens:

- `RoomGate` → `RealtimeProvider`, which owns the socket. A provider that
  unmounted on navigation would reopen the connection on every screen, and the
  server would see a departure and an arrival it cannot tell from a flapping
  network — spending D5's grace window on a player who never left.
- `ChatDock`, one instance. The old stack mounted a chat in the lobby and
  another in the round, so the history died with the screen that held it. Here
  no screen owns it, and none has to remember to mount it.

## The features

| Directory | Role |
|---|---|
| `src/lobby/` | The entry screen, the waiting room, the topic vote, the host's settings |
| `src/waiting/` | Six minigames to fill the generation wait, and the launcher that finishes itself |
| `src/round/` | The round: the article, the tokens, hints, items, cursors, the live ranking, the debrief |
| `src/solo/` | The solo journey, over REST rather than a socket |
| `src/chat/` | One chat, mounted in the group layout |
| `src/flags/` | Reporting an error the game did not put there |
| `src/game/` | The server side of a round: start, hint, scan, submit, the cache, the accounting |
| `src/auth/` | Better Auth, its providers, and guests |
| `src/realtime/` | The client half of the socket: the provider, the gate, the endpoint, the session token |

Three notes on the round, which is where most of the frontend is:

- **The nickname and the room code are validated before any network call**,
  against the same `protocol` schemas the server refuses with. The old client
  checked `!username`, which passes for a 200-character name; the socket then
  opened, the server refused it, and the player was shown a closed connection
  instead of a reason.
- **The article is one object and the solution is not in it.** The correction
  received at the end is folded in as a *new* object rather than mutated into
  the old one, so nothing can read it early by holding a reference.
- **`Static` and the visual items are client-only and cut under
  `prefers-reduced-motion`.** A full-screen `createImageData` 25 times a second
  is a photosensitivity question, not a performance one.

## Server Components, and the leak they make possible

An object passed from a Server Component to a client one is **serialised into
the page**. So a leak does not appear as a field named `explanation`; it
appears as the sentence itself, somewhere in the markup, in a place no
component names.

That is why the browser assertions are by **value**: `apps/e2e/specs/`
searches the whole page — DOM and flight data — for markers the article
fixture stamps into the truth text, the explanations and the unpaid hints.
`leak.spec.ts` proves the assertion has teeth by deliberately leaking one and
watching it fail.

## Checking it

```bash
pnpm --filter @wikifake/web test        # 822 cases
pnpm --filter @wikifake/web typecheck
pnpm e2e                               # the browser journeys
```

`src/language.test.ts` scans every source under `src/` and `app/`, comments
stripped, for French function words: the interface is English and stays that
way until phase 11 makes French a real locale. The article keeps its own
`lang="fr"`, because it comes from `fr.wikipedia.org` and is data, not prose of
ours.
