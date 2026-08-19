/**
 * A single clickable span of the article.
 *
 * Tokens are the unit the player interacts with: clicking marks one as suspect.
 * In expert mode a marked token turns into an inline input so the player can
 * type the value they believe is correct.
 */

export function ArticleToken({
  id, text, fakeId, state, expertValue, mode,
  onClick, onEdit, status, hinted, scanned,
}) {
  const cls = ['token'];
  if (status === 'found') cls.push('found');
  else if (status === 'missed') cls.push('missed');
  else if (status === 'false-positive') cls.push('false-positive');
  else if (state === 'selected') cls.push('selected');
  else if (state === 'edited') cls.push('edited');
  if (hinted && !status) cls.push('hinted');
  if (scanned && !status) cls.push('scanned');

  if (mode === 'expert' && state === 'edited') {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 4 }}>
        <span style={{
          fontFamily: "'Geist Mono', monospace",
          fontSize: 13, color: 'var(--bronze)',
          textDecoration: 'line-through',
          textDecorationColor: 'rgba(140, 109, 54, 0.55)',
          opacity: 0.7,
        }}>{text}</span>
        <span style={{ color: 'var(--bronze)', fontFamily: "'Geist Mono', monospace", fontSize: 11 }}>→</span>
        <input
          className="expert-input"
          value={expertValue}
          onChange={(e) => onEdit(id, e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Escape') onEdit(id, null); }}
          autoFocus
          placeholder="correct value"
          style={{ minWidth: `${Math.max(80, expertValue.length * 8)}px` }}
        />
      </span>
    );
  }

  return (
    <span
      className={cls.join(' ')}
      data-token-id={id}
      data-fake-id={fakeId || ''}
      onClick={(e) => { e.stopPropagation(); onClick(id, fakeId); }}
    >
      {text}
    </span>
  );
}
