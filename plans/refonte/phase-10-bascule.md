# Phase 10 — Bascule

| | |
|---|---|
| **État** | à faire |
| **Branche** | `feat/refonte-phase-10` |
| **Dépend de** | toutes les autres (0 à 9) |
| **Livre** | un dépôt sans Python, la production sur la nouvelle stack |

## Objectif

Supprimer le Python et basculer la production. Condition d'entrée unique et
non négociable : **chaque ligne de `01-contrat-a-preserver.md` doit avoir un
test équivalent dans la nouvelle stack**. Les étapes 10.1 à 10.8 sont cette
vérification, section par section ; rien d'autre ne commence avant.

## Pourquoi maintenant

En dernier, par construction : chaque invariant du contrat a coûté un bug en
production, et supprimer le Python supprime aussi ses tests — toute ligne
sans équivalent perdrait sa garantie sans bruit. Le Python reste tant qu'une
seule ligne n'est pas couverte, et cela ne se négocie pas à l'avance. Si les
phases précédentes ont fait leur travail, il ne reste ici que de la
vérification et du démontage.

## Étapes

Pour 10.1 à 10.8, la règle de fin est commune : **chaque puce de la section
pointe vers un test nommé (fichier et cas) de la nouvelle stack, la
correspondance est consignée dans la description de la PR, et ces tests
passent en CI**. Un trou découvert ne se comble pas ici : on retourne dans
la phase concernée, sur sa branche.

### 10.1 — Cocher « Autorité serveur »

Payload de départ sans solution — vérifié par clés **et par valeurs** —,
score serveur et pénalités client ignorées, indices monotones facturés une
fois, `HINT_LOCK`, vol de score et SCANNER appliqués serveur, rôle d'hôte
vérifié serveur, promotion et fin de salle.

**Fini quand** : la règle commune est remplie pour la section.

### 10.2 — Cocher « Le barème »

La formule, les constantes, le coût d'indice non cumulatif, le score négatif
possible, pas de bonus au-delà du délai, et le cas de référence
`tp=3, fp=1, pénalité=20, volé=50, 200 s restants sur 300 → 400`.

**Fini quand** : la règle commune est remplie pour la section.

### 10.3 — Cocher « Génération d'article »

`positions` désigne les paragraphes réellement modifiés, parité d'index
stricte, index base 1, déduplication, normalisation des espaces, générateur
sans état, échec propre sur Wikipédia introuvable.

**Fini quand** : la règle commune est remplie, fixtures HTML réelles à l'appui.

### 10.4 — Cocher « Cache et comptabilité »

Clés normalisées, copies à l'entrée et à la sortie, TTL 6 h, 3 variantes,
LRU 200, rotation des variantes, échec ni mis en cache ni compté,
`cache_hit_rate` et `per_generated_game` exposés.

**Fini quand** : la règle commune est remplie pour la section.

### 10.5 — Cocher « Robustesse du transport »

Pseudo validé et rejets typés, homonyme refusé, `bad_json` sans fermeture,
chat borné, curseurs bornés et rate-limités, codes de salle uniques et
plafond 503, trames au-delà de 64 000 caractères → fermeture 1009.

**Fini quand** : la règle commune est remplie, tests protocole et e2e
confondus.

### 10.6 — Cocher « Conformité et indexation »

Attribution CC BY-SA pendant et après la manche, `robots.txt` avec exclusion
des robots d'entraînement, `<html lang="fr">`, meta bornées, Open Graph,
canonical, sitemap.

**Fini quand** : la règle commune est remplie pour la section.

### 10.7 — Cocher « Identité du déploiement »

`/ping` exact, `/api/health` au champ près, clé API jamais exposée, `GET /`
en HTML 200 avec `<title>` non vide.

**Fini quand** : la règle commune est remplie — la phase 9 a déjà dû la
remplir, cette étape le constate, sans rien réécrire.

### 10.8 — Cocher « Le verrou documentation ↔ code »

Le test généré-versus-commité de la phase 9 tourne en CI et couvre ce que
couvrait `test_architecture_doc.py` : messages entrants, sortants, routes.

