// Vérifie que le socle TypeScript reste strict. Relâcher une de ces options
// est une décision, pas un détail : ce test la rend visible en revue.
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

describe('socle TypeScript', () => {
  it.each(REQUIRED)('active %s', (option) => {
    expect(base.compilerOptions[option]).toBe(true);
  });
});
