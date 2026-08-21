/**
 * Smoke-test entry: renders the real component tree with react-dom/server.
 *
 * `vite build` only proves the modules link. This renders them, so a prop
 * renamed on one side of a feature boundary fails here instead of in the
 * browser. Run with `npm run smoke`.
 */
import { renderToString } from 'react-dom/server';

import { App } from '../src/app/App.jsx';
import { GameSession } from '../src/features/game/GameSession.jsx';
import { buildArticle, withSolution } from '../src/lib/article.js';

/**
 * A round payload shaped exactly like the backend's `game_start` data.
 *
 * Il ne contient PAS `positions` : le serveur ne livre la solution qu'à la fin
 * de la manche. `SOLUTION` reproduit ce que renvoient `game_end` et
 * `/api/game/submit`.
 */
const ROUND = {
  topic: 'Tour Eiffel',
  wikipedia_url: 'https://fr.wikipedia.org/wiki/Tour_Eiffel',
  total_fakes: 2,
  paragraphs: [
    "La tour Eiffel est une tour de fer puddlé située à Paris, à l'extrémité nord-ouest du parc du Champ-de-Mars.",
    "Construite par Gustave Eiffel, elle fut achevée en 1889 pour l'Exposition universelle.",
    'Elle mesure 330 mètres de hauteur et reçoit environ sept millions de visiteurs par an.',
  ],
};

const SOLUTION = [
  { paragraph_index: 2, false_info_number: 1, false_statement: 'achevée en 1889',
    explanation: 'En réalité 1889.', hint: 'Vérifiez la date.' },
  { paragraph_index: 3, false_info_number: 2, false_statement: '330 mètres',
    explanation: 'En réalité 330 m.', hint: 'Vérifiez la hauteur.' },
];

export function renderLobby() {
  return renderToString(<App />);
}

function soloSession(article) {
  return {
    article,
    players: null,
    withItems: false,
    timeLimit: 300,
    soloId: 'smoke-session',
    multiplayer: null,
  };
}

export function renderRound() {
  return renderToString(
    <GameSession session={soloSession(buildArticle(ROUND))} onEndRound={() => {}} />,
  );
}

/** L'article une fois la correction reçue : les faux deviennent identifiables. */
export function renderRevealed() {
  const article = withSolution(buildArticle(ROUND), SOLUTION);
  return renderToString(
    <GameSession session={soloSession(article)} onEndRound={() => {}} />,
  );
}
