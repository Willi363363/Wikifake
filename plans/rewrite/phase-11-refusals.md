# Phase 11 — the sentences the packages author

The record of **step 11.9**. `phase-11-i18n.md` keeps the frame and the step
table — the only place that says where a step stands.

## What was wrong

`@wikifake/protocol` and `apps/realtime` write player-visible English —
`decode`'s issues in the chat, and the `message` beside every error code — and
it reached a French player unchanged. Step 11.2 could not fix it from where it
stood: the answer is not a catalogue entry in `apps/web`, it is that **a package
which authors a player-visible sentence emits a code the client translates**.

The protocol already sends one. `errorMessage` carries `code` and `message`, and
its own comment says the code is what a client branches on and the message what
it *may* show. So the client stops showing it: the code is translated from the
catalogue, and the message stays where a developer reads it.

**Done when**: every `ERROR_CODE` has a sentence in both catalogues, a test
holds the two lists to each other, a code from a newer server falls back to a
sentence rather than an identifier, and no screen prints a string the server
wrote.

**Done**, and the chat came with it: `read.issues[0]` was Zod's own English —
"String must contain at most 500 character(s)" — and the bound is now said by
the catalogue with `MAX_CHAT_LENGTH` passed into it, so the protocol still owns
the number and the client owns the sentence. `room.test.tsx`'s refusal case was
rewritten rather than deleted, and got stronger: it now asserts the server's
English is **not** on the screen.

## Why it was not step 11.2's to fix

11.2 moved every user-facing string in `apps/web` into the catalogue, and it
could not reach these: they are authored in two other packages, one of which
does not import a catalogue and never should. `06-structural-debt.md` recorded
it as **a decision rather than a defect** for exactly that reason — the fix
changes what those packages are allowed to put on the wire, which is not a
translation task.

## The rule this leaves behind

A package may author a sentence for a **developer** — a log line, a test
message, the `message` beside an error code. It may not author one for a
**player**. What reaches a player is a code, and the client says it in the
reader's language.

The catalogue's `errors.refusals` holds one sentence per code plus `unknown`,
and `refusal.test.tsx` holds the two lists to each other in both directions: a
code with no sentence fails, and a sentence with no code fails. The second half
matters as much as the first — an entry nobody sends is an entry nobody
maintains, and it reads as coverage.
