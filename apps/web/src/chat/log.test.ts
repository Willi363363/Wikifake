// The scrollback, as a list operation.
//
// One thing worth asserting without a DOM: that the log has a floor under it.
// The current panel has none, and an array that only grows is the sort of defect
// that never gets reported and is felt for as long as the room lives.
import { describe, expect, it } from 'vitest';

import { appended, MAX_LINES, type ChatLine } from './log.js';

const line = (content: string): ChatLine => ({ sender: 'ada', content });

describe('7.7 — the chat log', () => {
  it('appends in the order it was said', () => {
    const log = [line('one'), line('two')].reduce<readonly ChatLine[]>(
      (was, next) => appended(was, next),
      [],
    );
    expect(log.map((each) => each.content)).toEqual(['one', 'two']);
  });

  it('keeps the original untouched', () => {
    const before: readonly ChatLine[] = [line('one')];
    appended(before, line('two'));
    expect(before).toHaveLength(1);
  });

  it('stops growing at the cap', () => {
    let log: readonly ChatLine[] = [];
    for (let at = 0; at < MAX_LINES + 50; at += 1) log = appended(log, line(String(at)));
    expect(log).toHaveLength(MAX_LINES);
  });

  it('drops the oldest, never the newest', () => {
    let log: readonly ChatLine[] = [];
    for (let at = 0; at < MAX_LINES + 3; at += 1) log = appended(log, line(String(at)));

    expect(log[0]?.content).toBe('3');
    expect(log.at(-1)?.content).toBe(String(MAX_LINES + 2));
  });
});
