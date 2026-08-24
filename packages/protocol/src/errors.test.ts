import { describe, expect, it } from 'vitest';

import { ERROR_CODES, errorCode } from './errors.js';

describe('the error code union', () => {
  it('is closed', () => {
    expect(errorCode.options).toEqual([...ERROR_CODES]);
    expect(errorCode.safeParse('anything_else').success).toBe(false);
  });

  // The contract cites these five by name — C5.1, C5.2, C5.3, C1.7, C1.5. A
  // rename here silently breaks every reference in the contract, so the names
  // are asserted, not just their presence.
  it.each([
    ['room_not_found'],
    ['invalid_name'],
    ['name_taken'],
    ['bad_json'],
    ['not_host'],
    ['hints_blocked'],
  ])('keeps the contract code %s', (code) => {
    expect(errorCode.safeParse(code).success).toBe(true);
  });

  // These three are the errors the current server sends as a French sentence
  // with no code at all, which a client cannot branch on.
  it.each([['no_theme_submitted'], ['topic_not_found'], ['generation_failed']])(
    'gives %s a code of its own',
    (code) => {
      expect(errorCode.safeParse(code).success).toBe(true);
    },
  );

  it('has no duplicate', () => {
    expect(new Set(ERROR_CODES).size).toBe(ERROR_CODES.length);
  });
});
