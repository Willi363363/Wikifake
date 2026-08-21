/** Faux pop-up publicitaire, ferme par le joueur (item RICKROLL). */

import Button from '@/ui/Button';

const DECOYS = [
  { top: '28%', left: '18%', rotate: '-6deg' },
  { top: '32%', left: '58%', rotate: '5deg' },
  { top: '18%', left: '38%', rotate: '-3deg' },
];

function RickrollModal({ onClose }) {
  return (
    <div className="rickroll-backdrop" role="dialog" aria-modal="true" aria-label="Pop-up publicitaire">
      {DECOYS.map((decoy, index) => (
        <div
          key={decoy.left}
          className="rickroll-decoy"
          style={{ top: decoy.top, left: decoy.left, transform: `rotate(${decoy.rotate})` }}
        >
          <div className="rickroll-decoy-icon">🤡</div>
          <div className="rickroll-decoy-title">PUBLICITÉ INTRUSIVE #{index + 1}</div>
          <div className="rickroll-decoy-sub">Cliquez ici pour votre cadeau…</div>
        </div>
      ))}

      <div className="rickroll-main">
        <div className="rickroll-icon" aria-hidden="true">🤡</div>
        <h2 className="rickroll-title">POP-UP SPAM !</h2>
        <p className="rickroll-text">
          Félicitations ! Vous avez gagné une interruption gratuite offerte par un adversaire.
        </p>
        <p className="rickroll-warning">⚠ NE FERMEZ PAS CETTE FENÊTRE ⚠</p>
        <Button variant="danger" onClick={onClose}>
          Fermer (si vous pouvez)
        </Button>
      </div>
    </div>
  );
}

export default RickrollModal;
