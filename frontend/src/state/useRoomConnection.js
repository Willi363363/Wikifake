/**
 * Connexion a une salle multijoueur.
 *
 * SEUL detenteur du socket. L'ecran affiche est deduit de `room.state`,
 * qui vient du serveur : plus de machine a etats client (`mode`) qui
 * divergeait de la realite serveur.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { createRoomSocket } from '@/net/socket';
import { CLIENT, SERVER } from '@/net/protocol';

const EMPTY = {
  room: null,
  themeVote: null,
  themeSelected: null,
  game: null,
  leaderboard: null,
  solution: null,
};

export function useRoomConnection() {
  const socketRef = useRef(null);
  const [identity, setIdentity] = useState(null); // { code, playerName }
  const [status, setStatus] = useState('idle'); // idle | connecting | connected | closed
  const [error, setError] = useState('');
  const [data, setData] = useState(EMPTY);

  const disconnect = useCallback(() => {
    socketRef.current?.close();
    socketRef.current = null;
    setIdentity(null);
    setStatus('idle');
    setError('');
    setData(EMPTY);
  }, []);

  const connect = useCallback((code, playerName) => {
    socketRef.current?.close();
    setStatus('connecting');
    setError('');
    setData(EMPTY);

    const socket = createRoomSocket({
      code,
      playerName,
      onOpen: () => {
        setStatus('connected');
        setIdentity({ code, playerName });
        socket.send(CLIENT.GET_LOBBY);
      },
      onClose: ({ intentional }) => {
        socketRef.current = null;
        setStatus('closed');
        if (!intentional) setError('Connexion a la salle perdue.');
      },
    });

    socket.subscribe((message) => {
      switch (message.type) {
        case SERVER.LOBBY_UPDATE:
          setData((prev) => ({ ...prev, room: message.room }));
          break;
        case SERVER.THEME_VOTE_START:
          setData((prev) => ({
            ...prev,
            themeVote: { submitted: [], total: prev.room?.players.length ?? 1 },
            themeSelected: null,
            game: null,
            leaderboard: null,
            solution: null,
          }));
          break;
        case SERVER.THEME_VOTE_UPDATE:
          setData((prev) => ({
            ...prev,
            themeVote: { submitted: message.submitted, total: message.total },
          }));
          break;
        case SERVER.THEME_SELECTED:
          setData((prev) => ({
            ...prev,
            themeSelected: { theme: message.theme, proposer: message.proposer },
          }));
          break;
        case SERVER.GAME_START:
          setError('');
          setData((prev) => ({
            ...prev,
            leaderboard: null,
            solution: null,
            game: {
              theme: message.theme,
              article: message.game,
              players: message.players,
              durationS: message.durationS,
              withItems: message.withItems,
            },
          }));
          break;
        case SERVER.GAME_END:
          setData((prev) => ({
            ...prev,
            leaderboard: message.leaderboard,
            solution: message.solution,
          }));
          break;
        case SERVER.ERROR:
          setError(message.message || 'Erreur serveur.');
          break;
        default:
          break; // les messages de gameplay sont consommes par GameScreen
      }
    });

    socketRef.current = socket;
  }, []);

  useEffect(() => () => socketRef.current?.close(), []);

  const send = useCallback((type, payload) => socketRef.current?.send(type, payload), []);
  const subscribe = useCallback(
    (listener) => socketRef.current?.subscribe(listener) ?? (() => {}),
    [],
  );

  const me = data.room?.players.find((p) => p.name === identity?.playerName) ?? null;

  return {
    status,
    error,
    clearError: () => setError(''),
    identity,
    room: data.room,
    me,
    isHost: Boolean(me?.isHost),
    themeVote: data.themeVote,
    themeSelected: data.themeSelected,
    game: data.game,
    leaderboard: data.leaderboard,
    solution: data.solution,
    connect,
    disconnect,
    send,
    subscribe,
    socket: socketRef.current,
  };
}
