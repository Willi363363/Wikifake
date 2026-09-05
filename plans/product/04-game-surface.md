# Track D — the game surface

| | |
|---|---|
| **State** | ⬜ not started |
| **Branch** | `feat/game-surface` |
| **Depends on** | track B |
| **Delivers** | lobby, waiting room, round and debrief on the new direction |

## Objective

Apply the direction to the screens that already work. Phases 7 and 8 built
them and the browser journeys cover them; this track changes how they look,
and **must not change what they do**.

## The rule that keeps this track cheap

**No behaviour changes here.** Not a route, not a message, not a state
machine, not a scoring rule. If a screen needs a behavioural change to look
right, that change is recorded in `plans/current-state/05-known-debt.md` and
handled in its own pull request.

The reason is the safety net: `apps/e2e` covers these journeys, including the
four-player room of step 8.9 and the two accessibility journeys of #153. A
purely visual track keeps that suite meaningful as a regression check — every
journey must still pass, unchanged. The moment behaviour moves in the same
commit, a failing journey stops telling you which of the two broke it.

## What each screen becomes

| Screen | Treatment |
|---|---|
| Lobby | Full chassis: flat fills, 3px borders, offset shadows, bold display |
| Waiting room | Chassis, and the six fillers get the loudest treatment on the site |
| Round — chrome | Chassis: timer, score, item bar, cursors |
| Round — article | **The reading sheet.** Calm, wide measure, no ornament |
| Paragraph token | Calm at rest; hard border and offset shadow when marked |
| Debrief | Chassis, verdict chips as flat fills with ink text |

The round is the whole point of the exemption in `01-art-direction.md`: its
chrome is loud, and the thing being read sits quiet in the middle of it.

## The negative assertions are sacred here

`plans/method/02-repository-rules.md` says it and this track is where it gets
tested: the tests that verify the solution never reaches the client are not
touched, not skipped, not "temporarily" relaxed to get a styling branch green.
A restyle has no business near them, so if one goes red, the restyle broke
something real.

## Steps

| # | Step | State |
|---|---|---|
| D.1 | Lobby and the way in | ⬜ |
| D.2 | Waiting room, and the fillers | ⬜ |
| D.3 | Round chrome — timer, score, items, cursors | ⬜ |
| D.4 | The article on the reading sheet | ⬜ |
| D.5 | Paragraph token states, marked and revealed | ⬜ |
| D.6 | Debrief and ranking | ⬜ |
| D.7 | Error pages and the 404, on the direction | ⬜ |
| D.8 | Phone pass — every screen at 360px | ⬜ |

## Exit gate

- Every `apps/e2e` journey passes, unchanged. No journey edited to fit a new
  layout without saying so in the pull request and justifying it.
- Contrast audit still green; no new pair introduced that fails.
- Keyboard: a full solo game start to debrief, and a paragraph marked, without
  a mouse.
- `prefers-reduced-motion`: every screen usable, no information lost.
- **The debrief is readable with every fill rendered grey.** FOUND, MISSED and
  WRONGLY MARKED always carry their word — `01-palette.md` measured `green`
  and `warn` close enough in luminance that colour alone will not separate
  them for a deuteranope, and no hue choice fixes that.
- **A screenshot of the landing hero and one of a round, side by side, read as
  the same product.** Handed over from track A, which could not perform it
  before anything was drawn. It is the check no test can run.
- Nothing behavioural in the diff — no route, message, reducer or score.
