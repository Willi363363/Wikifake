/**
 * Ecran d'accueil : choix du mode (solo / heberger / rejoindre).
 *
 * Ne contient aucune logique reseau : il remonte l'intention au parent.
 * L'ancien `lobby.jsx` melangeait 6 ecrans, la gestion du socket, le vote
 * de theme et le rendu du salon dans 491 lignes.
 */

import { useState } from 'react';

import ErrorBanner from '@/ui/ErrorBanner';
import HostForm from './HostForm';
import JoinForm from './JoinForm';
import ModeTabs from './ModeTabs';
import SoloForm from './SoloForm';

const MODES = [
  { value: 'solo', label: 'Solo' },
  { value: 'host', label: 'Héberger' },
  { value: 'join', label: 'Rejoindre' },
];

function EntryScreen({ busy, error, onSolo, onHost, onJoin, onDismissError }) {
  const [mode, setMode] = useState('solo');

  const changeMode = (next) => {
    setMode(next);
    onDismissError?.();
  };

  return (
    <div className="centered-screen">
      <div className="lobby-card">
        <h1 className="lobby-title">WikiFake</h1>
        <p className="lobby-subtitle">
          Trouvez les informations falsifiées cachées dans un article Wikipédia.
        </p>

        <ModeTabs modes={MODES} value={mode} onChange={changeMode} />

        {mode === 'solo' && <SoloForm busy={busy} onSubmit={onSolo} />}
        {mode === 'host' && <HostForm busy={busy} onSubmit={onHost} />}
        {mode === 'join' && <JoinForm busy={busy} onSubmit={onJoin} />}

        <ErrorBanner>{error}</ErrorBanner>
      </div>
    </div>
  );
}

export default EntryScreen;
