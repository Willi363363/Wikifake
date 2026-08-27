import { describe, expect, expectTypeOf, it } from 'vitest';
import { decode } from '@wikifake/protocol';
import { emit, settle, type Reducer } from './reducer.js';

type Phase = 'lobby' | 'round';
type Effect = { readonly kind: 'arm_timer'; readonly seconds: number };

describe('reducer results', () => {
  it('settles a transition with no effect', () => {
    expect(settle<Phase, Effect>('lobby')).toEqual({ state: 'lobby', effects: [] });
  });

  it('carries the effects a transition asks for', () => {
    expect(emit<Phase, Effect>('round', { kind: 'arm_timer', seconds: 300 })).toEqual({
      state: 'round',
      effects: [{ kind: 'arm_timer', seconds: 300 }],
    });
  });

  // The signature is the contract of steps 1.8 and 1.9: a rule is a function
  // of (state, event), and nothing else. A reducer reaching for the clock or
  // for Redis would need an argument it does not have.
  it('types a rule as a function of state and event alone', () => {
    const start: Reducer<Phase, Effect, { readonly type: 'start' }> = (state, event) =>
      state === 'lobby' && event.type === 'start'
        ? emit('round', { kind: 'arm_timer', seconds: 300 })
        : settle(state);

    expect(start('lobby', { type: 'start' })).toEqual({
      state: 'round',
      effects: [{ kind: 'arm_timer', seconds: 300 }],
    });
    expect(start('round', { type: 'start' })).toEqual({ state: 'round', effects: [] });
    expectTypeOf(start).parameters.toEqualTypeOf<[Phase, { readonly type: 'start' }]>();
  });
});

// `domain` depends on `protocol` and on nothing else. That the declaration is
// exactly that one is checked in `packages/config/src/workspace-graph.test.ts`;
// that the link actually resolves is checked here.
describe('the protocol link', () => {
  it('resolves the protocol package from domain', () => {
    expect(decode).toBeTypeOf('function');
  });
});
