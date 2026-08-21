# État des lieux — frontend (`frontend/`)

Vite + React 18, **modules ES**. Pas de state manager : l'état descend en props
depuis `app/App.jsx`, sauf les préférences, qui passent par un contexte.

## Les dossiers

| Dossier | Rôle |
|---|---|
| `src/config.js` | Constantes de jeu partagées (durée, barème, palettes). |
| `src/lib/` | Adaptateurs sans UI : `api` (REST), `ws` (socket + hook d'abonnement), `article` (modèle de l'article), `sound`. |
| `src/app/` | `App.jsx` — bascule lobby ↔ partie, détient la session. `SettingsContext.jsx` — préférences du joueur, persistées en localStorage. |
| `src/components/ui/` | Atomes présentationnels réutilisables. |
| `src/features/*/` | Une fonctionnalité par dossier : `lobby`, `game`, `items`, `waiting`, `chat`, `flag`, `leaderboard`, `debrief`. |
| `src/styles/` | Un fichier par domaine, importés par `main.jsx`. |
| `src/test/` | `setup.js` — bouchons jsdom des tests unitaires. |

## Trois règles à tenir

1. **Aucun `window.*` pour communiquer entre modules.** Une ancienne version
   passait l'article par `window.WIKIFAKE_BODY` et la fin de chargement par
   `window.__waitingScreenReady`. Tout passe par des props, des contextes ou
   des refs impératives.

2. **L'article est un seul objet**, construit par `lib/article.js` :
   `{ title, subtitle, infobox, body, fakes, totalFakes }`. `body` est une
   liste de blocs, chaque paragraphe une liste de segments (texte, lien, ou
   *token* cliquable).

   **`fakes` est vide pendant la manche** : le client ne sait pas quels
   paragraphes sont falsifiés. `withSolution(article, positions)` replie la
   correction reçue à la fin et retourne un nouvel objet — il ne mute pas
   l'article d'origine.

3. **L'état de jeu ne vit pas dans les préférences.** La phase de manche
   (`playing` / `results`) est un état React local de `GameSession`. Le
   contexte de préférences ne contient que ce qui n'influence aucune règle :
   palette, mode expert, affichage des curseurs et du classement. Un panneau
   de maquettage hébergeait auparavant les deux, avec un sélecteur d'écran
   cliquable en pleine partie.

## Vérifier le front

```bash
cd frontend
npm test        # unités : hooks, modèle d'article, appels API, composants
npm run build   # les modules se lient
npm run smoke   # les composants se rendent vraiment (react-dom/server)
```

Le smoke test attrape ce que le build ne voit pas : une prop renommée d'un côté
d'une frontière de feature. Il contient aussi des assertions **négatives** —
aucun paragraphe saboté dans le DOM pendant la manche, aucun panneau de
maquettage, aucune étiquette de session factice.
