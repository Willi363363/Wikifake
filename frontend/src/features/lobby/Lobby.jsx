/**
 * Everything that happens before a round starts.
 *
 * It is a small state machine over one screen at a time — entry, room, theme
 * vote, loading — and it owns the room socket until a round takes over.
 */
import { useState, useRef, useEffect, useCallback } from 'react';

import { createRoom } from '../../lib/api.js';
import { send, useSocketMessages } from '../../lib/ws.js';
import { WaitingScreen } from '../waiting/index.js';
import { ChatPanel } from '../chat/index.js';

import { LobbyEntry } from './LobbyEntry.jsx';
import { RoomLobby } from './RoomLobby.jsx';
import { ThemeVoting } from './ThemeVoting.jsx';
import { useRoomConnection } from './useRoomConnection.js';

export function Lobby({ onStart, onMultiplayerStart, existingMultiplayer, onLeave }) {
  const [screen, setScreen] = useState(existingMultiplayer ? 'room' : 'solo');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [category, setCategory] = useState('');
  const [timeLimit, setTimeLimit] = useState(180);
  const [withItems, setWithItems] = useState(true);

  const [username, setUsername] = useState(existingMultiplayer?.username || '');
  const [roomCode, setRoomCode] = useState(existingMultiplayer?.roomCode || '');

  const [players, setPlayers] = useState([]);
  // Le serveur est seul à décider qui est l'hôte (`Player.is_host`) et refuse
  // les commandes d'hôte aux autres. On lit son verdict, on ne le devine plus.
  const isHost = players.some((p) => p.name === username && p.isHost);
  const [isReady, setIsReady] = useState(false);
  const [voting, setVoting] = useState(null);
  const [selectedTheme, setSelectedTheme] = useState(null);

  const waitingScreenRef = useRef(null);

  const { socket, connect } = useRoomConnection(existingMultiplayer?.socket, {
    onClose: () => {
      setError('Déconnecté de la salle.');
      setScreen('join');
    },
  });

  // Coming back from a finished round: re-sync the room rather than trusting
  // whatever the previous screen left behind.
  useEffect(() => {
    if (!socket) return;
    setIsReady(false);
    send(socket, 'get_lobby');
  }, [socket]);

  const enterRound = useCallback((data) => {
    onMultiplayerStart(data, socket, username, roomCode, isHost);
  }, [onMultiplayerStart, socket, username, roomCode, isHost]);

  useSocketMessages(socket, (msg) => {
    switch (msg.type) {
      case 'lobby_update':
        setPlayers(msg.players);
        break;
      case 'theme_vote_start':
        setVoting({ submitted: [], total: msg.players ? msg.players.length : (players.length || 1) });
        setSelectedTheme(null);
        setScreen('theme-vote');
        break;
      case 'theme_vote_update':
        setVoting((prev) => (prev ? { ...prev, submitted: msg.submitted, total: msg.total } : null));
        break;
      case 'theme_selected':
        setSelectedTheme(msg);
        break;
      case 'game_start':
      case 'round_start':
        // The loading screen is normally already mounted (the server picks a
        // theme seconds before it has the article); if it is not, skip straight
        // into the round rather than dropping the payload.
        if (waitingScreenRef.current) waitingScreenRef.current.ready(msg.data);
        else enterRound(msg.data);
        break;
      case 'error':
        setError(msg.message);
        setLoading(false);
        setScreen('room');
        break;
      default:
        break;
    }
  });

  // ---- Actions --------------------------------------------------------------

  const startSolo = (e) => {
    e.preventDefault();
    if (!category) return;
    setError('');
    setScreen('solo-loading');
  };

  const host = async (e) => {
    e.preventDefault();
    if (!username) return;
    setLoading(true);
    setError('');
    try {
      const { room_code: code } = await createRoom();
      setRoomCode(code);
      connect(code, username);
      setLoading(false);
      setScreen('room');
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const join = (e) => {
    e.preventDefault();
    if (!username || !roomCode) return;
    setLoading(true);
    setError('');
    const code = roomCode.toUpperCase();
    setRoomCode(code);
    connect(code, username);
    setLoading(false);
    setScreen('room');
  };

  const toggleReady = () => {
    const next = !isReady;
    setIsReady(next);
    send(socket, 'set_ready', { ready: next, with_items: withItems, time_limit: timeLimit });
  };

  const forceStart = () => {
    setLoading(true);
    send(socket, 'force_start', { with_items: withItems, time_limit: timeLimit });
  };

  // ---- Screens --------------------------------------------------------------

  const chat = socket ? <ChatPanel ws={socket} username={username} roomCode={roomCode} /> : null;

  if (screen === 'solo-loading') {
    return (
      <WaitingScreen
        category={category}
        onReady={(data) => onStart(data, timeLimit)}
        onError={(message) => { setError(message); setScreen('solo'); }}
        isMultiplayer={false}
      />
    );
  }

  if (screen === 'theme-vote') {
    // Once a theme is drawn the players wait (and can play mini-games) while
    // the backend generates the article.
    if (selectedTheme) {
      return (
        <>
          <WaitingScreen
            ref={waitingScreenRef}
            category={selectedTheme.theme}
            isMultiplayer
            lobbyPlayers={players}
            roomCode={roomCode}
            onReady={enterRound}
            onError={(message) => { setError(message); setScreen('room'); }}
          />
          {chat}
        </>
      );
    }

    return (
      <>
        <ThemeVoting
          voting={voting}
          isHost={isHost}
          onSubmitTheme={(theme) => send(socket, 'submit_theme', { theme })}
          onForcePick={() => send(socket, 'force_pick')}
        />
        {chat}
      </>
    );
  }

  if (screen === 'room') {
    return (
      <>
        <RoomLobby
          roomCode={roomCode}
          players={players}
          isHost={isHost}
          isReady={isReady}
          loading={loading}
          error={error}
          timeLimit={timeLimit}
          onTimeLimitChange={setTimeLimit}
          withItems={withItems}
          onWithItemsChange={setWithItems}
          onToggleReady={toggleReady}
          onForceStart={forceStart}
          onLeave={onLeave}
        />
        {chat}
      </>
    );
  }

  return (
    <LobbyEntry
      mode={screen}
      onModeChange={(next) => { setScreen(next); setError(''); }}
      loading={loading}
      error={error}
      category={category}
      onCategoryChange={setCategory}
      timeLimit={timeLimit}
      onTimeLimitChange={setTimeLimit}
      onSoloSubmit={startSolo}
      username={username}
      onUsernameChange={setUsername}
      onHost={host}
      roomCode={roomCode}
      onRoomCodeChange={setRoomCode}
      onJoin={join}
    />
  );
}
