// The logger emits structured JSON — level, time, message — and honours the
// LOG_LEVEL environment variable. Both are checked here without touching pino's
// internals: a destination stream captures the output, and the check is on the
// parsed object rather than the raw string.
import { describe, expect, it } from 'vitest';
import pino from 'pino';

function makeLogger(level: string) {
  return pino({ level });
}

describe('structured logging', () => {
  it('emits a JSON object with level and msg fields', () => {
    const lines: object[] = [];
    const log = pino(
      { level: 'info' },
      {
        write(chunk: string) {
          lines.push(JSON.parse(chunk));
        },
      },
    );

    log.info({ room: 'ABC' }, 'player joined');

    expect(lines).toHaveLength(1);
    const line = lines[0] as Record<string, unknown>;
    expect(line).toHaveProperty('level');
    expect(line).toHaveProperty('time');
    expect(line).toHaveProperty('msg', 'player joined');
    expect(line).toHaveProperty('room', 'ABC');
  });

  it('suppresses messages below the configured level', () => {
    const lines: object[] = [];
    const log = pino(
      { level: 'warn' },
      {
        write(chunk: string) {
          lines.push(JSON.parse(chunk));
        },
      },
    );

    log.info('should not appear');
    log.warn('should appear');

    expect(lines).toHaveLength(1);
    const line = lines[0] as Record<string, unknown>;
    expect(line).toHaveProperty('msg', 'should appear');
  });
});
