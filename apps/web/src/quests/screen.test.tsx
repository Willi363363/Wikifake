/** @vitest-environment jsdom */

// The quests screen — step F.7.
//
// It formats a list and computes almost nothing, so what a render can hold is
// exactly that: which of the three states each row is in, that a rule's sentence
// comes from the catalogue rather than from the row, and the one piece of
// arithmetic the screen does own — capping the shown progress at the target.
//
// Whether the list is *right* is `sets.ts`'s suite against a real database, and
// whether a claim can be paid twice is F.6's. Neither is re-asserted here.
import { cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { QuestsScreen } from './screen.js';
import { render, renderIn } from '../i18n/testing.js';
import type { LiveQuest } from './sets.js';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh }),
}));

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  refresh.mockClear();
  vi.unstubAllGlobals();
});

/** A live daily quest, which each case then bends. */
function quest(over: Partial<LiveQuest> = {}): LiveQuest {
  return {
    questId: '00000000-0000-4000-8000-000000000001',
    ruleId: 'DAILY_FINISH_ROUNDS',
    period: 'daily',
    periodIndex: 20_706,
    target: 3,
    progress: 1,
    complete: false,
    reward: 20,
    claimedAt: null,
    ...over,
  };
}

describe('F.7 — the three states a row can be in', () => {
  it('offers no button while the target is out of reach', () => {
    render(<QuestsScreen quests={[quest()]} />);

    expect(screen.queryByRole('button', { name: 'Claim' })).toBeNull();
    expect(screen.getByText('Keep playing')).not.toBeNull();
  });

  it('offers the button once the quest is complete', () => {
    render(<QuestsScreen quests={[quest({ progress: 3, complete: true })]} />);

    expect(screen.getByRole('button', { name: 'Claim' })).not.toBeNull();
    expect(screen.queryByText('Keep playing')).toBeNull();
  });

  it('says claimed, and offers nothing to click', () => {
    render(
      <QuestsScreen
        quests={[quest({ progress: 3, complete: true, claimedAt: new Date() })]}
      />,
    );

    expect(screen.getByText('Claimed')).not.toBeNull();
    // Not a disabled button: `disabled:opacity-40` is the one translucency the
    // direction forbids, and a claimed quest is a statement, not a control.
    expect(screen.queryByRole('button', { name: 'Claim' })).toBeNull();
  });
});

