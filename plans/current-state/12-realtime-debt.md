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

**Every entry it ever held is closed, and that is what a register is for.** The
review of 2026-09-16 found seven; track O closed five the same day and track P
closed the last two on 2026-09-17, each with a test that fails without its fix.
A register that kept fixed debt would stop being read, which is the whole reason
there are six of these files.

| Closed | By |
|---|---|
| one malformed frame killed the process | O.1 |
| a socket closing mid-join was never forgotten | O.2 |
| a dropped Redis never came back | O.3 |
| nothing bounded a generation | O.4 |
| ten lost swaps told a player the room was gone | O.5 |
| the client retried once a second, for ever, with no backoff | P.1, and P.2's screen |
| a tab with no nickname waited for ever on *en attente* | P.3 |

The argument each one turned on is in `../product/16-hardening-availability.md`
and `../product/17-recovery.md` rather than repeated here.

## Nothing is open

Written plainly rather than by deleting the file. `05-known-debt.md`,
`09-query-debt.md` and the three others name this register in their own tables,
and a reader who follows one of those pointers into nothing learns less than a
reader who arrives here and is told.

**An empty register is a claim about a date, not about the service.** Seven
entries were found in one afternoon of looking, by somebody reproducing each
one rather than reasoning about it, and every one of them was a failure the
comment directly above the code said was handled. The next seven are found the
same way — this file is where they go.
