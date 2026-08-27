/** @vitest-environment jsdom */

// D6 — the chain, end to end on screen: click an item, choose a target, send.
//
// This is the part that did not exist. `GameSession.jsx:376` passes
// `onUse={useItem}` where `useItem` is neither imported nor defined — a
// `ReferenceError` on rendering any round with items — and nothing ever calls
// `setItemModal`, so there was no way to choose a target either.
//
// And every render here has items. The current smoke test renders with
// `withItems: false`, which is how a `ReferenceError` on the main multiplayer
// path survived to production.
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ITEM_CATALOGUE } from '@wikifake/domain';
import { ITEM_IDS } from '@wikifake/protocol';
import type { ItemId, ItemInstance } from '@wikifake/protocol';
import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';

import { isSelfCast, labelFor } from './item-labels.js';
import { ARTICLE, noHints, noItems, tokens } from './testing.js';
import { Round } from './round.js';
import type { ItemsState } from './items.js';

const RIVALS = ['bob', 'cleo'];

const held = (instanceId: string, itemId: ItemId): ItemInstance => ({
  instanceId,
  itemId,
});

type Throw = (
  item: ItemInstance,
  targets: readonly string[],
  marked: readonly number[],
) => void;

/** A round with items, which is the only way this file renders one. */
function paint(
  over: {
    items?: Partial<ItemsState>;
    rivals?: readonly string[];
    submitted?: boolean;
  } = {},
): Mock<Throw> {
  const thrown = vi.fn<Throw>();
  render(
    <Round
      article={ARTICLE}
      timeLimit={300}
      submitted={over.submitted ?? false}
      busy={false}
      refusal={null}
      hints={noHints()}
      items={noItems(over.items)}
      rivals={over.rivals ?? RIVALS}
      onSubmit={vi.fn()}
      onUnlockHint={vi.fn()}
      onUseItem={thrown}
    />,
  );
  return thrown;
}

const pick = async (user: ReturnType<typeof userEvent.setup>, id: ItemId) => {
  await user.click(
    screen.getByRole('button', { name: new RegExp(`^${labelFor(id).name} —`) }),
  );
};

afterEach(() => {
  cleanup();
});

describe('8.3 — the bar', () => {
  it('is not there when there is nothing to spend', () => {
    paint();
    expect(screen.queryByRole('toolbar', { name: 'Your items' })).toBeNull();
  });

  it('shows the hand, each card named and reachable', () => {
    paint({ items: { hand: [held('a', 'SPIN'), held('b', 'SCANNER')] } });

    const bar = screen.getByRole('toolbar', { name: 'Your items' });
    expect(bar).not.toBeNull();
    // Buttons, not `<div onClick>`: the current bar is the latter, so no
    // keyboard reaches it and nothing announces what it is.
    expect(screen.getByRole('button', { name: /^Vertigo —/ })).not.toBeNull();
    expect(screen.getByRole('button', { name: /^Detector —/ })).not.toBeNull();
  });

  it('says which cards will ask for a target', () => {
    paint({ items: { hand: [held('a', 'SPIN'), held('b', 'SCANNER')] } });

    expect(
      screen.getByRole('button', { name: /Vertigo/ }).getAttribute('aria-label'),
    ).toContain('Asks for a target');
    expect(
      screen.getByRole('button', { name: /Detector/ }).getAttribute('aria-label'),
    ).not.toContain('Asks for a target');
  });

  it('shuts the whole bar while a throw is in flight', () => {
    paint({ items: { hand: [held('a', 'SPIN'), held('b', 'BLUR')], pending: 'a' } });

    // One at a time, so a refusal can be attributed to the item that caused it.
    for (const name of [/Vertigo/, /Fog/]) {
      expect(screen.getByRole('button', { name }).hasAttribute('disabled')).toBe(true);
    }
  });

  it('shuts it once the answer is with the server', () => {
    paint({ items: { hand: [held('a', 'SPIN')] }, submitted: true });
    expect(screen.getByRole('button', { name: /Vertigo/ }).hasAttribute('disabled')).toBe(
      true,
    );
  });
});

