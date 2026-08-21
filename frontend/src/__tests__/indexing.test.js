/**
 * Indexation et partage.
 *
 * Le jeu affiche des faits volontairement faussés attribués à Wikipédia :
 * les laisser indexer serait le risque le plus sérieux du projet. Et sans
 * balises de partage, un lien partagé n'affiche ni titre ni image, ce qui
 * empêche toute propagation.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

const HTML = read('../../index.html');
const ROBOTS = read('../../public/robots.txt');
const SITEMAP = read('../../public/sitemap.xml');

describe('robots.txt', () => {
  it('interdit l’API et les WebSockets', () => {
    expect(ROBOTS).toMatch(/Disallow: \/api\//);
    expect(ROBOTS).toMatch(/Disallow: \/ws\//);
  });

  it('exclut les robots d’entraînement de modèles', () => {
    for (const bot of ['GPTBot', 'ClaudeBot', 'Google-Extended', 'CCBot']) {
      expect(ROBOTS).toContain(bot);
    }
  });

  it('déclare le sitemap', () => {
    expect(ROBOTS).toMatch(/^Sitemap: https?:\/\/\S+\/sitemap\.xml$/m);
  });
});

describe('métadonnées de la page', () => {
  it('a un titre et une description exploitables', () => {
    expect(HTML).toMatch(/<title>[^<]{20,80}<\/title>/);
    const description = HTML.match(/name="description"\s+content="([^"]+)"/s)?.[1] ?? '';
    // Trop court : inutile. Trop long : tronqué par Google.
    expect(description.length).toBeGreaterThan(70);
    expect(description.length).toBeLessThan(320);
  });

  it('a les balises de partage indispensables', () => {
    for (const tag of ['og:title', 'og:description', 'og:image', 'og:url', 'twitter:card']) {
      expect(HTML).toContain(tag);
    }
  });

  it('déclare une URL canonique et la langue', () => {
    expect(HTML).toMatch(/rel="canonical"/);
    expect(HTML).toMatch(/<html lang="fr">/);
  });

  it('n’a plus de texte d’interface en anglais dans le splash', () => {
    expect(HTML).not.toMatch(/Initializing intelligence system/);
  });
});

describe('sitemap.xml', () => {
  it('déclare la page d’accueil', () => {
    expect(SITEMAP).toMatch(/<loc>https?:\/\/\S+\/<\/loc>/);
  });
});
