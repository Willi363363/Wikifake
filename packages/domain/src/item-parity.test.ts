// D8 — the item identifiers exist three times, synchronised by hand.
//
// `backend/src/realtime/items.py` decides what to hand out;
// `frontend/src/features/items/catalog.js` decides how to draw it. Adding an
// item meant editing both, and forgetting one meant the client rendering an
// item it had no name for — which `itemDef` swallows by returning `{}`, so the
// failure is a blank card rather than an error anyone notices.
//
// The contract is now `ITEM_IDS` in `@wikifake/protocol`. This asserts the two
// existing copies still match it, for as long as they exist: the frontend one
// goes in phase 8, the Python in phase 10.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ITEM_IDS } from '@wikifake/protocol';

const REPO = fileURLToPath(new URL('../../../', import.meta.url));

function read(path: string): string {
  return readFileSync(`${REPO}${path}`, 'utf8');
}

/** The `"id": "X"` of every entry in the Python `ITEMS` list. */
function pythonIds(): string[] {
  const source = read('backend/src/realtime/items.py');
  return [...source.matchAll(/\{"id":\s*"([A-Z_]+)"/g)]
    .map((match) => match[1] as string)
    .sort();
}

/** The keys of `ITEM_DEFS` in the frontend catalogue. */
function frontendIds(): string[] {
  const source = read('frontend/src/features/items/catalog.js');
  const block = /export const ITEM_DEFS = \{([\s\S]*?)\n\};/.exec(source);
  if (!block?.[1]) throw new Error('ITEM_DEFS not found in catalog.js');
  return [...block[1].matchAll(/^\s{2}([A-Z_]+):/gm)]
    .map((match) => match[1] as string)
    .sort();
}

describe('the item identifiers agree', () => {
  // A regex that stops matching would compare two empty lists and pass.
  it('actually read both copies', () => {
    expect(pythonIds().length).toBeGreaterThan(10);
    expect(frontendIds().length).toBeGreaterThan(10);
  });

  it('the Python list matches the contract', () => {
    expect(pythonIds()).toEqual([...ITEM_IDS].sort());
  });

  it('the frontend catalogue matches the contract', () => {
    expect(frontendIds()).toEqual([...ITEM_IDS].sort());
  });
});
