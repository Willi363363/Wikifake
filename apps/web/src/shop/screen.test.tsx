/** @vitest-environment jsdom */

// The shop screen — step H.7.
//
// It formats a list and decides one thing: which of four states each row is in —
// worn, owned, buyable, or too dear. That decision is what the cases below hold,
// along with the two claims that are easy to get wrong by accident: **a name
// comes from the catalogue and never from the row**, and **the preview is drawn
// with the design system's own answer** rather than an approximation of it.
//
// Whether the list is right is `stock.test.ts` against a real database, and
// whether a purchase can be paid twice is `buy.test.ts`. Neither is re-asserted.
import { cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { COSMETIC_CATALOGUE, COSMETIC_IDS, EMPTY_OUTFIT } from '@wikifake/domain';
import { MARKER_COLOURS } from '@wikifake/ui';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ShopScreen } from './screen.js';
import { render, renderIn } from '../i18n/testing.js';
import type { ShopView, StockItem } from './stock.js';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh }),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  refresh.mockClear();
});

/** Everything for sale, none of it owned, all of it affordable. */
function stock(over: Partial<Record<string, Partial<StockItem>>> = {}): StockItem[] {
  return COSMETIC_IDS.map((id) => ({
    id,
    slot: COSMETIC_CATALOGUE[id].slot,
    price: COSMETIC_CATALOGUE[id].price,
    owned: false,
    worn: false,
    affordable: true,
    ...over[id],
  }));
}

function shop(over: Partial<ShopView> = {}): ShopView {
  return { balance: 1000, outfit: EMPTY_OUTFIT, items: stock(), ...over };
}

/** The Buy button on the row for one named item, rather than by position. */
function buyOn(name: string): HTMLElement {
  const row = screen
    .getAllByRole('listitem')
    .find((item) => item.textContent?.includes(name));
  if (row === undefined) throw new Error(`no row for ${name}`);
  const button = row.querySelector('button');
  if (button === null) throw new Error(`no button on the ${name} row`);
  return button;
}

/**
 * A `fetch` that succeeds with this body.
 *
 * The parameters are declared even though the stub ignores them: `vi.fn(() =>
 * …)` types `mock.calls` as an empty tuple, so the assertions on what was
 * posted would not compile.
 */
const ok = (body: unknown) =>
  vi.fn(
    (_path: string, _init?: RequestInit) =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(body),
      }) as unknown as Promise<Response>,
  );

