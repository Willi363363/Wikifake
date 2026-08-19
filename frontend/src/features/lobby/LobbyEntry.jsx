/**
 * The first screen: pick solo, host a room, or join one.
 *
 * Purely presentational — it reports intent upward and never touches the
 * socket itself.
 */
import { TimeLimitSlider } from './TimeLimitSlider.jsx';
import { LobbyCard } from './LobbyCard.jsx';

const TABS = [
  { id: 'solo', label: 'Solo' },
  { id: 'host', label: 'Héberger' },
  { id: 'join', label: 'Rejoindre' },
];

export function LobbyEntry({
  mode, onModeChange, loading, error,
  category, onCategoryChange, timeLimit, onTimeLimitChange, onSoloSubmit,
  username, onUsernameChange, onHost,
  roomCode, onRoomCodeChange, onJoin,
}) {
  return (
    <LobbyCard width={450} style={{ borderRadius: '8px' }}>
      <h2 style={{
        marginBottom: '20px', color: 'var(--text-primary)', textAlign: 'center',
        fontFamily: "'Instrument Serif', serif", fontSize: '36px',
      }}>WikiFake</h2>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onModeChange(tab.id)}
            style={{
              flex: 1, padding: '8px',
              background: mode === tab.id ? 'var(--ink)' : '#eee',
              color: mode === tab.id ? 'white' : 'black',
              border: 'none', borderRadius: '4px', cursor: 'pointer',
            }}
          >{tab.label}</button>
        ))}
      </div>

      {mode === 'solo' && (
        <form onSubmit={onSoloSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <input
            type="text" placeholder="Sujet Wikipédia (ex: Paris)"
            value={category} onChange={(e) => onCategoryChange(e.target.value)}
            style={{ padding: '10px', fontSize: '16px', borderRadius: '4px', border: '1px solid #ccc' }}
            disabled={loading}
          />
          <TimeLimitSlider value={timeLimit} onChange={onTimeLimitChange} disabled={loading} />
          <button type="submit" disabled={loading || !category} style={{
            padding: '12px', background: 'var(--bronze)', color: 'white',
            borderRadius: '4px', border: 'none', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold',
          }}>
            {loading ? 'Génération en cours...' : 'Lancer en Solo'}
          </button>
        </form>
      )}

      {mode === 'host' && (
        <form onSubmit={onHost} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <input
            type="text" placeholder="Votre Pseudo"
            value={username} onChange={(e) => onUsernameChange(e.target.value)}
            style={{ padding: '10px', fontSize: '16px', borderRadius: '4px', border: '1px solid #ccc' }}
            disabled={loading}
          />
          <button type="submit" disabled={loading || !username} style={{
            padding: '12px', background: 'var(--accent)', color: 'white',
            borderRadius: '4px', border: 'none', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold',
          }}>
            {loading ? 'Création...' : 'Créer la Salle'}
          </button>
        </form>
      )}

      {mode === 'join' && (
        <form onSubmit={onJoin} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <input
            type="text" placeholder="Code de la salle"
            value={roomCode} onChange={(e) => onRoomCodeChange(e.target.value)}
            style={{ padding: '10px', fontSize: '16px', borderRadius: '4px', border: '1px solid #ccc', textTransform: 'uppercase' }}
            disabled={loading}
          />
          <input
            type="text" placeholder="Votre Pseudo"
            value={username} onChange={(e) => onUsernameChange(e.target.value)}
            style={{ padding: '10px', fontSize: '16px', borderRadius: '4px', border: '1px solid #ccc' }}
            disabled={loading}
          />
          <button type="submit" disabled={loading || !username || !roomCode} style={{
            padding: '12px', background: 'var(--accent)', color: 'white',
            borderRadius: '4px', border: 'none', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold',
          }}>
            {loading ? 'Connexion...' : 'Rejoindre'}
          </button>
        </form>
      )}

      {error && <p style={{ color: 'red', marginTop: '15px', textAlign: 'center' }}>{error}</p>}
    </LobbyCard>
  );
}
