/**
 * Routeur d'ecrans.
 *
 * L'ecran affiche en multijoueur est deduit de `room.state`, qui vient du
 * SERVEUR. L'ancienne version maintenait une variable `mode` cote client
 * (6 valeurs) qui divergeait de l'etat reel de la salle.
 */

import { useCallback, useState } from 'react';

import { playSound } from '@/lib/sound';
import { createRoom } from '@/net/api';
import { CLIENT } from '@/net/protocol';
import { useRoomConnection } from '@/state/useRoomConnection';
import { useSoloSession } from '@/state/useSoloSession';
import { useRoomEngine, useSoloEngine } from '@/state/engines';

import EntryScreen from '@/features/lobby/EntryScreen';
import RoomLobby from '@/features/lobby/RoomLobby';
import ThemeVoting from '@/features/lobby/ThemeVoting';
import WaitingScreen from '@/features/waiting/WaitingScreen';
import GameScreen from '@/features/game/GameScreen';

function App() {
  const connection = useRoomConnection();
  const solo = useSoloSession();
  const roomEngine = useRoomEngine(connection);
  const soloEngine = useSoloEngine(solo);

  const [busy, setBusy] = useState(false);
  const [entryError, setEntryError] = useState('');
  const [soloTopic, setSoloTopic] = useState('');

  // ---------------------------------------------------------------- solo
  const startSolo = useCallback(
    async (category, durationS) => {
      setBusy(true);
      setEntryError('');
      setSoloTopic(category);
      try {
        await solo.start(category, durationS);
        playSound('start');
      } catch (error) {
        setEntryError(error.message);
        setSoloTopic('');
      } finally {
        setBusy(false);
      }
    },
    [solo],
  );

  const leaveSolo = useCallback(() => {
    solo.reset();
    setSoloTopic('');
  }, [solo]);

  // --------------------------------------------------------- multijoueur
  const host = useCallback(
    async (playerName) => {
      setBusy(true);
      setEntryError('');
      try {
        const { room_code: code } = await createRoom();
        connection.connect(code, playerName);
      } catch (error) {
        setEntryError(error.message);
      } finally {
        setBusy(false);
      }
    },
    [connection],
  );

  const join = useCallback(
    (code, playerName) => {
      setEntryError('');
      connection.connect(code, playerName);
    },
    [connection],
  );

  // ------------------------------------------------------------- rendus
  // 1. Partie solo en cours
  if (soloEngine) {
    return (
      <GameScreen
        engine={soloEngine}
        soloResult={solo.result}
        solution={solo.result?.solution ?? null}
        leaderboard={null}
        onLeave={leaveSolo}
        onRestart={leaveSolo}
      />
    );
  }

  // 2. Generation d'une partie solo
  if (busy && soloTopic) {
    return <WaitingScreen topic={soloTopic} />;
  }

  // 3. Partie multijoueur en cours (ou son debrief)
  if (roomEngine) {
    return (
      <GameScreen
        engine={roomEngine}
        leaderboard={connection.leaderboard}
        solution={connection.solution}
        soloResult={null}
        onLeave={connection.disconnect}
        onRestart={() => connection.send(CLIENT.GET_LOBBY)}
      />
    );
  }

  // 4. Ecrans de salle
  if (connection.status === 'connecting') {
    return <WaitingScreen topic="Connexion à la salle…" />;
  }

  if (connection.room) {
    const state = connection.room.state;

    if (state === 'theme_voting' && !connection.themeSelected) {
      return (
        <ThemeVoting
          vote={connection.themeVote}
          isHost={connection.isHost}
          error={connection.error}
          onSubmitTheme={(theme) => connection.send(CLIENT.SUBMIT_THEME, { theme })}
          onForcePick={() => connection.send(CLIENT.FORCE_PICK)}
        />
      );
    }

    if (state === 'theme_voting' || state === 'generating') {
      return (
        <WaitingScreen
          topic={connection.themeSelected?.theme ?? 'Choix du thème…'}
          players={connection.room.players}
          roomCode={connection.room.code}
        />
      );
    }

    return (
      <RoomLobby
        room={connection.room}
        me={connection.me}
        isHost={connection.isHost}
        busy={false}
        error={connection.error}
        onToggleReady={() =>
          connection.send(CLIENT.SET_READY, { ready: !connection.me?.ready })
        }
        onOptionsChange={(options) => connection.send(CLIENT.SET_OPTIONS, options)}
        onStart={() => connection.send(CLIENT.START_VOTE)}
        onLeave={connection.disconnect}
      />
    );
  }

  // 5. Accueil
  return (
    <EntryScreen
      busy={busy}
      error={entryError || connection.error}
      onSolo={startSolo}
      onHost={host}
      onJoin={join}
      onDismissError={() => {
        setEntryError('');
        connection.clearError();
      }}
    />
  );
}

export default App;
