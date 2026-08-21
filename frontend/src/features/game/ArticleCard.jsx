/**
 * The paper card the article is printed on.
 *
 * Besides the article itself it carries every item-driven distortion (blur,
 * invert, mirror, shake, spin, censorship bars, shrunk text), because those
 * effects all target this one surface rather than the whole page.
 */
import { LabelMono } from '../../components/ui/index.js';
import { ArticleBody } from './ArticleBody.jsx';
import { ArticleAttribution } from './ArticleAttribution.jsx';

export function ArticleCard({
  article, marked, edited, mode, hintedTokenIds, scannedParagraphs,
  onTokenClick, onTokenEdit, revealAll, effects, articleRef, children,
}) {
  const {
    blur = false, invert = false, mirror = false,
    earthquake = false, spin = false, blackout = false, tiny = false,
  } = effects || {};

  const filter = [
    blur ? 'blur(6px)' : '',
    invert ? 'invert(1) hue-rotate(180deg)' : '',
  ].filter(Boolean).join(' ') || 'none';

  return (
    <div
      ref={articleRef}
      className={[earthquake ? 'earthquake-active' : '', spin ? 'spin-active' : '']
        .filter(Boolean).join(' ')}
      style={{
        background: 'white',
        border: '1px solid var(--line)',
        borderRadius: 18,
        padding: '32px 44px 44px',
        boxShadow: 'var(--shadow-md)',
        position: 'relative',
        filter,
        transform: mirror ? 'scaleX(-1)' : undefined,
        transition: 'filter 300ms, transform 300ms',
        // While blurred the article must be unreadable AND unclickable.
        userSelect: blur ? 'none' : 'auto',
        pointerEvents: blur ? 'none' : 'auto',
      }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14, marginBottom: 22,
        paddingBottom: 12, borderBottom: '1px solid var(--line)',
      }}>
        <LabelMono>Source · Wikipédia</LabelMono>
        <span style={{ width: 1, height: 12, background: 'var(--line)' }} />
        <LabelMono>Texte modifié</LabelMono>
        <span style={{ flex: 1 }} />
        {article.sourceUrl && (
          <a
            href={article.sourceUrl}
            target="_blank"
            rel="noreferrer noopener"
            style={{ fontSize: 12, color: '#0645ad', fontWeight: 500 }}
          >
            Voir l’original
          </a>
        )}
      </div>

      <div className={['article-body', blackout ? 'blackout-active' : '', tiny ? 'tiny-active' : '']
        .filter(Boolean).join(' ')}>
        <h1>{article.title}</h1>
        <p style={{ fontStyle: 'italic', color: '#54595d', fontSize: 14.5, margin: '0 0 22px 0' }}>
          {article.subtitle}.
        </p>

        <div style={{
          background: '#fafaf7', border: '1px solid #ebe9e2', padding: '10px 14px',
          fontSize: 13, marginBottom: 22, width: 'fit-content',
          fontFamily: "'Spectral', serif",
          borderRadius: 8,
        }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>
            Contents <span style={{ color: '#54595d', fontSize: 11, fontWeight: 400 }}>[hide]</span>
          </div>
          <ol style={{ margin: 0, paddingLeft: 20, color: '#0645ad', lineHeight: 1.75 }}>
            <li>Article body</li>
            <li>Details</li>
            <li>More information</li>
            <li>Culture and Landmarks</li>
          </ol>
        </div>

        <ArticleBody
          body={article.body}
          marked={marked}
          edited={edited}
          mode={mode}
          hintedTokenIds={hintedTokenIds}
          scannedParagraphs={scannedParagraphs}
          onTokenClick={onTokenClick}
          onTokenEdit={onTokenEdit}
          revealAll={revealAll}
        />

        {revealAll && <RevealedFakes fakes={article.fakes} />}

        <ArticleAttribution topic={article.title} sourceUrl={article.sourceUrl} />
      </div>

      {children}
    </div>
  );
}

/** Post-mission listing of every sabotage and the truth behind it. */
function RevealedFakes({ fakes }) {
  return (
    <div className="reveal-note">
      <LabelMono style={{ color: 'var(--accent)', display: 'block', marginBottom: 8 }}>
        Post-mission dossier · Corrected values
      </LabelMono>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {fakes.map((fake, i) => (
          <div key={fake.id} style={{
            paddingBottom: 10,
            borderBottom: i < fakes.length - 1 ? '1px dashed var(--line)' : 'none',
            fontFamily: "'Geist', sans-serif", fontSize: 13.5,
          }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
              <span className="mono" style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 600, letterSpacing: '0.1em' }}>
                #{String(i + 1).padStart(2, '0')}
              </span>
              <span style={{
                fontFamily: "'Spectral', serif",
                fontStyle: 'italic',
                fontSize: 15, color: 'var(--ink)',
              }}>"{fake.text}"</span>
            </div>
            <div style={{ color: 'var(--ink-2)', lineHeight: 1.55, fontSize: 13 }}>{fake.truth}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
