/** Phase de vote : chaque joueur propose un theme. */

import { useState } from 'react';

import Button from '@/ui/Button';
import ErrorBanner from '@/ui/ErrorBanner';

function ThemeVoting({ vote, isHost, error, onSubmitTheme, onForcePick }) {
  const [theme, setTheme] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const submit = (event) => {
    event.preventDefault();
    const value = theme.trim();
    if (!value) return;
    onSubmitTheme(value);
    setSubmitted(true);
  };

  return (
    <div className="centered-screen">
      <div className="lobby-card">
        <h1 className="lobby-title">Phase de vote</h1>
        <p className="lobby-subtitle">Proposez un thème pour la partie.</p>

        {submitted ? (
          <div className="vote-submitted">Thème soumis : {theme}</div>
        ) : (
          <form className="lobby-form" onSubmit={submit}>
            <input
              className="text-input"
              type="text"
              placeholder="ex. volcans, Renaissance, Japon…"
              value={theme}
              onChange={(event) => setTheme(event.target.value)}
              maxLength={80}
              autoComplete="off"
              aria-label="Thème proposé"
            />
            <Button type="submit" variant="primary" block disabled={!theme.trim()}>
              Soumettre le thème
            </Button>
          </form>
        )}

        <p className="vote-status">
          {vote ? `${vote.submitted.length} / ${vote.total} joueurs ont voté` : 'Ouverture du vote…'}
        </p>

        {isHost && (
          <Button variant="ghost" block onClick={onForcePick}>
            Choisir maintenant
          </Button>
        )}

        <ErrorBanner>{error}</ErrorBanner>
      </div>
    </div>
  );
}

export default ThemeVoting;
