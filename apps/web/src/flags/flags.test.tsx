/** @vitest-environment jsdom */

// A player reporting a genuine error in the source article, as opposed to the
// ones the game put there.
//
// The done-when has two halves. "A submitted flag appears in the database" is
// the route's, and is tested against a real one in
// `app/api/flag-report/route.test.ts` — phase 4's step 4.9. What is here is the
// other half: that the toast reflects the verdict, and that the two closed unions
// the response carries are read exhaustively rather than printed.
import { act, cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { flagsApi } from '@wikifake/protocol';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { FlagCapture } from './capture.js';
import en from '../../messages/en/small.json';
import { render } from '../i18n/testing.js';
import { FlagPanel } from './panel.js';
import {
  fateOf,
  readingOf,
  reportFlag,
  useCaptures,
  type Capture,
  type CapturesState,
} from './flags.js';

const PARAGRAPHS = [
  'Le chat dort seize heures par jour.',
  'Sa vision nocturne est bonne.',
  'Il ronronne en expirant.',
];

const CAPTURED: Capture = {
  id: 'flag-1',
  paragraphIndex: 2,
  paragraphText: PARAGRAPHS[1] ?? '',
  quickNote: 'the date looks wrong',
};

const VERDICT: flagsApi.FlagVerification = {
  verdict: 'likely_valid',
  confidence: 82,
  reasoning: 'Two independent sources give a different figure.',
  sourcesFound: ['https://example.org/one'],
  recommendation: 'approve_for_review',
};

afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
});

/** Answers the next `fetch` with this status and body. */
function answering(status: number, body: unknown): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      () =>
        Promise.resolve({
          ok: status >= 200 && status < 300,
          status,
          json: () => Promise.resolve(body),
        }) as unknown as Promise<Response>,
    ),
  );
}

describe('8.8 — reading a verdict', () => {
  // Both unions are closed in the contract and free strings on the current
  // server: they come out of a language model through `json.loads`, so a sixth
  // value its own prompt never listed would reach the player as though it meant
  // something.
  it.each(['likely_valid', 'uncertain', 'unsupported'] as const)(
    'has a sentence for %s',
    (verdict) => {
      // Since 11.2 the reading is a catalogue key; the sentence it resolves to
      // must exist in the catalogue, or a raw identifier reaches the player.
      const reading = readingOf({ ...VERDICT, verdict });
      expect(Object.keys(en.flags.verdict)).toContain(reading.id);
      expect(['green', 'bronze', 'danger']).toContain(reading.tone);
    },
  );

  it('reads a valid report as good news and an unsupported one as not', () => {
    expect(readingOf({ ...VERDICT, verdict: 'likely_valid' }).tone).toBe('green');
    expect(readingOf({ ...VERDICT, verdict: 'unsupported' }).tone).toBe('danger');
  });

  it.each(['ai_reviewed', 'pending_human_review', 'rejected_by_ai'] as const)(
    'says what happens next for %s',
    (status) => {
      expect(Object.keys(en.flags.fate)).toContain(fateOf(status));
    },
  );

  it('says a promoted report will be read by a person', () => {
    expect(en.flags.fate[fateOf('pending_human_review')]).toContain('person');
  });
});

describe('8.8 — sending one', () => {
  const REQUEST = {
    articleTitle: 'Chat',
    articleUrl: 'https://fr.wikipedia.org/wiki/Chat',
    flaggedClaim: PARAGRAPHS[1] ?? '',
    proposedCorrection: 'Sa vision nocturne est excellente.',
    quickNote: '',
    explanation: '',
    sources: [],
    playerId: 'anonymous' as const,
    roomCode: '',
  };

  it('posts the report and hands back the verdict', async () => {
    answering(200, { id: 'r1', status: 'ai_reviewed', verification: VERDICT });
    const sent = await reportFlag(REQUEST);

    expect(vi.mocked(fetch).mock.calls[0]?.[0]).toBe('/api/flag-report');
    expect(sent).toEqual({
      ok: true,
      value: { id: 'r1', status: 'ai_reviewed', verification: VERDICT },
    });
  });

  it('refuses a verdict the contract does not allow', async () => {
    // The point of decoding this response: a value the prompt never listed does
    // not reach the screen.
    answering(200, {
      id: 'r1',
      status: 'ai_reviewed',
      verification: { ...VERDICT, verdict: 'extremely_valid' },
    });
    expect((await reportFlag(REQUEST)).ok).toBe(false);
  });

  it('passes a refusal on', async () => {
    answering(400, { code: 'bad_json', message: 'that report makes no sense' });
    expect(await reportFlag(REQUEST)).toEqual({
      ok: false,
      code: 'bad_json',
      message: 'that report makes no sense',
    });
  });
});

