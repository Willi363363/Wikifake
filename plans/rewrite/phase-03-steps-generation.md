# Phase 3 — steps: retrieval and falsification

> Steps 3.1 to 3.5. The phase sheet, its exit gate and where each step stands:
> `phase-03-article.md`. Cache and accounting: `phase-03-steps-cache.md`.

### ✅ 3.1 — Fixtures of real frozen Wikipedia pages

Freeze into the package the HTML of real Wikipedia pages, as today: at least
one case with duplicated paragraphs (mobile/desktop variants), one case with
inline tags (`un<b>deux</b>trois`), one case with short paragraphs. They
serve all the following steps.

The fixtures are the first paragraphs of real rendered pages, reduced to keep
them readable in a diff: every paragraph is byte-for-byte as MediaWiki served
it, with its revision recorded. The duplicated-variant case is constructed —
the `action=parse` output does not carry the mobile/desktop duplication — and
says so in the file.

**Done when**: the fixtures are committed and loaded by a first test.

### ✅ 3.2 — MediaWiki client, explicit language and user-agent

Search, page resolution without auto-suggestion, rendered HTML. The language
and the user-agent are **explicit parameters on every call**: today the
Python library carries global state, and the flag-report checker silently
queries Wikipedia in another language depending on call order. Wikipedia
page not found → clean failure, no exception.

Verified while writing it: `flag_verifier.py` never sets either global, so the
failure is not "depending on call order" but "English until the first game is
generated". Recorded as D13.

**Done when**: a test shows two successive calls in two different languages
with no leakage from one to the other, and a page not found produces a typed
failure value, not an exception.

### ✅ 3.3 — Paragraph collection with cheerio

Strict index parity: `paragraphs[i]` corresponds to the i-th collected `<p>`
node, and collection, text extraction and injection share the same node
references. Deduplication of variants, document order preserved, paragraphs
under 50 characters discarded. Spaces inserted between inline tags
("un deux trois") but punctuation not detached ("1889.", not "1889 .").

**Done when**: on every fixture, the index parity, deduplication and
whitespace normalisation tests pass.

### ✅ 3.4 — Falsification via structured output

Structured output from the AI SDK with a Zod schema. **`generateObject` is the
API this sheet was written against and it is deprecated** in the version now
installed: the SDK moved to `generateText` with `Output.object()`. Same
guarantee, different call — worth writing down, because the next reader would
otherwise reach for a deprecated function on the sheet's word.

This removes in one stroke the ~130 lines of parsing heuristics that are
business logic today:
stripping Markdown fences, falling back from the first `[` to the last `]`,
unwrapping an envelope object, all-or-nothing policy on indices, positional
fallback, partial retry. The prompt actually in use is carried over
verbatim; the dead prompt of `core/prompts.py` is not ported. The
1,000-character truncation of the originals sent to the model is **fixed**:
today it silently shortens the long paragraphs being served.

**Done when**: a malformed model output is rejected by the schema (mocked
model in test), and a test checks that a paragraph longer than
1,000 characters goes to the model whole and comes back whole in the
article.

### ✅ 3.5 — Injection and end-to-end parity

`positions` designates exactly the paragraphs the LLM modified.
`false_info_number` sequential from 1 to n, `positions` sorted by ascending
index, 1-based indices in the client contract. The generator is stateless:
two concurrent games do not mutate each other.

**Done when**: on fixtures, an end-to-end test (mocked model) checks that
each position designates a paragraph that differs from the original, and
only those; two concurrent generations exchange no state.
