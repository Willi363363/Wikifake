// Structured JSON logging — level, timestamp, message.
//
// `checks.sh` forbids `console.log` and instructs to use a logger instead.
// This module is that logger: one instance per process, configured once from
// the validated environment, used everywhere that needs to emit a line.
//
// The level defaults to 'info' but the env schema allows any of debug/info/
// warn/error, so a preview with a wrong query can be promoted to debug without
// a code change.
import pino from 'pino';

/** The log level, from the environment or its default. */
function level(): pino.Level {
  const raw = process.env['LOG_LEVEL'];
  if (raw === 'debug' || raw === 'info' || raw === 'warn' || raw === 'error') return raw;
  return 'info';
}

export const logger = pino({ level: level() });
