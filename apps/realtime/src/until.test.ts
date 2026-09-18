// Step R.1 — the wait helper's own failure, which is the thing CI reads.
//
// Every other suite here uses `until` to assert something about the server.
// This one asserts something about `until`: that when it gives up, the sentence
// it throws carries a diagnosis rather than only a wish.
//
// It exists because the register asked for exactly that.
// `plans/current-state/10-test-debt.md` counts five CI failures on this helper —
// three at a two-second deadline, two at eight — every one of them reading
// *"timed out waiting for the lobby to hold ada, bob"* on a branch that changed
// nothing the socket service reads, and concludes: *"nothing in the failure says
// which frame never arrived, because the helper reports what it wanted and not
// what it saw."*
//
// Short deadlines throughout: the subject is the message, not the ceiling.
import { describe, expect, it } from 'vitest';

import { until } from './testing/client.js';

const never = (): boolean => false;

describe('until', () => {
  it('returns without describing anything when the condition is already true', async () => {
    let described = 0;

    await until(() => true, {
      want: 'a condition that is already true',
      saw: () => {
        described += 1;
        return 'nothing';
      },
    });

    // The describer is the cost of the diagnosis, and a wait that succeeds must
    // not pay it — there are 52 of these in this package and most of them are
    // met on the first poll.
    expect(described).toBe(0);
  });

  it('names the time that actually passed, not the ceiling that was set', async () => {
    const failure = await until(never, 'something that never happens', 30).catch(
      (error: Error) => error.message,
    );

    // The number is the whole point of carrying it: 40 ms over a deadline is a
    // slow machine, and sitting at the ceiling is a frame that was never coming.
    expect(failure).toMatch(
      /^timed out after \d+ms waiting for something that never happens$/,
    );
  });

  it('says what it saw, and not only what it wanted', async () => {
    const roster = ['ada'];

    const failure = await until(
      never,
      {
        want: 'the lobby to hold ada, bob',
        saw: () => `${roster.join(', ')}, after 3 message(s)`,
      },
      30,
    ).catch((error: Error) => error.message);

    expect(failure).toContain('waiting for the lobby to hold ada, bob');
    // The sentence the five CI runs could not produce: the roster it did hold.
    // Told apart from an empty one, which is the other failure entirely.
    expect(failure).toContain('saw ada, after 3 message(s)');
  });

  it('describes the state at the deadline, not when the wait began', async () => {
    const received: string[] = [];
    const arriving = setInterval(() => received.push('lobby_update'), 5);

    try {
      const failure = await until(
        never,
        { want: 'a fourth frame', saw: () => `${String(received.length)} frame(s)` },
        40,
      ).catch((error: Error) => error.message);

      // A describer captured eagerly would have said `0 frame(s)` — the state
      // before the wait rather than the state that failed it.
      expect(failure).not.toContain('0 frame(s)');
    } finally {
      clearInterval(arriving);
    }
  });

  it('keeps the timeout when the describer itself throws', async () => {
    const failure = await until(
      never,
      {
        want: 'a roster',
        saw: () => {
          throw new Error('the socket is gone');
        },
      },
      30,
    ).catch((error: Error) => error.message);

    // A describer reads state that a closed socket or a truncated table may have
    // taken away. Letting it propagate would replace the one fact the run
    // needed — that the wait timed out — with an error about reading it.
    expect(failure).toContain('timed out after');
    expect(failure).toContain('waiting for a roster');
    expect(failure).toContain('the socket is gone');
  });
});
