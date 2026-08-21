/**
 * Un paragraphe cliquable de l'article.
 *
 * Remplace `ArticleToken` + le format a segments (`{kind:'token'|'link'}`)
 * qui n'etait plus alimente par le backend. Un paragraphe = un identifiant
 * = un index 1-base, la meme valeur du clic jusqu'au score serveur.
 */

function ArticleParagraph({
  index,
  text,
  selected,
  note,
  noteMode,
  scanned,
  status,
  onToggle,
  onNoteChange,
}) {
  const classes = ['token'];
  if (status) classes.push(status);
  else if (selected) classes.push('selected');
  if (scanned && !status) classes.push('scanned');

  return (
    <p>
      <span
        className={classes.join(' ')}
        data-paragraph={index}
        role="button"
        tabIndex={0}
        aria-pressed={selected}
        aria-label={`Paragraphe ${index}`}
        onClick={() => onToggle(index)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onToggle(index);
          }
        }}
      >
        {text}
      </span>

      {noteMode && selected && (
        <input
          className="expert-input"
          value={note ?? ''}
          placeholder="valeur correcte"
          aria-label={`Correction proposée pour le paragraphe ${index}`}
          onChange={(event) => onNoteChange(index, event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') onNoteChange(index, null);
          }}
        />
      )}
    </p>
  );
}

export default ArticleParagraph;
