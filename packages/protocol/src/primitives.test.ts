import { describe, expect, it } from 'vitest';

import { decode } from './decode.js';
import {
  chatContent,
  cursorCoordinate,
  hintLevel,
  MAX_CHAT_LENGTH,
  MAX_PLAYER_NAME_LENGTH,
  paragraphIndex,
  playerColour,
  playerName,
  roomCode,
  timeLimitSeconds,
  topicLabel,
} from './primitives.js';

describe('playerName (C5.1)', () => {
  // `élise` and `日本` are accepted today: `validate_player_name` uses Python's
  // `re.UNICODE`, where `\w` is not ASCII. Transcribing that regex as `\w` in
  // JavaScript would have locked out every accented nickname in silence.
  it.each([
    ['ada'],
    ['Ada Lovelace'],
    ['jean-luc'],
    ['dr.no'],
    ['snake_case'],
    ['élise'],
    ['日本'],
    ['Ωmega'],
  ])('accepts %s', (name) => {
    expect(playerName.parse(name)).toBe(name);
  });

  it('trims before judging, and returns the trimmed name', () => {
    expect(playerName.parse('  ada  ')).toBe('ada');
  });

  it('refuses a name that is only whitespace', () => {
    expect(playerName.safeParse('   ').success).toBe(false);
  });

  it(`refuses more than ${MAX_PLAYER_NAME_LENGTH} characters`, () => {
    expect(playerName.safeParse('a'.repeat(MAX_PLAYER_NAME_LENGTH)).success).toBe(true);
    expect(playerName.safeParse('a'.repeat(MAX_PLAYER_NAME_LENGTH + 1)).success).toBe(
      false,
    );
  });

  // The nickname is a dictionary key and travels in the WebSocket URL: a
  // slash or a percent there is a path, not a name.
  it.each([['ada/eve'], ['ada%2f'], ['<script>'], ['ada\nbob'], ['a:b']])(
    'refuses %s',
    (name) => {
      expect(playerName.safeParse(name).success).toBe(false);
    },
  );
});

describe('roomCode (C5.6)', () => {
  it('accepts six upper-case characters', () => {
    expect(roomCode.parse('A1B2C3')).toBe('A1B2C3');
  });

  it.each([['a1b2c3'], ['A1B2C'], ['A1B2C34'], ['A1B2-3'], ['']])(
    'refuses %s',
    (code) => {
      expect(roomCode.safeParse(code).success).toBe(false);
    },
  );
});

describe('playerColour', () => {
  it('accepts a hex triplet', () => {
    expect(playerColour.parse('#e63946')).toBe('#e63946');
  });

  it.each([['e63946'], ['#e639'], ['red'], ['#ggghhh']])('refuses %s', (colour) => {
    expect(playerColour.safeParse(colour).success).toBe(false);
  });
});

describe('paragraphIndex (C3.3)', () => {
  it('is 1-based: 0 is not a paragraph', () => {
    expect(paragraphIndex.safeParse(0).success).toBe(false);
    expect(paragraphIndex.parse(1)).toBe(1);
  });

  it.each([[-1], [1.5], [Number.NaN]])('refuses %s', (index) => {
    expect(paragraphIndex.safeParse(index).success).toBe(false);
  });
});

describe('hintLevel (C1.4)', () => {
  it('has exactly two levels', () => {
    expect(hintLevel.parse(1)).toBe(1);
    expect(hintLevel.parse(2)).toBe(2);
  });

  // The current server reads any level >= 2 as 2, which turns a client bug
  // into a silent success.
  it.each([[0], [3], [1.5]])('refuses %s rather than rounding it', (level) => {
    expect(hintLevel.safeParse(level).success).toBe(false);
  });
});

describe('chatContent (C5.4)', () => {
  it('trims and keeps the text', () => {
    expect(chatContent.parse('  bien joué  ')).toBe('bien joué');
  });

  it('drops an empty message', () => {
    expect(chatContent.safeParse('    ').success).toBe(false);
  });

  it(`caps at ${MAX_CHAT_LENGTH} characters`, () => {
    expect(chatContent.safeParse('x'.repeat(MAX_CHAT_LENGTH)).success).toBe(true);
    expect(chatContent.safeParse('x'.repeat(MAX_CHAT_LENGTH + 1)).success).toBe(false);
  });
});

describe('cursorCoordinate (C5.5)', () => {
  // Clamped, not refused: a cursor slightly out of bounds is a resized window,
  // and a player must not lose their connection over a stray pixel.
  it.each([
    [1.5, 1],
    [-0.2, 0],
    [0.42, 0.42],
    [0, 0],
    [1, 1],
  ])('clamps %s to %s', (input, expected) => {
    expect(cursorCoordinate.parse(input)).toBe(expected);
  });

  it.each([['left'], [null], [undefined], [Number.NaN], [Number.POSITIVE_INFINITY]])(
    'reads %s as 0 rather than failing',
    (input) => {
      expect(cursorCoordinate.parse(input)).toBe(0);
    },
  );
});

describe('timeLimitSeconds', () => {
  it('accepts the bounds the round picker offers', () => {
    expect(timeLimitSeconds.parse(30)).toBe(30);
    expect(timeLimitSeconds.parse(300)).toBe(300);
    expect(timeLimitSeconds.parse(600)).toBe(600);
  });

  // The time bonus is max(0, timeLimit - elapsed) x 0.5 (C2.1): an unbounded
  // limit is an unbounded score, and the current server takes any integer.
  it.each([[29], [601], [86_400], [-1], [0]])('refuses %s', (limit) => {
    expect(timeLimitSeconds.safeParse(limit).success).toBe(false);
  });

  it('names the offending field when it is refused', () => {
    const result = decode(timeLimitSeconds, 86_400);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0]).toContain('(root)');
  });
});

describe('topicLabel', () => {
  it('keeps French topics as they are typed — that is source data, not our prose', () => {
    expect(topicLabel.parse('Château de Versailles')).toBe('Château de Versailles');
  });

  it('drops a blank vote', () => {
    expect(topicLabel.safeParse('   ').success).toBe(false);
  });
});
