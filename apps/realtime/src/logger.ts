// Structured JSON logging for the realtime service.
//
// `checks.sh` forbids `console.log`; this is the replacement. pino emits one
// JSON line per event — level, time, message — which is what log aggregators
// expect and what `grep` can filter.
import pino from 'pino';

function level(): pino.Level {
  const raw = process.env['LOG_LEVEL'];
  if (raw === 'debug' || raw === 'info' || raw === 'warn' || raw === 'error') return raw;
  return 'info';
}

export const logger = pino({ level: level() });
