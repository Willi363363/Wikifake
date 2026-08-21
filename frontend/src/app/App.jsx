/**
 * Top-level screen switch: the lobby, or a live round.
 *
 * It owns the session — the article being played, the room socket and who we
 * are in that room — and hands it to `GameSession`. Nothing else in the app
 * needs to know how a round was started (solo or multiplayer).
 */
import { useState, useCallback } from 'react';
import { buildArticle } from '../lib/article.js';
import { playSound } from '../lib/sound.js';
import { GAME_DURATION } from '../config.js';
import { Lobby } from '../features/lobby/index.js';
import { GameSession } from '../features/game/GameSession.jsx';
import { SettingsProvider } from './SettingsContext.jsx';

function AppRoutes() {
  const [session, setSession] = useState(null);

  /** Build a session from a backend `game_start` payload. */
  const startSession = useCallback((data, timeLimit, multiplayer = null) => {
    setSession({
      article: buildArticle(data),
      players: data.players || null,
      withItems: data.with_items,
      timeLimit: timeLimit || data.time_limit || GAME_DURATION,
      // Identifiant de session solo : c'est par lui que le client demande un
      // indice, un scan ou la correction. Absent en multijoueur, où tout
      // passe par le socket de la salle.
      soloId: data.session_id || null,
      multiplayer,
    });
    playSound('start');
  }, []);

  const startMultiplayerSession = useCallback((data, socket, username, roomCode, isHost) => {
    startSession(data, data.time_limit, { socket, username, roomCode, isHost });
  }, [startSession]);

  /** Back to the lobby, keeping the room connection alive. */
  const endRound = useCallback(() => {
    setSession((prev) => (prev ? { ...prev, article: null } : null));
  }, []);

  /** Leave the room for good: close the socket and drop the session. */
  const leaveRoom = useCallback(() => {
    setSession((prev) => {
      prev?.multiplayer?.socket?.close();
      return null;
    });
  }, []);

  if (!session?.article) {
    return (
      <Lobby
        onStart={startSession}
        onMultiplayerStart={startMultiplayerSession}
        existingMultiplayer={session?.multiplayer}
        onLeave={leaveRoom}
      />
    );
  }

  return <GameSession session={session} onEndRound={endRound} onLeave={leaveRoom} />;
}

export function App() {
  return (
    <SettingsProvider>
      <AppRoutes />
    </SettingsProvider>
  );
}
