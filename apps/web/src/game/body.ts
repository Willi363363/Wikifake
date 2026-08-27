// Reading a request body, once.
//
// Three routes need the same two lines, and the interesting part is the `catch`:
// a body that is not JSON at all and a body the schema refuses are the same
// answer to the caller — this route cannot read what you sent — so they take the
// same path rather than two that drift.
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