describe('8.8 — what a round captures', () => {
  function mount(key: string) {
    const box: { held: CapturesState | null } = { held: null };
    function Host({ round }: { round: string }) {
      box.held = useCaptures(round);
      return null;
    }
    const view = render(<Host round={key} />);
    const state = (): CapturesState => {
      const found = box.held;
      if (found === null) throw new Error('the hook did not run');
      return found;
    };
    return {
      state,
      rerender: (next: string) => {
        view.rerender(<Host round={next} />);
      },
    };
  }

  it('keeps what was flagged, with its paragraph and its note', () => {
    const { state } = mount('round-1');
    act(() => {
      state().capture(2, PARAGRAPHS[1] ?? '', 'the date looks wrong');
    });

    const [only] = state().captures;
    expect(only?.paragraphIndex).toBe(2);
    expect(only?.quickNote).toBe('the date looks wrong');
  });

  it('keeps two flags on the same paragraph apart', () => {
    const { state } = mount('round-1');
    act(() => {
      state().capture(2, PARAGRAPHS[1] ?? '', 'one');
      state().capture(2, PARAGRAPHS[1] ?? '', 'two');
    });

    const [first, second] = state().captures;
    expect(state().captures).toHaveLength(2);
    expect(first?.id).not.toBe(second?.id);
  });

  it('drops one on request', () => {
    const { state } = mount('round-1');
    act(() => {
      state().capture(1, PARAGRAPHS[0] ?? '', '');
    });
    act(() => {
      state().drop(state().captures[0]?.id ?? '');
    });
    expect(state().captures).toEqual([]);
  });

  it('forgets them when the round changes', () => {
    const { state, rerender } = mount('round-1');
    act(() => {
      state().capture(1, PARAGRAPHS[0] ?? '', '');
    });

    rerender('round-2');
    expect(state().captures).toEqual([]);
  });
});

describe('8.8 — the capture dialog', () => {
  it('asks for a paragraph, and sends nothing without one', async () => {
    const user = userEvent.setup();
    const captured = vi.fn();
    render(
      <FlagCapture
        open
        paragraphs={PARAGRAPHS}
        onOpenChange={vi.fn()}
        onCapture={captured}
      />,
    );

    expect(screen.getAllByRole('radio')).toHaveLength(3);
    expect(screen.getByRole('button', { name: 'Flag it' }).hasAttribute('disabled')).toBe(
      true,
    );

    await user.click(screen.getByRole('radio', { name: 'Paragraph 2' }));
    await user.type(screen.getByLabelText(/quick note/), 'the date looks wrong');
    await user.click(screen.getByRole('button', { name: 'Flag it' }));

    // 1-based, and the text travels with it: the report needs the claim, and the
    // article it came from is not on screen by then.
    expect(captured).toHaveBeenCalledWith(2, PARAGRAPHS[1], 'the date looks wrong');
  });

  it('closes on escape, which the current modal hand-rolls', async () => {
    const user = userEvent.setup();
    const changed = vi.fn();
    render(
      <FlagCapture
        open
        paragraphs={PARAGRAPHS}
        onOpenChange={changed}
        onCapture={vi.fn()}
      />,
    );

    await user.keyboard('{Escape}');
    expect(changed).toHaveBeenCalledWith(false);
  });
});

