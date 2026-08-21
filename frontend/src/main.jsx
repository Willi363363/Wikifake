/** Point d'entree du frontend. */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import App from './App';
import { ServerConfigProvider } from './state/ServerConfigContext';
import { SettingsProvider } from './state/SettingsContext';
import './styles/index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ServerConfigProvider>
      <SettingsProvider>
        <App />
      </SettingsProvider>
    </ServerConfigProvider>
  </StrictMode>,
);
