/**
 * The waiting room: who's here, the host's round settings, and the start button.
 *
 * Only the host sees the settings; everyone else just toggles ready.
 */
import { LobbyCard } from './LobbyCard.jsx';
import { PlayerList } from './PlayerList.jsx';
import { TimeLimitSlider } from './TimeLimitSlider.jsx';
import { ItemsToggle } from './ItemsToggle.jsx';

export function RoomLobby({
  roomCode, players, isHost, isReady, loading, error,
  timeLimit, onTimeLimitChange, withItems, onWithItemsChange,
  onToggleReady, onForceStart, onLeave,
}) {
  const everyoneReady = players.length > 0 && players.every((p) => p.ready);

  return (
    <LobbyCard containerStyle={{ height: 'auto', minHeight: '100vh', padding: 20 }}>
      {onLeave && (
        <button onClick={onLeave} style={{
          position: 'absolute', top: 16, right: 16,
          background: 'transparent', border: 'none', color: 'var(--danger)',
          cursor: 'pointer', fontWeight: 600, fontSize: 13,
        }}>Quitter</button>
      )}

      <h2 style={{
        textAlign: 'center', fontFamily: "'Instrument Serif', serif",
        fontSize: '32px', margin: '0 0 4px',
      }}>Salle: {roomCode}</h2>

      <PlayerList players={players} />

      {isHost ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <TimeLimitSlider value={timeLimit} onChange={onTimeLimitChange} disabled={loading} />
          <ItemsToggle value={withItems} onChange={onWithItemsChange} />

          <div style={{ display: 'flex', gap: '10px', flexDirection: 'column' }}>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={onToggleReady} disabled={loading} style={{
                flex: 1, padding: '12px',
                background: isReady ? 'var(--green)' : 'var(--bronze)', color: 'white',
                borderRadius: '4px', border: 'none', cursor: 'pointer', fontWeight: 'bold',
              }}>
                {isReady ? 'Prêt ! — Annuler' : 'Je suis prêt'}
              </button>
              {!everyoneReady && (
                <button onClick={onForceStart} disabled={loading} style={{
                  flex: 1, padding: '12px', background: 'white', color: 'var(--ink)',
                  border: '1px solid var(--line)', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold',
                }}>⚡ Force Start</button>
              )}
            </div>
            {everyoneReady && (
              <button onClick={onForceStart} disabled={loading} style={{
                width: '100%', padding: '14px', borderRadius: '8px', border: 'none',
                cursor: 'pointer', fontWeight: 'bold', fontSize: '16px',
                background: 'linear-gradient(135deg, var(--accent), #2a7568)', color: 'white',
                boxShadow: '0 4px 18px rgba(31,87,77,0.25)',
              }}>
                {loading ? 'Génération en cours...' : '🚀 Lancer la partie !'}
              </button>
            )}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <p style={{ textAlign: 'center', fontStyle: 'italic', color: 'var(--muted)' }}>
            En attente de l'hôte pour lancer la partie...
          </p>
          <button onClick={onToggleReady} disabled={loading} style={{
            width: '100%', padding: '12px',
            background: isReady ? 'var(--green)' : 'var(--bronze)', color: 'white',
            borderRadius: '4px', border: 'none', cursor: 'pointer', fontWeight: 'bold',
          }}>
            {isReady ? 'Prêt !' : 'Je suis prêt'}
          </button>
        </div>
      )}

      {error && <p style={{ color: 'red', marginTop: '10px', textAlign: 'center' }}>{error}</p>}
    </LobbyCard>
  );
}
