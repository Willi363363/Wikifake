// Turning a Zod enum into a Postgres one.
//
// Every enum in this schema comes from `@wikifake/protocol`: redeclaring the
// values here is how the database and the wire end up disagreeing, which is D8
// with a slower feedback loop.
export function nonEmpty<T extends string>(values: readonly T[]): [T, ...T[]] {
  const [first, ...rest] = values;
  // Cannot fire — a Zod enum always has at least one value — but saying so out
  // loud is better than an assertion that hides why it is safe.
  if (first === undefined) throw new Error('a Postgres enum needs at least one value');
  return [first, ...rest];
}
