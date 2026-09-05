# Track D — the game surface

| | |
|---|---|
| **State** | ✅ done — every screen on the direction, 24 journeys unchanged |
| **Branch** | `feat/gs-fills-not-text` |
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
| D.1 | Lobby and the way in | ✅ |
| D.2 | Waiting room, and the fillers | ✅ |
| D.3 | Round chrome — timer, score, items, cursors | ✅ |
| D.4 | The article on the reading sheet | ✅ |
| D.5 | Paragraph token states, marked and revealed | ✅ |
| D.6 | Debrief and ranking | ✅ |
| D.7 | Error pages and the 404, on the direction | ✅ |
| D.8 | Phone pass — every screen at 360px | ✅ |

## What the sweeps could not see, and what found it

The bulk of this track was pattern-driven: `text-<fill>`, `border border-line`,
`rounded-*`, `font-semibold`, `ring-accent`. Thirty-two places used a fill as a
text colour, all of them passing in the dark palette and none of them in the
light one — `apps/web/src/fills.test.ts` records the measurements and guards
the thirty-third.

A pattern finds what is *wrong by pattern*. What closed the track was opening
the screens in a browser, in both palettes, at 1280 and at 360, and the four
things that came back were each spelled in a way no scan of ours reached:

- **A shadow with nothing casting it.** The round's `Report an error` was a
  `ghost` button — transparent border, transparent fill — with `shadow-md`
  bolted on from the call site. It drew a black bracket floating beside the
  words, and the ghost variant has no collapse, so hover left it there.
- **A width and a hue written on different lines.** Eight places spelled
  Tailwind's 1px `border` in the base classes and `border-line-strong` in the
  variant, so a scan for `border border-line` matched none of them and the
  screens drew black hairlines: the intel targets, the item bar, the two
  pickers, the items switch, and three of the six fillers.
- **A hover that says the opposite.** The item bar rose a pixel and *gained* a
  shadow — the previous identity's lift, and this direction floats nothing.
- **A colour that never names a token.** `player-cursors.tsx` drew every
  rival's name as `text-white` over `style={{ background: cursor.colour }}`,
  which is the one hard colour rule broken in the one spelling no scanner here
  can read. The colour is `PLAYER_COLOURS`, server data, eight hues, half light
  and half dark — so no single text colour passes on it. The colour is a swatch
  now and the name is `ink` on `surface`.

`fills.test.ts` gained a scan for each of the four. What it cannot gain is the
looking, and that is the honest lesson of the track.

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

### How it was met

All twenty-four journeys pass unchanged, `CONTRAST_PAIRS` is untouched and its
forty ratios still measure. A solo game was played start to debrief from the
keyboard alone — four tabs to the topic, four to the first paragraph, Enter to
mark it, one shift-tab to Submit — and the two `prefers-reduced-motion`
journeys of #153 cover the preference. The screens were walked in a browser in
both palettes at 1280 and at 360.

Two of the gates are met differently from how they were written, and the
difference is worth stating rather than papering over:

- **Grey.** The debrief survives it, but not because the tokens carry their
  word: the article is the reading sheet, and a word on the corner of a
  paragraph is ornament on the one surface the direction exempts. What carries
  in grey is the glyph's *shape* — ✓, !, a strike-through — plus the score
  card, which names `Found`, `Wrongly marked` and `Let through` in full with
  their counts. The word is in the token's `sr-only` label, and the rendered
  greyscale debrief was read to confirm it.
- **The side by side.** The landing and a round do read as the same product —
  same ground, same yellow with the same hard offset, same face. It is a
  weaker check than track A meant, because the landing is still the pre-track-C
  page: the scroll scene that will carry the comparison has not been drawn.
  Track C inherits it.
