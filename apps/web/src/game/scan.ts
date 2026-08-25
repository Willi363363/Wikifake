// C1.6 — `POST /api/game/scan`: the SCANNER, resolved by the server.
//
// It designates a real falsified paragraph the player has neither marked nor
// already been shown, and answers `null` once there is none left. The client
// does not know the solution and so cannot pick; `marked` arrives only so the
// item does not point at something the player has already found.
//
// What the player has already been shown lives in `item_use`, not in memory. The
// current server keeps it in a per-room dictionary, which is why D2 exists: the
// normal round-start path never purges it, and the next round starts with the
// previous one's scans still counted.
import { EMPTY_ITEM_STATE, scan } from '@wikifake/domain';
import {
  recordScan,
  selectFalsifiedIndices,
  selectScannedParagraphs,
  type Database,
} from '@wikifake/db';
import { decode, gameApi, restError } from '@wikifake/protocol';

import { BAD_REQUEST, refuse } from './errors.js';
import { openRound, REFUSED, type SessionContext } from './session.js';
import { json } from '../respond.js';
import { readJson } from './body.js';

type Db = Database['db'];

/** The paragraphs this player has already been pointed at. */
async function scannedBy(db: Db, participantId: string): Promise<number[]> {
  const rows = await selectScannedParagraphs(db, participantId);
  return rows
    .map((row) => row.paragraphIndex)
    .filter((index): index is number => index !== null);
}

export async function handleScan(
  context: SessionContext,
  request: Request,
): Promise<Response> {
  const parsed = decode(gameApi.scanRequest, await readJson(request));
  if (!parsed.ok) {
    return json(
      restError,
      { code: 'bad_json', message: parsed.issues.join('; ') },
      { status: BAD_REQUEST },
    );
  }

  const access = await openRound(context, parsed.value.sessionId, request);
  if (!access.ok) return refuse(access.code, access.message);
  // A round that is over is a session that is over, and answers as one: nothing
  // may be bought or revealed after the debrief.
  if (access.round.endedAt !== null) return refuse(REFUSED.code, REFUSED.message);

  const { gameId, participantId } = access.round;

  // Indices and no prose: the scanner query cannot hand over an explanation.
  const falsified = (await selectFalsifiedIndices(context.db, gameId)).map(
    (row) => row.paragraphIndex,
  );

  // Bounded by how many paragraphs there are to designate. Each turn of the loop
  // either records a designation or discovers that a concurrent request already
  // took that one, in which case the choice is made again against the record
  // that landed — so a double-click cannot be answered with the same paragraph
  // twice.
  for (let attempt = 0; attempt <= falsified.length; attempt += 1) {
    const chosen = scan(
      falsified,
      { ...EMPTY_ITEM_STATE, scanned: await scannedBy(context.db, participantId) },
      parsed.value.marked,
    );

    if (chosen.paragraphIndex === null) {
      return json(gameApi.scanResponse, { paragraphIndex: null });
    }

    const recorded = await recordScan(context.db, {
      gameId,
      casterId: participantId,
      paragraphIndex: chosen.paragraphIndex,
    });
    if (recorded) {
      return json(gameApi.scanResponse, { paragraphIndex: chosen.paragraphIndex });
    }
  }

  // Every candidate was taken between the read and the write. Exhausted is the
  // truthful answer, and it is the same one the next request would get.
  return json(gameApi.scanResponse, { paragraphIndex: null });
}
