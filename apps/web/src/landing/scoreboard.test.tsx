/** @vitest-environment jsdom */

// Step C.5 — the scoreboard assembles, so each row has to know its place.
//
// The stylesheet turns `--row` into that row's slice of the beat. What it cannot
// do is notice that the indices stopped being handed out, or that they arrived
// in an order nobody meant: a scoreboard whose rows all carry 0 assembles in one
// go and looks like a scoreboard that simply appeared, which is not a failure
// any render or any screenshot reports.
import { cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { renderIn } from '../i18n/testing.js';

import { Scoreboard } from './scoreboard.js';

afterEach(() => {
  cleanup();
});

function rowsOf(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>('.landing-scoreboard__row')];
}

describe('C.5 — the rows carry the order they assemble in', () => {
  it('numbers every row, from the top', () => {
    const view = renderIn('en', <Scoreboard />);

    expect(
      rowsOf(view.container).map((row) => row.style.getPropertyValue('--row')),
    ).toEqual(['0', '1', '2', '3']);
  });

  it('gives the order to the rows and not to the frame', () => {
    const view = renderIn('en', <Scoreboard />);

    // The frame is whole from the first row: it is the card the rows arrive
    // into, so its surface and its corner are static and only the rows stagger.
    // L.6 took the shadow this used to name off the card — a shadow in J2 says
    // *over the page*, and a scoreboard is in it — so the assertion names what
    // is left rather than dropping the check.
    const frame = view.container.querySelector('dl');
    expect(frame?.style.getPropertyValue('--row')).toBe('');
    expect(frame?.className).toContain('bg-surface');
    expect(frame?.className).toContain('rounded-xl');
  });
});

describe('C.5 — off the stage it is simply a list', () => {
  it('renders the four outcomes whatever the index does', () => {
    // A phone and a viewer who asked for less motion never reach the media
    // query, so `--row` styles nothing and the scoreboard is four rows.
    const scoreboard = renderIn('fr', <Scoreboard />);
    expect(rowsOf(scoreboard.container)).toHaveLength(4);
    expect(scoreboard.container.querySelectorAll('dd')).toHaveLength(4);
  });
});
