/**
 * Shown instead of the intel room while a rival's Brouilleur is active.
 *
 * The player can still open Intel — they just find it jammed, which reads
 * better than a dead button.
 */
export function HintLockedNotice({ onClose }) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.4)',
      }}
      onClick={onClose}
    >
      <div style={{
        background: 'white', borderRadius: 16, padding: '28px 36px',
        textAlign: 'center', boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
      }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
        <div style={{ fontFamily: "'Geist', sans-serif", fontWeight: 600, fontSize: 16, marginBottom: 6 }}>
          Intel verrouillé
        </div>
        <div style={{ color: 'var(--muted)', fontSize: 13 }}>
          Un joueur vous a bloqué l'accès aux hints temporairement.
        </div>
      </div>
    </div>
  );
}
