// Verifies that the TypeScript baseline stays strict. Relaxing one of these
// options is a decision, not a detail: this test makes it visible in review.
import { describe, expect, it } from 'vitest';
import base from '../tsconfig.base.json' with { type: 'json' };

const REQUIRED = [
  'strict',
  'noUncheckedIndexedAccess',
  'exactOptionalPropertyTypes',
  'noImplicitOverride',
  'noFallthroughCasesInSwitch',
  'noUnusedLocals',
  'noUnusedParameters',
  'verbatimModuleSyntax',
  'isolatedModules',
] as const;

describe('TypeScript baseline', () => {
  it.each(REQUIRED)('enables %s', (option) => {
    expect(base.compilerOptions[option]).toBe(true);
  });
});