describe('H.7 — what a row offers', () => {
  it('offers Buy for something affordable and unowned', () => {
    render(<ShopScreen shop={shop()} />);

    expect(screen.getAllByRole('button', { name: 'Buy' })).toHaveLength(
      COSMETIC_IDS.length,
    );
  });

  it('offers Wear for something owned and not worn', () => {
    render(
      <ShopScreen shop={shop({ items: stock({ FRAME_DOUBLE: { owned: true } }) })} />,
    );

    expect(screen.getAllByRole('button', { name: 'Wear' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Buy' })).toHaveLength(
      COSMETIC_IDS.length - 1,
    );
  });

  it('offers Take off for the one being worn, and says it is worn', () => {
    render(
      <ShopScreen
        shop={shop({ items: stock({ FRAME_DOUBLE: { owned: true, worn: true } }) })}
      />,
    );

    expect(screen.getByRole('button', { name: 'Take off' })).not.toBeNull();
    expect(screen.getByText('Worn')).not.toBeNull();
  });

  it('says what is wrong rather than showing a button that does nothing', () => {
    // Not a disabled Buy. A control that cannot be used has to explain itself,
    // and "Not enough coins" says the thing a greyed-out button only implies.
    render(
      <ShopScreen
        shop={shop({
          balance: 0,
          items: stock().map((item) => ({ ...item, affordable: false })),
        })}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Buy' })).toBeNull();
    expect(screen.getAllByText('Not enough coins')).toHaveLength(COSMETIC_IDS.length);
  });

  it('drops the price once it is owned', () => {
    // A number beside something you already have is a number that invites the
    // wrong arithmetic.
    render(
      <ShopScreen shop={shop({ items: stock({ FRAME_DOUBLE: { owned: true } }) })} />,
    );

    const price = `${String(COSMETIC_CATALOGUE.FRAME_DOUBLE.price)} coins`;
    // The other two frames cost the same, so the price is on screen twice
    // rather than three times.
    expect(screen.queryAllByText(price)).toHaveLength(2);
  });
});

describe('H.7 — the catalogue is the only source of a name', () => {
  it('names every item from the message catalogue', () => {
    render(<ShopScreen shop={shop()} />);

    // A name a screen composed from the identifier would read `MARKER_CRIMSON`.
    expect(screen.getByText('Crimson')).not.toBeNull();
    expect(screen.queryByText('MARKER_CRIMSON')).toBeNull();
  });

  it('says the same things in French', () => {
    renderIn('fr', <ShopScreen shop={shop()} />);

    expect(screen.getByText('Cramoisi')).not.toBeNull();
    expect(screen.getAllByRole('button', { name: 'Acheter' })).toHaveLength(
      COSMETIC_IDS.length,
    );
  });

  it('shows the balance, and what it is for', () => {
    render(<ShopScreen shop={shop({ balance: 42 })} />);

    expect(screen.getByText('42 coins')).not.toBeNull();
    expect(screen.getByRole('link', { name: 'Play a round' })).not.toBeNull();
    expect(screen.getByRole('link', { name: 'See your quests' })).not.toBeNull();
  });

  it('groups the rows under a heading and a lead per slot', () => {
    render(<ShopScreen shop={shop()} />);

    for (const heading of ['Marker', 'Mark style', 'Frame']) {
      expect(screen.getByRole('heading', { name: heading, level: 2 })).not.toBeNull();
    }
    // The room's exception, said on the screen rather than left to be found.
    expect(screen.getByText(/In a room the game picks/)).not.toBeNull();
  });
});

describe('H.7 — the preview is the real thing', () => {
  it('draws a marker in the colour the paragraph token would use', () => {
    // A shop that showed an approximation of what you were buying would be a
    // shop that can lie, so the swatch reads `MARKER_COLOURS` — the same map
    // `ParagraphToken` reads.
    const { container } = render(<ShopScreen shop={shop()} />);

    const swatches = [...container.querySelectorAll('span[aria-hidden="true"]')]
      .map((node) => node.getAttribute('style'))
      .filter((style): style is string => style !== null);
    const crimson = MARKER_COLOURS['MARKER_CRIMSON'] as string;
    const [r, g, b] = [1, 3, 5].map((at) =>
      Number.parseInt(crimson.slice(at, at + 2), 16),
    );

    expect(swatches.some((style) => style.includes(`rgb(${r}, ${g}, ${b})`))).toBe(true);
  });

  it('draws a frame with the border classes the leaderboard uses', () => {
    const { container } = render(<ShopScreen shop={shop()} />);

    const classes = [...container.querySelectorAll('span[aria-hidden="true"]')]
      .map((node) => node.className)
      .join(' ');
    expect(classes).toContain('border-double');
  });

  it('hides the preview from a screen reader, which the name already carries', () => {
    const { container } = render(<ShopScreen shop={shop()} />);

    // Every preview is `aria-hidden`: a swatch says nothing the row's name does
    // not, and announcing it twice is worse than not announcing it.
    expect(container.querySelectorAll('span[aria-hidden="true"]').length).toBeGreaterThan(
      0,
    );
  });
});

describe('H.7 — the button posts, and trusts the server', () => {
  it('buys through the shop route and refreshes rather than guessing', async () => {
    // `router.refresh()` re-runs the server component, so the balance a player
    // sees afterwards is the ledger's answer. An optimistic subtraction here
    // would be a second opinion about a number the ledger owns.
    const fetch = ok({
      cosmeticId: 'FRAME_DOUBLE',
      spent: 300,
      balance: 700,
      already: false,
    });
    vi.stubGlobal('fetch', fetch);
    render(<ShopScreen shop={shop()} />);

    await userEvent.click(buyOn('Double'));

    expect(String(fetch.mock.calls[0]?.[0])).toBe('/api/shop/buy');
    expect(JSON.parse(String(fetch.mock.calls[0]?.[1]?.body))).toEqual({
      cosmeticId: 'FRAME_DOUBLE',
    });
    expect(refresh).toHaveBeenCalled();
  });

  it('wears through the account route, sending the identifier and no slot', async () => {
    const fetch = ok({ marker: null, markStyle: null, frame: 'FRAME_DOUBLE' });
    vi.stubGlobal('fetch', fetch);
    render(
      <ShopScreen shop={shop({ items: stock({ FRAME_DOUBLE: { owned: true } }) })} />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Wear' }));

    expect(String(fetch.mock.calls[0]?.[0])).toBe('/api/account/cosmetics');
    expect(JSON.parse(String(fetch.mock.calls[0]?.[1]?.body))).toEqual({
      cosmeticId: 'FRAME_DOUBLE',
    });
  });

  it('takes off with a slot and no identifier', async () => {
    const fetch = ok({ marker: null, markStyle: null, frame: null });
    vi.stubGlobal('fetch', fetch);
    render(
      <ShopScreen
        shop={shop({ items: stock({ FRAME_DOUBLE: { owned: true, worn: true } }) })}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Take off' }));

    expect(JSON.parse(String(fetch.mock.calls[0]?.[1]?.body))).toEqual({
      slot: 'frame',
    });
  });

  it('says the server’s refusal, in words a player can act on', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          Promise.resolve({
            ok: false,
            status: 402,
            json: () => Promise.resolve({ code: 'insufficient_coins', message: 'no' }),
          }) as unknown as Promise<Response>,
      ),
    );
    render(<ShopScreen shop={shop()} />);

    await userEvent.click(
      screen.getAllByRole('button', { name: 'Buy' })[0] as HTMLElement,
    );

    expect(screen.getByRole('alert').textContent).toContain('Not enough coins for that');
    expect(refresh).not.toHaveBeenCalled();
  });

  it('does not claim a refusal when the server was never reached', async () => {
    // Telling somebody on a train that they cannot afford something would be a
    // lie, so a dead connection has its own sentence.
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('offline'))),
    );
    render(<ShopScreen shop={shop()} />);

    await userEvent.click(
      screen.getAllByRole('button', { name: 'Buy' })[0] as HTMLElement,
    );

    expect(screen.getByRole('alert').textContent).toContain('could not be reached');
  });

  it('posts once, however many times the button is pressed', async () => {
    const fetch = ok({
      cosmeticId: 'MARKER_CRIMSON',
      spent: 200,
      balance: 800,
      already: false,
    });
    vi.stubGlobal('fetch', fetch);
    render(<ShopScreen shop={shop()} />);

    const button = screen.getAllByRole('button', { name: 'Buy' })[0] as HTMLElement;
    await userEvent.click(button);
    await userEvent.click(button);

    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
