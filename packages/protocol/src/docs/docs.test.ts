// C8.2 — the documentation lock, from the new stack.
//
// `test_architecture_doc.py` holds this line today with regexes over
// hand-written Markdown, and it dies with the Python. Here the document is
// generated from the schemas and compared to what is committed: a contract that
// changes without its documentation fails, and the documentation cannot describe
// a protocol that does not exist.
//
// To regenerate after a deliberate change:
//
//     pnpm --filter @wikifake/protocol docs
//
// which is `vitest run src/docs -u` — the same comparison, writing instead of
// failing.
import { describe, expect, it } from 'vitest';

import { pages } from './pages.js';

const PLANS = new URL('../../../../plans/', import.meta.url).pathname;

describe('the generated protocol documentation', () => {
  const generated = pages();

  it('covers the four pages', () => {
    expect(Object.keys(generated).sort()).toEqual([
      'protocol/README.md',
      'protocol/rest.md',
      'protocol/websocket-client.md',
      'protocol/websocket-server.md',
    ]);
  });

  it.each(Object.entries(generated))(
    'matches what is committed at %s',
    async (path, content) => {
      await expect(content).toMatchFileSnapshot(`${PLANS}${path}`);
    },
  );

  // The repository allows no documentation file over 200 lines, and a generated
  // file is no exception: a message added to the protocol has to fit, or the
  // pages have to be split again.
  it.each(Object.entries(generated))(
    'keeps %s under the documentation limit',
    (_path, content) => {
      expect(content.split('\n').length).toBeLessThanOrEqual(200);
    },
  );

  it.each(Object.entries(generated))(
    'ends %s with a single newline',
    (_path, content) => {
      expect(content.endsWith('\n')).toBe(true);
      expect(content.endsWith('\n\n')).toBe(false);
    },
  );
});
