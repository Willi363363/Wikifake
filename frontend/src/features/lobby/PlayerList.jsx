/** Liste des joueurs d'une salle. L'hote vient du SERVEUR (`isHost`), il
 *  n'est plus deduit de la position dans le tableau. */

function PlayerList({ players }) {
  return (
    <div>
      <h2 className="field-label">Joueurs ({players.length})</h2>
      <ul className="player-list">
        {players.map((player) => (
          <li key={player.name} className="player-row">
            <span className="player-identity">
              <span className="player-dot" style={{ background: player.color }} />
              <span className="player-name">
                {player.name}
                {player.isHost && <span title="Hôte"> 👑</span>}
              </span>
            </span>
            {!player.connected ? (
              <span className="player-badge offline">Déconnecté</span>
            ) : (
              <span className={`player-badge${player.ready ? ' ready' : ''}`}>
                {player.ready ? '✓ Prêt' : 'En attente'}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default PlayerList;
