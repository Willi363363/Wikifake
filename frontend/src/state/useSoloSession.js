/**
 * Partie solo. Meme surface que la partie multijoueur (cf. `engines.js`)
 * pour que `GameScreen` soit strictement identique dans les deux modes.
 */

import { useCallback, useState } from 'react';

import { startSoloGame, submitSoloAnswer, unlockSoloHint } from '@/net/api';

export function useSoloSession() {
  const [session, setSession] = useState(null); // { id, article, durationS }
  const [result, setResult] = useState(null); // { breakdown, check, solution }
  const [error, setError] = useState('');

  const start = useCallback(async (category, durationS) => {
    setError('');
    setResult(null);
    const payload = await startSoloGame(category, durationS);
    setSession({ id: payload.session_id, article: payload.game, durationS: payload.durationS });
    return payload;
  }, []);

  const unlockHint = useCallback(
    async (targetIndex) => {
      if (!session) return null;
      return unlockSoloHint(session.id, targetIndex);
    },
    [session],
  );

  const submit = useCallback(
    async (selection) => {
      if (!session) return null;
      const payload = await submitSoloAnswer(session.id, selection);
      setResult(payload);
      return payload;
    },
    [session],
  );

  const reset = useCallback(() => {
    setSession(null);
    setResult(null);
    setError('');
  }, []);

  return { session, result, error, setError, start, unlockHint, submit, reset };
}
