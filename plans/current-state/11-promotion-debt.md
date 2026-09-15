# Current state — promotion debt

The sixth debt register, and the one about **getting a batch from `staging` to
`main`**: the merge method, the graph it leaves behind, and the steps of the
documented procedure that cannot be run as written.

| Register | What goes in it |
|---|---|
| `05-known-debt.md` | defects and gaps with a `file:line` |
| `06-structural-debt.md` | the shape of the repository and its code |
| `08-toolchain-debt.md` | the commands you run, and what they do not tell you |
| `09-query-debt.md` | query plans: what is slow, at what size |
| `10-test-debt.md` | the suites themselves — why a green run can be wrong |
| this file | the promotion: its merge method, its graph, its last step |

**Split out of `08-toolchain-debt.md` on 2026-09-15**, which had reached the
200-line rule with a finding still to write — the same squeeze that moved the
suites out at J.9, answered the same way. What came here is everything about the
promotion; what stayed is everything about the commands around it.

## A promotion blocked by an already-merged commit

`03-infrastructure.md` has cited this entry since 2026-08-30. **It did not
exist**, which is its own small lesson about a register: a pointer is not a
record. Written on 2026-09-11, the evening it happened again and end to end.

**The symptom comes in two parts, and neither names the cause.** A promotion
pull request, green on every check including the three deploy probes, refused by
GitHub as `CONFLICTING`. Then the branch opened to unblock it — `main` merged
into `staging`, one conflicted file, resolved — refused by `Does this PR follow
the rules?` with `non-conforming subject: "Promote staging: the env loader
reaches the db commands (#179)"`, a commit nobody in that pull request wrote.

**The cause is a squash, six days earlier.** #179 was squashed into `main`
rather than merged, so `main` stopped being a descendant of `staging` and the
merge base fell back to `c81dc2f` — a hundred commits and a week away. Two
things follow: the promotion conflicts on the one file both branches have
touched since (`HANDOVER.md`), and the branch that realigns them carries
`main`'s own promotion commit into its range, where `checks.sh commit-range`
reads a subject written before the convention and refuses it.

**The check is right and was exempted in only one direction.** `is_promotion`
lets `staging → main` through — *"commit messages are already checked on PRs to
staging"* — and nothing said the same about the same commits travelling back.
That night's way out was the bypass `03-infrastructure.md` names: `gh pr merge
--admin` on a pull request whose diff is empty.

**A third time on 2026-09-14**, when #271 was squashed — and a fourth when the
realign that repaired it was squashed too, which keeps its empty diff and throws
away the parent that was the whole point.

**The second fix is in, and not the one predicted.** "Treat `main → staging` as
documented" keys on a head ref a realign branch has not got, so
`check_commit_range` reads `--first-parent` — what the branch wrote on its own
line. `--not origin/main` was tried and did nothing in CI, which leaves no such
ref. **The first is still free and unapplied**: *merge a promotion, never squash
it*.

## The promotion's last step is a push the guard refuses

Found on 2026-09-14, by doing it: #266 merged, and step 3 would not run.

`../method/01-git-flow.md` ends the promotion with `git switch staging && git
merge --ff-only origin/main && git push`. The merge is fine. The push is a
direct push to `staging`, so `.githooks/pre-push` hands it to
`scripts/checks.sh push staging`, whose `check_protected` answers
*"staging is protected: no direct commit or push, human or agent"*.

**The documented last step of the documented procedure cannot be run as
written.** `--no-verify` is what gets past it, and it is what was used; the push
is a fast-forward, so nothing is rewritten. It lands at all only because the
ruleset's `pull_request` rule on `staging` is advisory for the owner — the
bypass actor `../method/03-infrastructure.md` describes.

**An agent cannot do it even so**: `.claude/settings.json` denies
`git push origin staging:*`, and that deny list is the only thing that stops an
agent at all.

**Three ways out, and the last may be the right one.** Teach `checks.sh push` to
allow a push to `staging` whose sha is `origin/main` and is a fast-forward — the
realign and nothing else. Or write `--no-verify` into the procedure, which is
honest and teaches the wrong habit. Or drop the step: a *merged* promotion
leaves `staging` an ancestor of `main` already. The realign only ever repaired
what a squash broke, which is the entry above.

## The merge button chooses squash, and a title cannot stop it

Written on 2026-09-15, after the entry above cost five pull requests in a row
and the repair only landed when the button was taken out of the loop.

**The count, because the count is the argument.** Every one of these had the
right method in its own title, in bold, in its body, and above its diff:

| | PR | Method used | Result |
|---|---|---|---|
| the promotion | #271 | squash | `main` stops descending from `staging` |
| realign 1 | #273 | squash | an empty commit; graph unrepaired |
| realign 2 | #276 | squash | an empty commit; graph unrepaired |
| realign 3 | #279 | squash | an empty commit; graph unrepaired |
| realign 4 | #280 | **merge, from the CLI** | repaired |

Four empty commits sit on `staging` and none of them realigned anything. The
diagnosis each time was one line:

```bash
git rev-list --parents -1 origin/staging | wc -w   # 2 = one parent = squashed
git merge-base --is-ancestor origin/main origin/staging
```

**Why it keeps happening is not carelessness.** GitHub remembers the last merge
method used *per repository*, and squash is the **right** method for every other
branch here — track L's #269 became one clean commit that way, as the
merge-method table intends. So the default drifts back, on its own, towards the
one case where it is wrong, and it does so between two clicks that are days
apart.

**A realign is the worst possible thing to squash**, which is why it is where
this surfaces. Its diff is empty by construction — that is how you verify it
(`git diff origin/staging` after the merge). Flattening it keeps the nothing and
discards the second parent that was the entire payload. A squashed realign
therefore *looks* merged, passes every check, and changes nothing at all.

**The fix that worked** was not a better title. `gh pr merge <n> --merge` from
the command line, which does not consult the button's memory:

```bash
gh pr create --base staging --head chore/realign-… --title '…'
gh pr merge <n> --merge --delete-branch --admin
```

**The durable fix is a repository setting and it is the owner's to make**, in
*Settings → General → Pull Requests*: allow merge commits only, or keep squash
and disallow it where the base is `main` or `staging`. Nothing in the repository
can do it — `.claude/settings.json` denies an agent the ruleset and the `gh api`
write verbs, deliberately (`../method/03-infrastructure.md`). Until it is made,
**every promotion and every realign must be merged from the command line**, and
the procedure in `../method/01-git-flow.md` says so beside the table.

**What it costs to leave**: each drift is one broken graph, one conflicted
promotion — five files on 2026-09-14, measured — and a realign that then has to
survive the same button. The entry above is what that looks like from the
inside.
