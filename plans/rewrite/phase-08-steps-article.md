# Phase 8 — steps: the article, and what it costs to be told

> Steps 8.1 and 8.2 — the article on screen, and the hints bought against
> it. The phase sheet, its exit gate and where each step stands:
> `phase-08-frontend-round.md`. What happens during play:
> `phase-08-steps-play.md`. How a round ends: `phase-08-steps-end.md`.

### 8.1 — Article and paragraph selection

`GameSession` recomposed, `ArticleCard`, `ArticleBody`, `ArticleToken`,
`Brief`, `TopBar`, `Footer`, timer. `ArticleToken` becomes a focusable
interactive element (role, keyboard) — it is the central gesture of the
game. The CC BY-SA attribution ("deliberately altered text" + licence +
link) is visible during the round. Paragraph indexes in base 1, as in the
contract.

**Done when**: selection and deselection work by click and by keyboard, and
the negative assertion passes — no original text, no explanation, no
position in the DOM during the round.

Three notes on the component list, written when the step was done:

- **`ArticleToken` was delivered by 6.4, as `ParagraphToken`.** And the unit
  it marks changed with the protocol: `articleView` carries `paragraphs` as
  plain strings, so one paragraph is one token and the thing marked is its
  1-based number. The current game marks sub-paragraph spans and carries
  their falsification metadata in the client's own article model, which is
  the leak the negative assertion exists to catch — the new payload has no
  field that could carry it.
- **`ArticleBody` did not survive as a component.** It existed to walk a tree
  of blocks, paragraphs and segments; a list of strings does not need one.
- **`Footer` lost three of its four fields.** The current one shows a
  hard-coded `v2.0.1`, an always-green "Active" dot, and a session id a player
  can do nothing with. What is served is answerable at `/api/health`, which
  reports the actual commit.

The round is **one screen for solo and multiplayer**, which is what makes the
negative assertion worth writing once. What differs is the transport: a REST
response in one, `submit_answer` and `game_end` in the other.

### 8.2 — Hints

`IntelOverlay`, `HintLockedNotice`, `useHints` (`HintsPanel` is dead, it is
not ported). Levels are requested from the server and displayed as
received — monotonic, billed once. `useHints` no longer resets on
`totalFakes`, which only worked because `GameSession` was unmounted between
rounds: the key becomes the round identifier.

**Done when**: buying level 2 then requesting level 1 again displays level
2 without rebilling, and `hints_blocked` displays without a crash.