**Fini quand** : casser volontairement la doc générée fait échouer la CI.

### 10.9 — Supprimer le Python

`backend/`, `main.py`, `pytest.ini`, `requirements.txt`, `Dockerfile`,
`render.yaml` — et le `frontend/` Vite s'il vit encore. Les jobs pytest et
npm de la CI partent avec le code qu'ils testaient. Les cibles du `Makefile`
sont réécrites en scripts pnpm, puis le `Makefile` disparaît ; `.githooks/`
et `plans/methode/`, qui citent `make check` et `make hooks`, suivent.

**Fini quand** : un clone neuf suit le `README` et obtient un environnement
fonctionnel sans Python installé, et
`pnpm build && pnpm test && pnpm lint && pnpm typecheck` passent.

### 10.10 — Tendre le filet de retour arrière

Au moment de la bascule, le service Render ne sera pas supprimé mais
**suspendu**, sa dernière image intacte. La procédure de retour tient sur
une page : réveiller Render, repointer le domaine, restaurer `DEPLOY_URL` ;
le code Python revient par `git revert` du merge si un correctif s'impose.
À écrire noir sur blanc : comptes et historique créés après la bascule
restent dans Neon mais deviennent inaccessibles le temps du retour.

**Fini quand** : un essai à blanc (suspendre puis réveiller, hors heures de
jeu) a réussi — le `/api/health` de Render répond avec l'ancien commit — et
la procédure est écrite.

### 10.11 — Fusionner et basculer la production

Couper l'`autoDeploy` Render avant la fusion (sinon elle déclenche un build
sur un `Dockerfile` disparu). PR `feat/refonte` → `staging` puis `staging` →
`main`, selon `01-flux-git.md`. Puis la bascule : domaine vers Vercel, client
vers l'URL WebSocket Fly, variables d'URL de la sonde mises à jour, Render
suspendu (voir 10.10).

**Fini quand** : `deploy-check` est verte sur `main` contre la nouvelle
production — le commit servi par les deux services égale le SHA fusionné —
et une partie multijoueur se joue sur le domaine public.

### 10.12 — Réécrire l'état des lieux

`plans/etat-des-lieux/` décrit désormais la stack réelle : l'architecture
cible devenue l'existant, la dette restante, et `01-contrat-a-preserver.md`
qui ne disparaît pas — il reste la liste des invariants, chacun adossé à ses
tests TypeScript. `plans/etat-des-lieux/` décrit alors la nouvelle stack, plus l'ancienne.

**Fini quand** : un lecteur qui n'a jamais vu le projet comprend
l'architecture depuis `plans/etat-des-lieux/` sans rencontrer une mention de
FastAPI, et le contrôle des 200 lignes passe.

## Porte de sortie

- La grille de `01-contrat-a-preserver.md` est intégralement cochée : chaque
  ligne pointe un test nommé qui passe en CI.
- Plus un fichier Python dans le dépôt ; pnpm a remplacé `make`.
- La production publique est servie par Vercel et Fly, `deploy-check` verte.
- Le retour arrière est écrit et a été essayé à blanc.
- L'état des lieux décrit la stack réelle.

## Invariants concernés

Tous. Cette phase **est** la vérification du contrat entier : c'est sa
condition d'entrée, pas un à-côté.

## Pièges

- **Cocher de mémoire.** « C'est couvert quelque part » n'est pas une case
  cochée : chaque ligne exige un fichier et un nom de test.
- **Supprimer le service Render au lieu de le suspendre** : le filet de
  retour arrière disparaît au moment précis où l'on peut en avoir besoin.
- L'`autoDeploy` Render sur `main` : fusionner sans l'avoir coupé déclenche
  un build voué à l'échec sur la production encore active.
- `make check` est appelé par `.githooks/` et cité dans `plans/methode/` :
  réécrire les cibles sans mettre à jour hooks et docs casse chaque commit.
- Les variables d'URL de la sonde : oubliées, `deploy-check` échoue à chaque
  push contre un Render endormi, et ce bruit masque de vrais problèmes.
- Un trou dans la grille transforme la phase en chantier : il se comble dans
  la phase d'origine, pas ici.
