// The exit gate of phase 1, checked rather than asserted in a review:
//
//   "No access to the clock, the network or the disk in `domain`: time is a
//    parameter, effects are data."
//
// It is the guarantee the whole package rests on. A single `Date.now()` in a
// reducer makes a round-end-by-timeout test take five minutes; a single
// `setTimeout` makes phase 5 unable to move the timer onto BullMQ; a single
// `Math.random()` makes a topic pick untestable. None of those breaks a test
// when it is introduced — which is exactly why this test exists.
//
// Tests are exempt: they read `backend/` and `frontend/` on purpose, to check
// the copies of the scale and the item list still agree.
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = fileURLToPath(new URL('./', import.meta.url));

/** Test harness, not a rule: it drives the reducer, it is not part of it. */
const NOT_RULES = new Set(['room/scenario.ts']);

function ruleFiles(): string[] {
  const found: string[] = [];
  const walk = (dir: string, prefix: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        walk(`${dir}${entry.name}/`, `${prefix}${entry.name}/`);
        continue;
      }
      if (!entry.name.endsWith('.ts') || entry.name.endsWith('.test.ts')) continue;
      if (NOT_RULES.has(`${prefix}${entry.name}`)) continue;
      found.push(`${prefix}${entry.name}`);
    }
  };
  walk(SRC, '');
  return found.sort();
}

/**
 * Comments talk about what the rules must not do — several say `Math.random()`
 * and `Date.now()` in order to explain why they are absent. Searching the source
 * as written would flag exactly the files that took the trouble to explain
 * themselves, so the prose comes out first.
 *
 * Only block comments and whole-line `//` are removed: a trailing comment
 * cannot hide code, and stripping past `//` would break a URL in a string.
 */
function withoutComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('//'))
    .join('\n');
}

/** Each pattern, and what it would cost. */
const FORBIDDEN: readonly (readonly [RegExp, string])[] = [
  [/\bfrom 'node:/, 'imports a Node built-in: the rules must run anywhere'],
  [/\bDate\.now\(\)/, 'reads the clock: time is a parameter'],
  [/\bnew Date\(/, 'reads the clock: time is a parameter'],
  [/\bperformance\.now\(\)/, 'reads the clock: time is a parameter'],
  [/\bMath\.random\(\)/, 'draws a number: the draw comes in as a seed'],
  [/\bsetTimeout\(/, 'schedules: a timer is an effect the caller arms'],
  [/\bsetInterval\(/, 'schedules: a timer is an effect the caller arms'],
  [/\bfetch\(/, 'reaches the network: I/O is an effect'],
  [/\bprocess\.env\b/, 'reads the environment: configuration is a parameter'],
];

describe('the rules are pure', () => {
  const files = ruleFiles();

  it('found the rule files', () => {
    expect(files.length).toBeGreaterThan(8);
  });

  it.each(files)('%s reaches for nothing outside itself', (file) => {
    const source = withoutComments(readFileSync(`${SRC}${file}`, 'utf8'));
    for (const [pattern, why] of FORBIDDEN) {
      expect(pattern.test(source), `${file} ${why}`).toBe(false);
    }
  });
});
