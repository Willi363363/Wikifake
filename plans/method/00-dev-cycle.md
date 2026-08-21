# The development cycle

We move in **phases**, each phase cut into **steps**. Nothing happens outside
this structure: it is what lets someone — human or agent — open the repository,
read three files, and know exactly what to do.

## Why this structure

A project that moves by "tasks" scatters: everyone opens whatever piece of work
interests them, branches live for three weeks, and nobody knows what is
finished any more. A phase answers "where do we stand", a step answers "what do
I do now". Both are written before they are done.

For an agent, this structure replaces the context it does not have: the phase
file says what comes before, what comes after, and how to tell it is finished.

## Anatomy of a phase

A phase is a file in `plans/rewrite/`, named `phase-NN-<subject>.md`, always
containing the same sections:

| Section | Content |
|---|---|
| Header | state (to do / in progress / done), branch, phase it depends on |
| Goal | what the phase delivers, in three lines |
| Why now | the constraint that fixes its place in the order |
| Steps | the numbered list, each with its completion criterion |
| Exit gate | what must be true to close the phase |
| Invariants involved | pointer to `01-contract-to-preserve.md` |
| Pitfalls | what will go wrong, written in advance |

A phase has **one** umbrella branch. It never closes halfway: either its exit
gate is passed, or the phase is still in progress.

## Anatomy of a step

A step is numbered `NN.M` and fits in a paragraph. It says:

- **what we do** — at file level, not line level;
- **done when** — a verifiable criterion, not an impression. "The index parity
  tests pass" is a criterion; "the scraper works" is not.

A step fits in one branch and one pull request. If it needs more than two or
three commits, it was hiding two steps: split it again in the phase file
**before** continuing.

## The cycle, every time

1. Read `plans/README.md` to know which phase is in progress.
2. Open the phase file, pick the first step not yet done.
3. Create the branch (see `01-git-flow.md`).
4. Do the step, and nothing else.
5. `make check`, then the relevant tests.
6. Commit by logical unit, conventional message.
7. Update the branch from its target, open the pull request.
8. After the merge: tick the step in the phase file, **in the same PR as the
   work** if possible, otherwise immediately after.

## What "done" means

A step is done when, cumulatively:

- its completion criterion is verified;
- the tests that cover it exist and pass;
- `make check` is green;
- the documentation it touches is up to date — not "to update later";
- nothing was added out of scope.

Work that does not meet these five points is not done, even if it runs.

## When a step overflows

Three cases, three answers:

- **An unrelated bug turns up.** Record it in
  `plans/current-state/05-known-debt.md` and keep going. Do not fix it here.
- **The step was badly cut.** Stop, rewrite the steps in the phase file,
  resume. Rewriting the plan is part of the work.
- **A decision is missing.** Stop and ask. Guessing a structural decision costs
  more than waiting for an answer.

## Tracking progress

`plans/README.md` carries the table of phases and their state. It is the only
place that says where we stand: it is updated at every phase crossed. Step
checkboxes are ticked in the phase file.

No other tracking file. No `TODO.md`, no `NOTES.md` — they diverge within a
week and lie within two.