describe('8.8 — writing one up', () => {
  const paint = (captures: readonly Capture[] = [CAPTURED]) => {
    const dropped = vi.fn();
    render(
      <FlagPanel
        captures={captures}
        articleTitle="Chat"
        articleUrl="https://fr.wikipedia.org/wiki/Chat"
        roomCode=""
        onDrop={dropped}
      />,
    );
    return dropped;
  };

  it('says nothing when nothing was flagged', () => {
    const { container } = render(
      <FlagPanel
        captures={[]}
        articleTitle="Chat"
        articleUrl=""
        roomCode=""
        onDrop={vi.fn()}
      />,
    );
    // A section headed "nothing to report" is a section to scroll past.
    expect(container.textContent).toBe('');
  });

  it('lists what was flagged, and offers to write it up', () => {
    paint();
    expect(screen.getByText(/the date looks wrong/)).not.toBeNull();
    expect(
      screen.getByRole('button', { name: /Write up the report for paragraph 2/ }),
    ).not.toBeNull();
  });

  it('lets a flag be discarded', async () => {
    const user = userEvent.setup();
    const dropped = paint();

    await user.click(
      screen.getByRole('button', { name: /Discard the flag on paragraph 2/ }),
    );
    expect(dropped).toHaveBeenCalledWith('flag-1');
  });

  it('will not send a report with no correction in it', async () => {
    const user = userEvent.setup();
    paint();
    await user.click(screen.getByRole('button', { name: /Write up/ }));

    expect(
      screen.getByRole('button', { name: 'Send the report' }).hasAttribute('disabled'),
    ).toBe(true);
  });

  // The half of the done-when that lives on this side.
  it('shows the verdict the check came back with', async () => {
    const user = userEvent.setup();
    answering(200, { id: 'r1', status: 'pending_human_review', verification: VERDICT });
    paint();

    await user.click(screen.getByRole('button', { name: /Write up/ }));
    await user.type(screen.getByLabelText('What it should say'), 'excellente');
    await user.click(screen.getByRole('button', { name: 'Send the report' }));

    const said = await screen.findByRole('status', { name: 'What the check found' });
    expect(said.textContent).toContain('Looks right');
    expect(said.textContent).toContain('82%');
    expect(said.textContent).toContain('Two independent sources');
    expect(said.textContent).toContain('person');
  });

  it('sends the claim and the correction the player wrote', async () => {
    const user = userEvent.setup();
    answering(200, { id: 'r1', status: 'ai_reviewed', verification: VERDICT });
    paint();

    await user.click(screen.getByRole('button', { name: /Write up/ }));
    await user.type(screen.getByLabelText('What it should say'), 'excellente');
    await user.type(
      screen.getByLabelText(/Sources/),
      'https://example.org/a\nhttps://example.org/b',
    );
    await user.click(screen.getByRole('button', { name: 'Send the report' }));
    await screen.findByRole('status', { name: 'What the check found' });

    const body = JSON.parse(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body)) as Record<
      string,
      unknown
    >;
    expect(body.flaggedClaim).toBe(PARAGRAPHS[1]);
    expect(body.proposedCorrection).toBe('excellente');
    expect(body.quickNote).toBe('the date looks wrong');
    // One link per line, which is how the current form takes them.
    expect(body.sources).toEqual(['https://example.org/a', 'https://example.org/b']);
  });

  it('says what went wrong, and keeps what was typed', async () => {
    const user = userEvent.setup();
    answering(400, { code: 'bad_json', message: 'that report makes no sense' });
    paint();

    await user.click(screen.getByRole('button', { name: /Write up/ }));
    await user.type(screen.getByLabelText('What it should say'), 'excellente');
    await user.click(screen.getByRole('button', { name: 'Send the report' }));

    expect((await screen.findByRole('alert')).textContent).toContain('makes no sense');
    expect(screen.getByLabelText('What it should say')).toHaveProperty(
      'value',
      'excellente',
    );
  });
});
