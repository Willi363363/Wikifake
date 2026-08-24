// The step asks that "every message of the dispatch table has its schema". This
// checks it against the table itself rather than against a reading of it.
//
// It reproduces, for the new stack, the half of C8.1 that covers the protocol:
// today `backend/tests/test_architecture_doc.py` asserts that the documented
// inbound messages **equal** the dispatch table and that every documented
// outbound message is actually emitted. That test is regex-based Python and
// dies with the Python (C8.2) — this one holds the same line from the other
// side, while the two stacks run side by side.
//
// Phase 10 deletes `backend/` and therefore deletes this file. That is the
// point: the guarantee must not outlive its subject in silence, and a missing
// file failing loudly is how the removal gets noticed.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { INCOMING_TYPES } from './incoming.js';
import { OUTGOING_TYPES } from './outgoing.js';

const REPO = fileURLToPath(new URL('../../../../', import.meta.url));

function read(path: string): string {
  return readFileSync(`${REPO}${path}`, 'utf8');
}

/** The keys of the `HANDLERS` dict: the dispatch table, verbatim. */
function dispatchTable(): string[] {
  const source = read('backend/src/realtime/handlers.py');
  const table = /HANDLERS: dict\[str, Handler\] = \{([\s\S]*?)\n\}/.exec(source);
  if (!table?.[1]) throw new Error('HANDLERS table not found in handlers.py');
  return [...table[1].matchAll(/^\s*"([a-z_]+)":/gm)]
    .map((match) => match[1] as string)
    .sort();
}

/** Every `{"type": "..."}` the realtime layer actually sends. */
function emittedTypes(): string[] {
  const sources = [
    'backend/src/realtime/handlers.py',
    'backend/src/realtime/broadcast.py',
    'backend/src/realtime/themes.py',
    'backend/src/realtime/items.py',
    'backend/src/realtime/ws.py',
  ].map(read);
  const found = new Set<string>();
  for (const source of sources) {
    for (const match of source.matchAll(/"type":\s*"([a-z_]+)"/g))
      found.add(match[1] as string);
  }
  return [...found].sort();
}

describe('the inbound catalogue equals the dispatch table', () => {
  // Guard against the way this test could pass while measuring nothing: a
  // regex that stops matching turns both sides into empty lists.
  it('actually read the table', () => {
    expect(dispatchTable().length).toBeGreaterThan(10);
  });

  it('covers every entry, and invents none', () => {
    expect([...INCOMING_TYPES].sort()).toEqual(dispatchTable());
  });
});

describe('the outbound catalogue equals what the server emits', () => {
  it('actually read the emissions', () => {
    expect(emittedTypes().length).toBeGreaterThan(10);
  });

  it('covers every emitted message, and invents none', () => {
    expect([...OUTGOING_TYPES].sort()).toEqual(emittedTypes());
  });
});