describe('F.7 — what a row says', () => {
  it('reads the rule’s sentence out of the catalogue, with the drawn target', () => {
    // F.1's rule, from the other end: the catalogue carries no prose, so the
    // sentence is keyed by the identifier and the number is interpolated.
    render(<QuestsScreen quests={[quest({ target: 4 })]} />);

    expect(screen.getByRole('heading', { name: 'Finish 4 rounds' })).not.toBeNull();
  });

  it('names every rule the catalogue knows', () => {
    // A rule with no label would render its own identifier at a player, and
    // `next-intl` does not fail on a missing key — it returns the key. So every
    // rule is rendered once and the identifier must not survive.
    const all: LiveQuest[] = [
      'DAILY_FINISH_ROUNDS',
      'DAILY_FIND_FALSIFICATIONS',
      'DAILY_SCORE_POINTS',
      'DAILY_UNAIDED_ROUND',
      'DAILY_NOTHING_WRONGLY_MARKED',
    ].map((ruleId) => quest({ ruleId: ruleId as LiveQuest['ruleId'] }));

    const weekly: LiveQuest[] = [
      'WEEKLY_FINISH_ROUNDS',
      'WEEKLY_FIND_FALSIFICATIONS',
      'WEEKLY_SCORE_POINTS',
      'WEEKLY_PERFECT_ROUNDS',
      'WEEKLY_MULTIPLAYER_ROUNDS',
    ].map((ruleId) => quest({ ruleId: ruleId as LiveQuest['ruleId'], period: 'weekly' }));

    const { container } = render(<QuestsScreen quests={[...all, ...weekly]} />);

    for (const one of [...all, ...weekly]) {
      expect(container.textContent, `${one.ruleId} has no label`).not.toContain(
        one.ruleId,
      );
    }
  });

  it('shows the reward the server decided, pluralised', () => {
    render(<QuestsScreen quests={[quest({ reward: 1 })]} />);
    expect(screen.getByText('1 coin')).not.toBeNull();

    cleanup();
    render(<QuestsScreen quests={[quest({ reward: 20 })]} />);
    expect(screen.getByText('20 coins')).not.toBeNull();
  });

  it('caps the progress it shows at the target', () => {
    /*
     * The one piece of arithmetic this screen owns, and F.4 said it belongs
     * here: `progressFor` returns what a player actually did — five rounds
     * towards a quest asking three is five — because F.6 needs to tell a quest
     * that is just complete from one passed while a claim was in flight.
     *
     * "5 of 3" is arithmetic nobody asked for, so the minimum is taken at the
     * last possible moment.
     */
    render(<QuestsScreen quests={[quest({ progress: 5, complete: true })]} />);

    expect(screen.getByText('3 of 3')).not.toBeNull();
    expect(screen.queryByText('5 of 3')).toBeNull();
  });

  it('separates today from this week, and says which is empty', () => {
    render(<QuestsScreen quests={[quest({ period: 'weekly' })]} />);

    expect(screen.getByRole('heading', { name: 'Today' })).not.toBeNull();
    expect(screen.getByRole('heading', { name: 'This week' })).not.toBeNull();
    // The daily list is the empty one, and it invites rather than saying zero.
    expect(screen.getByText(/No quests for this period yet/)).not.toBeNull();
  });

  it('adds up only what was claimed, and says there is nothing to spend it on', () => {
    render(
      <QuestsScreen
        quests={[
          quest({ reward: 20, claimedAt: new Date() }),
          quest({ ruleId: 'DAILY_SCORE_POINTS', reward: 25, claimedAt: new Date() }),
          // Unclaimed: worth something, earned nothing.
          quest({ ruleId: 'DAILY_UNAIDED_ROUND', reward: 25 }),
        ]}
      />,
    );

    expect(screen.getByText(/45 coins/)).not.toBeNull();
    expect(screen.getByText(/the shop is still being built/)).not.toBeNull();
  });

  it('speaks French under the French catalogue', () => {
    // The zone is new, so this is the first thing that proves both halves of it
    // exist rather than only the English one.
    renderIn('fr', <QuestsScreen quests={[quest({ target: 4 })]} />);

    expect(screen.getByRole('heading', { name: 'Quêtes' })).not.toBeNull();
    expect(screen.getByRole('heading', { name: 'Terminer 4 manches' })).not.toBeNull();
    expect(screen.getByText('Continuez à jouer')).not.toBeNull();
  });
});

describe('F.7 — claiming, from the button', () => {
  const complete = quest({ progress: 3, complete: true });

  it('posts the quest’s own identifier and refreshes on success', async () => {
    const fetched = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetched);

    render(<QuestsScreen quests={[complete]} />);
    await userEvent.click(screen.getByRole('button', { name: 'Claim' }));

    expect(fetched).toHaveBeenCalledWith(
      '/api/quests/claim',
      expect.objectContaining({ method: 'POST' }),
    );
    const body = (fetched.mock.calls[0] as [string, { body: string }])[1].body;
    expect(JSON.parse(body)).toEqual({ questId: complete.questId });

    // The row is re-read rather than rewritten here: the claimed state a player
    // sees is the database's answer, not this component's optimism.
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['quest_not_complete', 'That one is not finished yet.'],
    ['quest_already_claimed', 'You have already claimed that one.'],
    ['quest_not_found', 'That quest is no longer yours to claim.'],
  ])('shows its own sentence for %s', async (code, sentence) => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ code, message: 'whatever' }), { status: 409 }),
        ),
    );

    render(<QuestsScreen quests={[complete]} />);
    await userEvent.click(screen.getByRole('button', { name: 'Claim' }));

    expect(screen.getByRole('alert').textContent).toBe(sentence);
    expect(refresh).not.toHaveBeenCalled();
  });

  it('does not tell somebody on a train that their quest is unfinished', async () => {
    // A dead connection and a refusal are different things. The screen writes
    // one sentence for itself and this is it — the same rule E.2's form follows.
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    render(<QuestsScreen quests={[complete]} />);
    await userEvent.click(screen.getByRole('button', { name: 'Claim' }));

    expect(screen.getByRole('alert').textContent).toBe(
      'The server could not be reached. Try again.',
    );
  });

  it('says nothing it cannot explain about a code it does not know', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ code: 'something_new' }), { status: 500 }),
        ),
    );

    render(<QuestsScreen quests={[complete]} />);
    await userEvent.click(screen.getByRole('button', { name: 'Claim' }));

    expect(screen.getByRole('alert').textContent).toBe(
      'The server could not be reached. Try again.',
    );
  });
});
