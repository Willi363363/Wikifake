/** Salon d'une salle : joueurs, options (hote), bouton pret. */

import ErrorBanner from '@/ui/ErrorBanner';
import Button from '@/ui/Button';
import HostControls from './HostControls';
import PlayerList from './PlayerList';

function RoomLobby({
  room,
  me,
  isHost,
  busy,
  error,
  onToggleReady,
  onOptionsChange,
  onStart,
  onLeave,
}) {
  return (
    <div className="centered-screen">
      <div className="lobby-card">
        <button type="button" className="leave-button" onClick={onLeave}>
          Quitter
        </button>

        <h1 className="lobby-title">
          Salle <span className="room-code">{room.code}</span>
        </h1>
        <p className="lobby-subtitle">Partagez ce code pour que vos amis vous rejoignent.</p>

        <PlayerList players={room.players} />

        <div style={{ marginTop: 18 }}>
          <Button
            variant={me?.ready ? 'success' : 'secondary'}
            block
            disabled={busy}
            onClick={onToggleReady}
          >
            {me?.ready ? 'Prêt ! — annuler' : 'Je suis prêt'}
          </Button>
        </div>

        {isHost ? (
          <div style={{ marginTop: 14 }}>
            <HostControls
              room={room}
              busy={busy}
              onOptionsChange={onOptionsChange}
              onStart={onStart}
            />
          </div>
        ) : (
          <p className="vote-status">En attente du lancement par l&apos;hôte…</p>
        )}

        <ErrorBanner>{error}</ErrorBanner>
      </div>
    </div>
  );
}

export default RoomLobby;
