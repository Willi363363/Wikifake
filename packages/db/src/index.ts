// Persistence: the schema, the client, and the queries that read them.
//
// No business logic. `participant` stores the breakdown `domain` computed; it
// does not recompute it, and there is no trigger and no stored procedure. The
// rules live in one place, and it is not the database.
export * from './schema/index.js';
export { connect, connectFromEnv } from './client.js';
export type { ConnectionOptions, Database } from './client.js';
