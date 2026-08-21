/** Carte "article Wikipedia" : entete, corps, correction, curseurs. */

import LabelMono from '@/ui/LabelMono';
import { articleStyle, classesFor } from '@/features/effects/registry';
import ArticleBody from './ArticleBody';
import RemoteCursor from './RemoteCursor';
import SolutionNotes from './SolutionNotes';

function ArticleCard({
  article,
  activeEffectIds,
  selection,
  scannedIndices,
  solution,
  revealed,
  noteMode,
  cursors,
  roster,
  showCursors,
  onToggleParagraph,
  onNoteChange,
}) {
  const cardClasses = ['card-surface', 'article-card', ...classesFor(activeEffectIds, 'cardClasses')];
  const bodyClasses = ['article-body', ...classesFor(activeEffectIds, 'bodyClasses')];
  const solutionIndices = new Set((solution ?? []).map((fake) => fake.paragraph_index));

  return (
    <div className={cardClasses.join(' ')} style={articleStyle(activeEffectIds)}>
      <div className="article-toolbar">
        <LabelMono>Source · encyclopédie ouverte</LabelMono>
        <span className="article-vrule" />
        <LabelMono>Article · libre</LabelMono>
        <span className="spacer" />
        <span className="muted-link">Lire</span>
        <span className="muted-link">Modifier</span>
        <span className="muted-link">Historique</span>
      </div>

      <div className={bodyClasses.join(' ')}>
        <h1>{article.topic}</h1>
        <p className="article-subtitle">
          Article encyclopédique — {article.total_fakes} information
          {article.total_fakes > 1 ? 's' : ''} falsifiée
          {article.total_fakes > 1 ? 's' : ''} à retrouver.
        </p>

        {article.wikipedia_url && (
          <p className="article-source">
            <a href={article.wikipedia_url} target="_blank" rel="noreferrer noopener">
              Voir l&apos;article original
            </a>
          </p>
        )}

        <ArticleBody
          paragraphs={article.paragraphs}
          selected={selection.selected}
          notes={selection.notes}
          noteMode={noteMode}
          scannedIndices={scannedIndices}
          solutionIndices={solutionIndices}
          revealed={revealed}
          onToggle={onToggleParagraph}
          onNoteChange={onNoteChange}
        />

        {revealed && <SolutionNotes solution={solution} />}
      </div>

      {showCursors &&
        Object.entries(cursors).map(([name, position]) => {
          const player = roster.find((entry) => entry.name === name);
          if (!player) return null;
          return (
            <RemoteCursor
              key={name}
              x={position.x * window.innerWidth}
              y={position.y * window.innerHeight}
              name={name}
              color={player.color}
            />
          );
        })}
    </div>
  );
}

export default ArticleCard;
