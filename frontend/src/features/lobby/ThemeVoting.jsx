/**
 * Everyone proposes a subject; the server draws one of them.
 *
 * The host can cut the vote short once at least one theme has been submitted.
 */
import { useState } from 'react';
import { LobbyCard } from './LobbyCard.jsx';

export function ThemeVoting({ voting, isHost, onSubmitTheme, onForcePick }) {
  const [theme, setTheme] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const submit = (e) => {
    e.preventDefault();
    if (!theme.trim()) return;
    onSubmitTheme(theme);
    setSubmitted(true);
  };

  return (
    <LobbyCard style={{ padding: '40px' }}>
      <div style={{ textAlign: 'center' }}>
        <h2 style={{ fontFamily: "'Instrument Serif', serif", fontSize: 36, marginBottom: 10 }}>
          Phase de Vote
        </h2>
        <p style={{ color: 'var(--muted)', marginBottom: 20 }}>Proposez un thème pour la partie</p>

        {!submitted ? (
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input
              type="text" placeholder="Proposer un thème..."
              value={theme} onChange={(e) => setTheme(e.target.value)}
              style={{ padding: 12, borderRadius: 8, border: '1px solid #ccc' }}
            />
            <button type="submit" style={{
              padding: 12, background: 'var(--accent)', color: 'white',
              borderRadius: 8, border: 'none', fontWeight: 'bold',
            }}>Soumettre le thème</button>
          </form>
        ) : (
          <div style={{
            padding: 12, background: 'var(--green-soft)', borderRadius: 8,
            color: 'var(--green)', fontWeight: 'bold',
          }}>Thème soumis : {theme}</div>
        )}

        <div style={{ marginTop: 20 }}>
          <p>{voting?.submitted.length} / {voting?.total} joueurs ont voté</p>
          {isHost && voting?.submitted.length > 0 && (
            <button onClick={onForcePick} style={{
              marginTop: 10, padding: '8px 16px', background: 'white',
              border: '1px solid var(--line)', borderRadius: 8, cursor: 'pointer',
            }}>Choisir maintenant</button>
          )}
        </div>
      </div>
    </LobbyCard>
  );
}
