# Phase 6 — steps: the components

> Steps 6.2, 6.4, 6.5 and 6.6 — what is built out of the theme, and how it is
> shown. The phase sheet, its exit gate and where each step stands:
> `phase-06-design-system.md`. The stylesheet underneath:
> `phase-06-steps-stylesheet.md`.

### 6.2 — shadcn/ui primitives

The shadcn/ui primitives installed and dressed by the theme. They bring the
accessibility groundwork — roles, focus, keyboard — that the legacy
`<span onClick>` elements lack.

**Seven, chosen for what the current interface gets wrong**, not for
completeness: `Button` (`.btn`, `.btn.primary`, `.btn.ghost`, `.btn-icon`),
`Input` (`.expert-input`), `Label` — of which the current game has *none*, a
placeholder standing in for a name and vanishing the moment anything is typed —
`Badge` (`Chip`), `Separator` (`Divider`), `Progress` (`HairProgress`) and
`Dialog`. A primitive nothing will use is a primitive nobody maintains.

Five decisions taken while writing it:

- **`Dialog` is the reason this step is not decoration.** The current modals are
  a fixed `<div>` over an overlay `<div>`: focus walks out of them into the page
  behind, Escape does nothing, the overlay is a click target with no role, and a
  screen reader is told nothing happened. Radix answers all four, and none of
  them are worth writing again.
- **`Separator` is decorative by default — the opposite of Radix.** Its
  `decorative` defaults to false, so every hairline is announced. Most are a rule
  between two paragraphs, and a screen reader saying "separator" eleven times
  down a lobby is noise. Found by a test that asserted the behaviour the
  component's own comment claimed.
- **No icon library.** The dialog's dismiss is one drawn glyph with an
  `aria-label`; a dependency for it would be a dependency for one path.
- **React is a peer dependency.** Two copies of React in one page is the oldest
  bug in the ecosystem, and a design system that ships its own is how you get
  one.
- **Every primitive is a client component**, marked whether or not it needs to
  be today: one that grows a handler and forgets the directive fails at build
  time in the application, a long way from here.

The tests drive the components the way a player without a mouse would and read
the accessibility tree, not the class names — an assertion on
`class="rounded-full"` passes on a `<span>`, which is exactly what is being
replaced. Two of them assert what a hurried refactor removes first: the focus
ring is present, and no variant carries a raw hex.

**Done when**: the selected primitives are rendered in the gallery, in both
modes, focusable and operable with the keyboard.

### 6.4 — Paragraph token component

The component carrying the most CSS rules in the project. Its seven visual
states (`selected`, `edited`, `scanned`, `hinted`, `found`, `missed`,
`false-positive`) and their pseudo-element badges become a component with
variants (`cva`), not a cascade of global classes. And it becomes a real
interactive element: the token **is** the central gesture of the game, and
today it is a non-focusable `<span onClick>`. Role, visible focus, keyboard
activation.

**The unit is a paragraph**, which is a difference from the current game worth
stating plainly. The legacy token is a sentence-level `<span>` inside a
paragraph, with its own `data-token-id`; the protocol grades on
`paragraphIndex` and nothing else — `submit_answer` carries paragraph indices,
`scanner_result` answers with one, `game_position` stores one. That was decided
in phases 1 to 3, not here; this component is named for the unit the contract
actually has.

Five decisions taken while writing it:

- **A `<button>` while the round runs, a `<p>` once it is over.** The verdicts
  are not actions — the current stylesheet says as much with `cursor: default` —
  and a control that looks pressable and does nothing is worse than one that
  does not look pressable.
- **`aria-pressed`, because the gesture is a toggle.** Nothing in the current
  interface says whether a paragraph is marked to anyone who cannot see the
  wash. `edited` counts as pressed: a paragraph with a correction typed into it
  is a paragraph the player is accusing.
- **The badges are content, not `::before`/`::after`.** A pseudo-element's
  `content` is inconsistently exposed to assistive technology and cannot be
  translated at all — which is how `"🔎 INDICE"` came to be French text living
  inside a stylesheet. The glyph is `aria-hidden` decoration and the meaning is
  a word, supplied by a prop so phase 11 replaces it without touching the
  component.
- **The precedence is a function, not a cascade of `if/else` in a render.**
  `tokenStateFor` is where "a verdict replaces everything, then a correction,
  then a mark, then what was paid for" lives, and it is tested as arithmetic.
  It is presentation, not a rule: whether a marked paragraph counts as found is
  `gradeAnswer`'s, and the server's.
- **No colour-only verdicts.** `found` carries a tick, `missed` a bang, and
  `false-positive` keeps the current line-through. Three verdicts told apart by
  hue alone is three verdicts nobody colour-blind can tell apart, and a test
  asserts each carries something else.

Expert mode's inline input does **not** come with it. The current component
turns a marked token into an `<input>`, which is a screen's business rather than
a primitive's; the `edited` state is here, the editing is phase 8.

**Done when**: the seven states are rendered in the gallery, every variant
has its render test, and the token is reachable by tab and activated by
keyboard with a visible focus.

### 6.5 — Responsive

The package's components are built fluid, breakpoints defined in the theme.
There is a single media query in the whole project today.

**Done when**: the gallery displays without horizontal overflow or overlap
at 360 px as at 1280 px.

### 6.6 — Gallery and contrast audit

The component gallery is the phase deliverable: every component exported by
the package appears in it, in both modes. Contrast audit on that rendering.

**Done when**: the gallery renders all exported components and the contrast
audit passes in both modes.
