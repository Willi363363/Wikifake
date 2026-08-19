/**
 * Who is in the room and whether they have declared themselves ready.
 *
 * The first player in the list is the host — the backend keeps insertion order.
 */
export function PlayerList({ players }) {
  return (
    <div style={{ margin: '20px 0' }}>
      <h3 style={{ fontSize: '16px', color: 'var(--ink)', marginBottom: '10px' }}>
        Joueurs ({players.length}) :
      </h3>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {players.map((player, i) => (
          <li key={player.name || i} style={{
            padding: '8px', borderBottom: '1px solid #eee',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: player.color || '#ccc' }} />
              <span style={{ fontWeight: 500, color: 'var(--ink)' }}>
                {player.name} {i === 0 ? '👑' : ''}
              </span>
            </div>
            <span style={{
              fontSize: '12px', fontWeight: '600', padding: '3px 10px', borderRadius: '999px',
              background: player.ready ? 'var(--green-soft)' : '#f3f3f3',
              color: player.ready ? 'var(--green)' : 'var(--muted)',
            }}>
              {player.ready ? '✓ Prêt' : 'En attente'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
