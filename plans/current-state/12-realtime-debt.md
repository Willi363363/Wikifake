# Current state — the socket service

The sixth register, and the one about **the service that holds the rooms**: what
kills the process, what leaks, and what never comes back. What a frame *costs*
is in `09-query-debt.md`, beside the other measurements.

| Register | What goes in it |
|---|---|
| `05-known-debt.md` | defects and gaps with a `file:line` |
| `06-structural-debt.md` | the shape of the repository and its code |
| `08-toolchain-debt.md` | the commands you run |
| `09-query-debt.md` | query plans, and what a page load costs |
| `10-test-debt.md` | the suites |
| `11-promotion-debt.md` | the promotion |
| this file | `apps/realtime`: what stops it serving a room |

It was split out of `05-known-debt.md`, which had reached the 200-line rule with
these findings still to write — the same reason `09`, `10` and `11` exist. Every
entry was **reproduced** rather than reasoned about; the probe that did it is
described so it can be run again.

**Five of its seven entries are gone, and that is what a register is for.** The
review of 2026-09-16 found them; track O closed them the same day, each with a
test that fails without its fix, and the argument each one turned on is in
`../product/16-hardening-availability.md` rather than repeated here. A register
that kept fixed debt would stop being read, which is the whole reason there are
six of these files. What went:

| Closed | By |
|---|---|
| one malformed frame killed the process | O.1 |
| a socket closing mid-join was never forgotten | O.2 |
| a dropped Redis never came back | O.3 |
| nothing bounded a generation | O.4 |
| ten lost swaps told a player the room was gone | O.5 |

What is left below is what is still true.

**Both now belong to track P** (`../product/17-recovery.md`), which is the
decision track O refused to take in passing: each is answered by a screen, and
the sheet argues which screen before a line is written. They stay here until
the pull requests that close them remove them.

## The client retries for ever, once a second, with no backoff

`provider.tsx:169` — `retry.current = setTimeout(open, RETRY_MS)` with
`RETRY_MS = 1000`, no attempt cap and no growth. A service that is down is asked
again by every open tab, once a second, indefinitely.

On its own that is a decision one can defend. Beside the crash above it is an
amplifier: the instance restarts into every tab reconnecting at once.

## A tab with no nickname waits for ever, and says "en attente"

`room-gate.tsx:77` keys its effect on `[code]` alone. When `readNickname()`
answers null it sets the identity to null and, since the code does not change,
**never asks again**. The provider stays idle, the socket never opens, and
`room.tsx:206` renders a badge reading *"en attente"* with nothing to act on.

The nickname is in `sessionStorage`, which is per tab. Reaching this needs a
room URL opened in a tab that never went through `/play` — a second tab, or a
restored session. There is no share-a-link feature today, which is the only
reason it is rare; adding one would make it the first thing a guest meets.
