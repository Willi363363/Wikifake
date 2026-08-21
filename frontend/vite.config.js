import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The FastAPI backend serves `dist/` in production and owns /api + /ws.
// In dev, `npm run dev` proxies both to uvicorn so the app behaves identically.
const BACKEND = 'http://127.0.0.1:8000';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  // Tests unitaires : `npm test`. Le smoke test (rendu serveur) reste séparé,
  // il vérifie que l'arbre complet se monte ; ceux-ci vérifient les unités.
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
    css: false,
    include: ['src/**/*.test.{js,jsx}'],
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: BACKEND, changeOrigin: true },
      '/ping': { target: BACKEND, changeOrigin: true },
      '/ws': { target: BACKEND, ws: true },
    },
  },
});
