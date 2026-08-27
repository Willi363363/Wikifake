// C8.1 — the outbound catalogue equals what the server emits.
//
// The successor to `packages/protocol/src/ws/dispatch-parity.test.ts`, which
// held this line against `backend/src/realtime/*.py` and died with it in step
// 10.9. C8.2 says what happens when a guarantee is allowed to die with its
// subject: it disappears without a sound. So half of it moves here, and the
// other half stopped needing a test at all.
//
// **The inbound half is now structural, and that is the better outcome.** The
// Python had a `HANDLERS` dict that could drift from the documented list, which
// is why a test compared them. Here `frames.ts` decodes every frame with
// `incomingMessage` — the schema *is* the dispatch table — and the reducer in
// `@wikifake/domain` switches over the union with no `default` branch, so a type
// added to the schema and not handled is a **compile** error. A test would be
// weaker than what the types already refuse.
//
// The outbound half is not symmetrical, and this is the asymmetry: every message
// the server sends is typed `OutgoingMessage`, so it *cannot* emit a type the
// catalogue does not describe — the compiler holds that direction. What nothing
// holds is the other one: an entry in the catalogue that nobody sends. It
// documents a message, generates a page for it, and lies. That is what this
// file is for.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { OUTGOING_TYPES } from '@wikifake/protocol';

const HERE = dirname(fileURLToPath(import.meta.url));

/**
 * The two trees that build outbound messages.
 *
 * The reducer of `@wikifake/domain` constructs nearly all of them — it is where
 * a room decides what to say — and this service constructs the rest, the ones
 * that belong to the transport rather than to the game.
 */
const SOURCES = [HERE, join(HERE, '..', '..', '..', 'packages', 'domain', 'src')];

function sourcesIn(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    if (name === 'node_modules' || name === 'dist') return [];
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return sourcesIn(path);
    // Tests are excluded, or a type that only ever appears in a fixture would
    // count as emitted — which is exactly the lie being looked for.
    if (!name.endsWith('.ts') || name.includes('.test.')) return [];
    return [readFileSync(path, 'utf8')];
  });
}

/** Every `type: '...'` literal built in the two trees. */
function emittedTypes(): Set<string> {
  const found = new Set<string>();
  for (const source of sourcesIn(SOURCES[0] as string).concat(
    sourcesIn(SOURCES[1] as string),
  )) {
    for (const match of source.matchAll(/type: '([a-z_]+)'/g))
      found.add(match[1] as string);
  }
  return found;
}

describe('C8.1 — the outbound catalogue equals what the server emits', () => {
  // The way this test could pass while measuring nothing: a walk that reads no
  // file leaves an empty set, and every `expect(...).toContain` below fails
  // loudly rather than quietly — but the count is asserted anyway, because a
  // walk that read *one* file would not.
  it('actually read the sources', () => {
    expect(emittedTypes().size).toBeGreaterThan(10);
  });

  it('sends every message it documents', () => {
    const emitted = emittedTypes();
    // Named individually rather than as a set comparison: the failure then says
    // which entry is dead, instead of printing two lists.
    const unsent = [...OUTGOING_TYPES].filter((type) => !emitted.has(type));
    expect(unsent).toEqual([]);
  });

  it('documents fifteen, which is what the generated pages describe', () => {
    // The count is in `outgoing.test.ts` too, and deliberately: this one fails
    // when a message is added and forgotten here, that one when the union and
    // its fixtures disagree.
    expect(OUTGOING_TYPES).toHaveLength(15);
  });
});
