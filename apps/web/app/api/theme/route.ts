// `POST /api/theme`: the palette a reader chose, kept in a cookie — step L.9.
import { handleChooseTheme } from '../../../src/theme/handler.js';

/** Reads a form and writes a cookie on every call. Nothing here is static. */
export const dynamic = 'force-dynamic';

export function POST(request: Request): Promise<Response> {
  return handleChooseTheme(request);
}
