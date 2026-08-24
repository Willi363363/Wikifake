import { z } from 'zod';
import { describe, expect, it } from 'vitest';
import { decode } from './decode.js';

const schema = z.object({ name: z.string().min(1), round: z.number().int() });

describe('decode', () => {
  it('returns the parsed value on a valid input', () => {
    const result = decode(schema, { name: 'ada', round: 2 });
    expect(result).toEqual({ ok: true, value: { name: 'ada', round: 2 } });
  });

  it('names every offending path rather than throwing', () => {
    const result = decode(schema, { name: '', round: 1.5 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues).toHaveLength(2);
    expect(result.issues[0]).toMatch(/^name: /);
    expect(result.issues[1]).toMatch(/^round: /);
  });

  it('reports a non-object input at the root', () => {
    const result = decode(schema, 'not a message');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues).toEqual([
      '(root): Invalid input: expected object, received string',
    ]);
  });

  // An issue text reaches the logs. A rejected payload can carry a session
  // token or a player's answer: the reason is reported, the value is not.
  it('never echoes the rejected value', () => {
    const result = decode(schema, { name: '', round: 'super-secret-token' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.join(' ')).not.toContain('super-secret-token');
  });
});
