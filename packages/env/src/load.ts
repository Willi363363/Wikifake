// Importing this module loads the workspace's env files. That is all it does.
//
// It exists because order matters and a function call cannot buy it: ESM
// evaluates every import of a module before the first statement of that module,
// so `loadEnvFiles()` written at the top of an entry point still runs *after*
// the modules it imports have read `process.env` — `logger.ts` builds its pino
// instance from `LOG_LEVEL` at import time, and would have missed the file.
//
// Imported first, this runs first. `@wikifake/env/files` stays the way to call
// the loader from a place that is already the first thing to run, such as
// `next.config.ts`.
import { loadEnvFiles } from './files.js';

loadEnvFiles();
