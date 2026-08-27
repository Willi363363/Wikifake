// `pnpm --filter @wikifake/db seed`
//
// Run through `tsx` rather than bare `node`. Node's type stripping executes
// TypeScript but does not resolve a `.js` import onto a `.ts` file, and the
// package imports that way throughout — as the rest of the monorepo does. `tsx`
// was already in the tree as a dependency of `drizzle-kit`; it is declared now,
// because relying on a transitive dependency is relying on someone else's
// decision.
import { connect } from '../src/client.js';
import { requireDatabaseUrl } from '../src/database-url.js';
import { seed } from '../src/seed/seed.js';

const { db, close } = connect({ url: requireDatabaseUrl(), max: 1 });
try {
  await seed(db);
  process.stdout.write('seeded\n');
} finally {
  await close();
}
