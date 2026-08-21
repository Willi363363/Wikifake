/**
 * Configuration servie par le backend (`GET /api/config`).
 *
 * Evite de dupliquer cote client les durees, bornes et le catalogue d'items.
 */

import { createContext, useContext, useEffect, useState } from 'react';

import { FALLBACK_CONFIG } from '@/config/constants';
import { fetchServerConfig } from '@/net/api';

const ServerConfigContext = createContext(FALLBACK_CONFIG);

export function ServerConfigProvider({ children }) {
  const [config, setConfig] = useState(FALLBACK_CONFIG);

  useEffect(() => {
    let cancelled = false;
    fetchServerConfig().then((loaded) => {
      if (!cancelled) setConfig(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <ServerConfigContext.Provider value={config}>{children}</ServerConfigContext.Provider>
  );
}

export function useServerConfig() {
  return useContext(ServerConfigContext);
}
