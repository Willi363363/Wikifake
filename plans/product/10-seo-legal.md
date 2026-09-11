# Track J — the privacy policy and the terms

The record of step J.3. `10-seo-and-legal.md` keeps the step table — the only
place that says where a step stands.

## The documents were written from the code, not from a template

Every claim on `/privacy` was read out of something: the schema in
`packages/db/src/schema/`, the export and deletion paths of E.7, `proxy.ts` and
`routing.ts` for the two cookies, `src/sentry.ts` for what a crash sends, and
`plans/current-state/04-deployment.md` for the four providers. A policy assembled
from a generator says what a generic site does; this one says what this one does,
which is the whole of J.3's exit condition.

What that produced, and what it is worth checking against when the code changes:

- **A guest is a row.** Playing without an account creates a `user` row marked
  anonymous, so the round belongs to something; the anonymous plugin deletes it
  when the player signs up, and the rounds follow.
- **Sessions hold an IP address and a user agent.** `session.ip_address` and
  `session.user_agent` are Better Auth's own columns. They are the least obvious
  thing this application stores and the policy names them.
- **A region is derived once**, from `x-vercel-ip-country` at the moment a
  profile is created, never refreshed, and overridable — G.1's own decision,
  stated as the player experiences it.
- **Sentry sends no PII**, because `initSentry` never sets `sendDefaultPii`. The
  policy says the option is off rather than claiming errors are anonymous.
- **The model receives the topic and the article, and no identity.** Nothing in
  the generation path passes a user id to Google.
- **Wikipedia is read server-side**, so a player's browser never touches it —
  worth saying, because most people assume the opposite.

## Deletion, as the code actually performs it

Checked rather than described: `user` cascades to `profile`, `session`,
`account`, `player_stats`, `coin_movement`, `quest_assignment` and the admin
row; `participant` and `leaderboard_entry` are `set null`, and `deleteAccount`
first rewrites `participant.guest_name` to a **random** placeholder — one per
deletion, so two deleted players in one room do not read as the same person.
G.4's board queries drop an entry with no owner, so a deleted account leaves the
leaderboards. All of that is on the page in two sentences.

## The gap the audit found: the export is older than three tracks

`exportAccount` returns the account, the profile, the statistics, the games and
the reports. It was written in E.7, before F, G and H existed, so **coins, quest
assignments, hint purchases, item uses and leaderboard entries are not in the
file** a player downloads.

That is a right of access that is partly unimplemented, and a policy promising
"a copy of your data" would have been the first false sentence on the page. Two
consequences, both deliberate:

- the policy said what the file actually contained, and said plainly that coins
  and quests were not in it yet;
- **step J.11** is filed to close it. Fixing it here would have been the
  out-of-scope work `02-repository-rules.md` forbids, and it is a query change
  with its own tests.

**J.11 closed it**, and the policy sentence above changed with it: the export
now carries the coins, the quests, the boards, the hints and the items, and
`EXPORT_COVERAGE` holds the next table somebody adds to being decided about.

## The decisions

**Indexable, unlike every other route this effort has added.** `/profile`,
`/quests`, `/shop` and the rest are `noindex` because they are one player's.
These two are addressed to anybody, and are the only pages somebody may come
looking for *from outside the site* — from a search, from a complaint form, from
a note made months ago. They are in `INDEXABLE_ROUTES`, so they are in the
sitemap in both locales.

**In the shared footer**, beside the language switch that step 11.3 put there
for the same reason: a document has to be reachable from wherever the reader is,
and somebody who wants to know what is stored about them is most likely to want
it while playing. `Link` from `navigation.ts`, so a French reader gets `/fr/privacy`.

**On the reading sheet.** The direction exempts the surface being *read* from
the brutalist grammar, and a policy is nine paragraphs somebody has to get
through. A policy in a 3px box with a yellow fill is a policy nobody reads —
which is a failure mode a privacy policy has quite enough of already.

**One contact constant, and no address in the catalogue.** `LEGAL_CONTACT` is
read by both documents in both languages, and a test asserts no `@` appears in
either catalogue: an address spelled four times is an address that will disagree
with itself in one of them.

**The section order lives in code**, not in the catalogue. `Object.keys` on a
message file is an order that depends on how somebody saved it, and the order of
a legal document is part of the document.

## The two things this step cannot finish on its own

- **The contact address is a placeholder.** `privacy@wikifake.invalid` —
  `.invalid` is reserved by RFC 2606 precisely so a placeholder cannot be
  somebody's real inbox. The owner has not settled which address to publish.
  **J.3 stays 🔶 until it is replaced**, because a policy that cannot be replied
  to fails the obligation it exists to meet.
- **Nobody has read this as a lawyer.** It was written to be accurate about the
  system, which is the part a repository can hold; whether it is *sufficient* is
  a judgement no test makes. It belongs in the same queue as the French
  catalogue's human review, `phase-11-i18n.md`.
