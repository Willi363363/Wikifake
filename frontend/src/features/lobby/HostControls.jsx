/** Options de partie et lancement. Visible uniquement pour l'hote — et le
 *  serveur refuse ces commandes a quiconque d'autre (`host_only=True`). */

import Button from '@/ui/Button';
import RangeField from '@/ui/RangeField';
import ToggleField from '@/ui/ToggleField';
import { useServerConfig } from '@/state/ServerConfigContext';

function HostControls({ room, busy, onOptionsChange, onStart }) {
  const { duration } = useServerConfig();
  const everyoneReady =
    room.players.length > 0 && room.players.every((player) => player.ready || !player.connected);

  return (
    <div className="lobby-form">
      <RangeField
        label="Limite de temps"
        value={room.durationS}
        min={duration.min}
        max={duration.max}
        disabled={busy}
        onChange={(value) => onOptionsChange({ durationS: value })}
      />

      <ToggleField
        label="🎁 Jouer avec les items"
        checked={room.withItems}
        disabled={busy}
        onChange={(value) => onOptionsChange({ withItems: value })}
      />

      <Button
        variant={everyoneReady ? 'primary' : 'ghost'}
        block
        disabled={busy}
        onClick={onStart}
      >
        {busy ? 'Génération…' : everyoneReady ? '🚀 Lancer la partie' : '⚡ Lancer malgré tout'}
      </Button>
    </div>
  );
}

export default HostControls;
