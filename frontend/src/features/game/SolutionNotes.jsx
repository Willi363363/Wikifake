/** Correction detaillee, affichee une fois la partie terminee.
 *  Les explications arrivent du serveur a ce moment-la seulement. */

import LabelMono from '@/ui/LabelMono';

function SolutionNotes({ solution }) {
  if (!solution?.length) return null;
  return (
    <section className="reveal-note">
      <LabelMono style={{ color: 'var(--accent)', display: 'block', marginBottom: 8 }}>
        Dossier post-mission · valeurs corrigées
      </LabelMono>
      <div className="solution-list">
        {solution.map((fake, position) => (
          <article key={fake.paragraph_index} className="solution-item">
            <header className="solution-head">
              <span className="mono solution-rank">
                #{String(position + 1).padStart(2, '0')} · paragraphe {fake.paragraph_index}
              </span>
            </header>
            <p className="solution-quote">« {fake.text} »</p>
            <p className="solution-truth">{fake.explanation}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export default SolutionNotes;
