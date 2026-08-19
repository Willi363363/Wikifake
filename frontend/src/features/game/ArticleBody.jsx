/**
 * Renders the article body from the structured model built by lib/article.js.
 *
 * A paragraph is a list of segments: plain strings, wiki links, and tokens.
 * Only tokens are interactive, and only after `revealAll` do they show whether
 * the player was right.
 */
import { Fragment } from 'react';
import { ArticleToken } from './ArticleToken.jsx';

export function ArticleBody({
  body, marked, edited, mode, hintedTokenIds, scannedParagraphs,
  onTokenClick, onTokenEdit, revealAll,
}) {
  return (
    <>
      {body.map((block, bi) => (
        <div key={bi}>
          {block.heading && <h2>{block.heading}</h2>}
          {block.paragraphs.map((paragraph, pi) => (
            <p key={pi}>
              {paragraph.map((seg, si) => {
                if (typeof seg === 'string') return <Fragment key={si}>{seg}</Fragment>;

                if (seg.kind === 'link') {
                  return (
                    <a key={si} className="wikilink" href="#" onClick={(e) => e.preventDefault()}>
                      {seg.text}
                    </a>
                  );
                }

                if (seg.kind === 'token') {
                  const isMarked = marked[seg.id];
                  const editedValue = edited[seg.id];
                  const isEdited = editedValue !== undefined && editedValue !== null;
                  const isFake = !!seg.fake;

                  let state = null;
                  if (isMarked) state = 'selected';
                  if (isEdited) state = 'edited';

                  // After submission the token reports the verdict instead of the selection.
                  let status = null;
                  if (revealAll) {
                    if (isFake && (isMarked || isEdited)) status = 'found';
                    else if (isFake) status = 'missed';
                    else if (isMarked || isEdited) status = 'false-positive';
                  }

                  return (
                    <ArticleToken
                      key={si}
                      id={seg.id}
                      text={seg.text}
                      fakeId={seg.fake?.id}
                      state={state}
                      expertValue={editedValue || ''}
                      mode={mode}
                      onClick={onTokenClick}
                      onEdit={onTokenEdit}
                      status={status}
                      hinted={isFake && hintedTokenIds.has(seg.id) && !isMarked && !isEdited}
                      scanned={isFake && scannedParagraphs.has(seg.id) && !isMarked && !isEdited}
                    />
                  );
                }

                return null;
              })}
            </p>
          ))}
        </div>
      ))}
    </>
  );
}
