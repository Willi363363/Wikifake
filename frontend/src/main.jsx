/**
 * Application entry point.
 *
 * Owns the two things that are genuinely global: the stylesheet order and the
 * boot splash that index.html paints before this bundle arrives.
 */
import { createRoot } from 'react-dom/client';

import './styles/tokens.css';
import './styles/base.css';
import './styles/animations.css';
import './styles/ui.css';
import './styles/article.css';
import './styles/effects.css';
import './styles/waiting.css';
import './styles/minigames.css';
import './styles/lobby.css';

import { App } from './app/App.jsx';

createRoot(document.getElementById('root')).render(<App />);

// Fade the splash once React has painted, matching the original 200ms beat.
requestAnimationFrame(() => {
  setTimeout(() => document.getElementById('splash')?.classList.add('fade'), 200);
});
