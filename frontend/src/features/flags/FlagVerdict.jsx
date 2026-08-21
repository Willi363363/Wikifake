/** Verdict de la verification automatique d'un signalement. */

import Button from '@/ui/Button';
import { verdictStyle } from './verdicts';

function FlagVerdict({ result, onClose }) {
  const verification = result?.verification ?? {};
  const style = verdictStyle(verification.verdict);
  const sources = verification.sources_found ?? [];

  return (
    <div className="flag-verdict">
      <div className="verdict-badge" style={{ background: style.bg }}>
        <span className="verdict-icon" aria-hidden="true">
          {style.icon}
        </span>
        <div>
          <p className="verdict-label" style={{ color: style.text }}>
            {style.label}
          </p>
          <p className="verdict-reasoning" style={{ color: style.text }}>
            {verification.reasoning}
          </p>
          <p className="verdict-confidence" style={{ color: style.text }}>
            Confiance IA : {verification.confidence ?? '—'}%
          </p>
        </div>
      </div>

      {sources.length > 0 && (
        <section className="verdict-sources">
          <h3 className="verdict-sources-title">Éléments contextuels trouvés</h3>
          {sources.map((source, index) => (
            <p key={index} className="verdict-source">
              {source}
            </p>
          ))}
        </section>
      )}

      <p className="verdict-status">
        Rapport enregistré (ID&nbsp;: <code>{result?.id}</code>) — statut&nbsp;:{' '}
        <strong>{result?.status?.replace(/_/g, ' ')}</strong>
      </p>

      <div className="verdict-actions">
        <Button variant="primary" onClick={onClose}>
          Fermer
        </Button>
      </div>
    </div>
  );
}

export default FlagVerdict;