describe('8.3 — the chain', () => {
  it('asks for a target, then sends the throw', async () => {
    const user = userEvent.setup();
    const thrown = paint({ items: { hand: [held('a', 'SPIN')] } });

    await pick(user, 'SPIN');
    expect(screen.getByRole('dialog')).not.toBeNull();
    expect(thrown).not.toHaveBeenCalled();

    await user.click(screen.getByRole('radio', { name: 'bob' }));
    await user.click(screen.getByRole('button', { name: 'Throw it at bob' }));

    expect(thrown).toHaveBeenCalledWith(held('a', 'SPIN'), ['bob'], []);
  });

  it('never offers the caster as a target', async () => {
    const user = userEvent.setup();
    paint({ items: { hand: [held('a', 'SPIN')] } });
    await pick(user, 'SPIN');

    // The server refuses a self-target too (D6). Both, because a client that
    // offers an illegal move spends the player's item on a refusal.
    expect(screen.getAllByRole('radio').map((each) => each.textContent)).toEqual(RIVALS);
  });

  it('sends nothing until somebody is chosen', async () => {
    const user = userEvent.setup();
    paint({ items: { hand: [held('a', 'SPIN')] } });
    await pick(user, 'SPIN');

    expect(
      screen.getByRole('button', { name: 'Throw it' }).hasAttribute('disabled'),
    ).toBe(true);
  });

  it('sends nothing when the picker is cancelled', async () => {
    const user = userEvent.setup();
    const thrown = paint({ items: { hand: [held('a', 'SPIN')] } });

    await pick(user, 'SPIN');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(thrown).not.toHaveBeenCalled();
  });

  it('says so when there is nobody to throw at', async () => {
    const user = userEvent.setup();
    paint({ items: { hand: [held('a', 'SPIN')] }, rivals: [] });
    await pick(user, 'SPIN');

    expect(screen.getByRole('dialog').textContent).toContain('Nobody else is here');
    expect(
      screen.getByRole('button', { name: 'Throw it' }).hasAttribute('disabled'),
    ).toBe(true);
  });

  it('throws a self-cast item without asking anybody', async () => {
    const user = userEvent.setup();
    const thrown = paint({ items: { hand: [held('a', 'SCANNER')] } });

    await pick(user, 'SCANNER');
    // The current picker asks for a target for the detector too, which the
    // server then refuses.
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(thrown).toHaveBeenCalledWith(held('a', 'SCANNER'), [], []);
  });

  // C1.6 — the marked paragraphs ride along, so the detector does not point at
  // one the player has already ticked.
  it('sends what the player has marked with the throw', async () => {
    const user = userEvent.setup();
    const thrown = paint({ items: { hand: [held('a', 'SCANNER')] } });

    await user.click(tokens()[0] as HTMLElement);
    await user.click(tokens()[2] as HTMLElement);
    await pick(user, 'SCANNER');

    expect(thrown).toHaveBeenCalledWith(held('a', 'SCANNER'), [], [1, 3]);
  });

  // The done-when: every item in the catalogue can be used.
  it.each(ITEM_IDS)('throws %s, with the targets its rules ask for', async (id) => {
    const user = userEvent.setup();
    const thrown = paint({ items: { hand: [held('x', id)] } });

    await pick(user, id);
    if (!isSelfCast(id)) {
      await user.click(screen.getByRole('radio', { name: 'bob' }));
      await user.click(screen.getByRole('button', { name: 'Throw it at bob' }));
    }

    const targets = thrown.mock.calls[0]?.[1] ?? [];
    expect(targets).toHaveLength(ITEM_CATALOGUE[id].targets);
    expect(thrown).toHaveBeenCalledTimes(1);
  });
});

describe('8.3 — what came back', () => {
  it('says who hit you, and with what', () => {
    paint({ items: { landed: [{ id: 'l1', itemId: 'BLUR', from: 'bob' }] } });

    expect(screen.getByText(/hit you with/).textContent).toContain('bob');
    expect(screen.getByText(/hit you with/).textContent).toContain('Fog');
  });

  it('lets a notice be dismissed', async () => {
    const user = userEvent.setup();
    const dismissed = vi.fn();
    paint({
      items: { landed: [{ id: 'l1', itemId: 'BLUR', from: 'bob' }], dismiss: dismissed },
    });

    await user.click(screen.getByRole('button', { name: 'Dismiss Fog from bob' }));
    expect(dismissed).toHaveBeenCalledWith('l1');
  });

  it('points at the paragraph the detector named', () => {
    paint({
      items: { scanned: new Set([2]), lastScan: { id: 's1', paragraphIndex: 2 } },
    });

    expect(tokens().map((token) => token.getAttribute('data-state'))).toEqual([
      'idle',
      'scanned',
      'idle',
    ]);
    expect(screen.getByText(/points at paragraph 2/)).not.toBeNull();
  });

  it('says when the detector has nothing left to point at', () => {
    paint({ items: { lastScan: { id: 's1', paragraphIndex: null } } });
    expect(screen.getByText(/nothing left to point at/)).not.toBeNull();
  });

  it('shows a refusal without taking the round down', () => {
    paint({
      items: { hand: [held('a', 'SPIN')], refusal: 'those targets make no sense' },
    });

    expect(screen.getByRole('alert').textContent).toContain('make no sense');
    // Still a round, and the item is still in hand.
    expect(screen.getByRole('heading', { level: 1 })).not.toBeNull();
    expect(screen.getByRole('button', { name: /Vertigo/ })).not.toBeNull();
  });
});
