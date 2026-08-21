/**
 * Adaptateurs "moteur de partie".
 *
 * `GameScreen` ne connait QU'UNE interface, identique en solo et en
 * multijoueur. C'est ce qui permet d'ajouter un mode (contre-la-montre,
 * entrainement, ...) sans toucher a l'ecran de jeu.
 *
 * Interface :
 *   isMultiplayer, playerName, article, durationS, withItems, roster,
 *   socket, subscribe(fn), updateSelection(idx), submit(idx), unsubmit(),
 *   unlockHint(targetIndex) -> Promise<{targetIndex, hint}>,
 *   useItem(instanceId, targets), sendCursor(x, y)
 */

import { useMemo } from 'react';

import { CLIENT, SERVER } from '@/net/protocol';

const NOOP = () => {};

/** Moteur multijoueur adosse a `useRoomConnection`. */
export function useRoomEngine(connection) {
  const { identity, game, send, subscribe } = connection;

  return useMemo(() => {
    if (!identity || !game) return null;
    return {
      isMultiplayer: true,
      playerName: identity.playerName,
      roomCode: identity.code,
      article: game.article,
      theme: game.theme,
      durationS: game.durationS,
      withItems: game.withItems,
      roster: game.players,
      socket: connection.socket,
      subscribe,
      updateSelection: (selection) => send(CLIENT.SELECTION_UPDATE, { selection }),
      submit: (selection) => {
        send(CLIENT.SUBMIT_ANSWER, { selection });
        return Promise.resolve(null); // le resultat arrive via `game_end`
      },
      unsubmit: () => send(CLIENT.UNSUBMIT_ANSWER),
      unlockHint: (targetIndex) =>
        new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            unsubscribe();
            reject(new Error('Le serveur n a pas repondu.'));
          }, 8000);
          const unsubscribe = subscribe((message) => {
            if (message.type === SERVER.HINT_UNLOCKED && message.target_index === targetIndex) {
              clearTimeout(timeout);
              unsubscribe();
              resolve({ targetIndex, hint: message.hint });
            } else if (message.type === SERVER.ERROR && message.code === 'hints_locked') {
              clearTimeout(timeout);
              unsubscribe();
              reject(new Error(message.message));
            }
          });
          send(CLIENT.UNLOCK_HINT, { targetIndex });
        }),
      useItem: (instanceId, targets) => send(CLIENT.USE_ITEM, { instanceId, targets }),
      sendCursor: (x, y) => send(CLIENT.CURSOR, { x, y }),
    };
  }, [identity, game, send, subscribe, connection.socket]);
}

/** Moteur solo adosse a `useSoloSession`. */
export function useSoloEngine(solo, playerName = 'Vous') {
  const { session, unlockHint, submit } = solo;

  return useMemo(() => {
    if (!session) return null;
    return {
      isMultiplayer: false,
      playerName,
      roomCode: null,
      article: session.article,
      theme: session.article.topic,
      durationS: session.durationS,
      withItems: false,
      roster: [{ name: playerName, color: 'var(--accent)', isHost: true }],
      socket: null,
      subscribe: () => NOOP,
      updateSelection: NOOP,
      submit,
      unsubmit: NOOP,
      unlockHint: (targetIndex) =>
        unlockHint(targetIndex).then((payload) => ({
          targetIndex,
          hint: payload?.hint ?? '',
        })),
      useItem: NOOP,
      sendCursor: NOOP,
    };
  }, [session, submit, unlockHint, playerName]);
}
