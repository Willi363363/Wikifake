// The animation utilities have to be named somewhere a scanner can read them.
//
// The gallery builds its class from the animation's own name, which is what lets
// sixteen of them render from one component and is exactly what Tailwind cannot
// see: it reads source as text. The utilities are safelisted in `globals.css`,
// and this is what notices when an animation is added to the theme and left out
// of the safelist — where the failure is a card that sits still rather than an
// error.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { MOTIONS } from '@wikifake/ui';
import { describe, expect, it } from 'vitest';

const CSS = readFileSync(
  fileURLToPath(new URL('../globals.css', import.meta.url)),
  'utf8',
);

describe('6.3 — the animation utilities reach the build', () => {
  it.each(MOTIONS.map((motion) => motion.name))('safelists animate-%s', (name) => {
    expect(CSS).toMatch(new RegExp(`\\banimate-${name}\\b`));
  });

  // And nothing else: a name here that no animation answers to is a utility
  // Tailwind generates for nothing, and a sign the two lists have drifted.
  it('safelists nothing the theme does not define', () => {
    const inline = /@source inline\('([^']*)'\)/.exec(CSS)?.[1] ?? '';
    expect(inline.split(/\s+/).filter(Boolean).sort()).toEqual(
      MOTIONS.map((motion) => `animate-${motion.name}`).sort(),
    );
  });
});
