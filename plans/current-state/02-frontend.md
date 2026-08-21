# Current state — frontend (`frontend/`)

Vite + React 18, **ES modules**. No state manager: state flows down as props
from `app/App.jsx`, except the preferences, which go through a context.

## The directories

| Directory | Role |
|---|---|
| `src/config.js` | Shared game constants (duration, scoring rules, palettes). |
| `src/lib/` | UI-free adapters: `api` (REST), `ws` (socket + subscription hook), `article` (the article model), `sound`. |
| `src/app/` | `App.jsx` — switches lobby ↔ game, owns the session. `SettingsContext.jsx` — player preferences, persisted in localStorage. |
| `src/components/ui/` | Reusable presentational atoms. |
| `src/features/*/` | One feature per directory: `lobby`, `game`, `items`, `waiting`, `chat`, `flag`, `leaderboard`, `debrief`. |
| `src/styles/` | One file per domain, imported by `main.jsx`. |
| `src/test/` | `setup.js` — jsdom stubs for the unit tests. |

## Three rules to hold

1. **No `window.*` to communicate between modules.** An older version passed
   the article through `window.WIKIFAKE_BODY` and the end of loading through
   `window.__waitingScreenReady`. Everything goes through props, contexts or
   imperative refs.

2. **The article is a single object**, built by `lib/article.js`:
   `{ title, subtitle, infobox, body, fakes, totalFakes }`. `body` is a list
   of blocks, each paragraph a list of segments (text, link, or clickable
   *token*).

   **`fakes` is empty during the round**: the client does not know which
   paragraphs are falsified. `withSolution(article, positions)` folds the
   correction received at the end back in and returns a new object — it does
   not mutate the original article.

3. **Game state does not live in the preferences.** The round phase
   (`playing` / `results`) is local React state of `GameSession`. The
   preferences context only contains what influences no rule: palette, expert
   mode, cursor and leaderboard display. A mockup panel used to host both,
   with a screen selector clickable mid-game.

## Checking the frontend

```bash
cd frontend
npm test        # units: hooks, article model, API calls, components
npm run build   # the modules link together
npm run smoke   # the components actually render (react-dom/server)
```

The smoke test catches what the build cannot see: a prop renamed on one side
of a feature boundary. It also contains **negative** assertions — no
sabotaged paragraph in the DOM during the round, no mockup panel, no fake
session label.
