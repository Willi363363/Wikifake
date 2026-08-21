/** Corps de l'article : la liste des paragraphes. */

import ArticleParagraph from './ArticleParagraph';

function ArticleBody({
  paragraphs,
  selected,
  notes,
  noteMode,
  scannedIndices,
  solutionIndices,
  revealed,
  onToggle,
  onNoteChange,
}) {
  const statusOf = (index) => {
    if (!revealed) return null;
    const isFake = solutionIndices.has(index);
    const isSelected = selected.has(index);
    if (isFake && isSelected) return 'found';
    if (isFake) return 'missed';
    if (isSelected) return 'false-positive';
    return null;
  };

  return (
    <>
      {paragraphs.map((paragraph) => (
        <ArticleParagraph
          key={paragraph.index}
          index={paragraph.index}
          text={paragraph.text}
          selected={selected.has(paragraph.index)}
          note={notes[paragraph.index]}
          noteMode={noteMode && !revealed}
          scanned={scannedIndices.has(paragraph.index)}
          status={statusOf(paragraph.index)}
          onToggle={revealed ? () => {} : onToggle}
          onNoteChange={onNoteChange}
        />
      ))}
    </>
  );
}

export default ArticleBody;
