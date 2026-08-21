# Phase 2 — Données

| | |
|---|---|
| **État** | à faire |
| **Branche** | `feat/refonte-phase-2` |
| **Dépend de** | phase 1 |
| **Livre** | `packages/db` : schéma Drizzle migré, client typé, seed |

## Objectif

Poser la persistance : le schéma Drizzle sur Postgres Neon — les quatorze
tables décrites étape par étape ci-dessous —, les migrations, le client typé et un seed de
développement. Aucune logique métier : les règles restent dans `domain`.

## Pourquoi maintenant

Tout ce qui écrit arrive juste après : compteurs d'article (phase 3), API
(phase 4), comptes (phase 5). Le schéma s'appuie sur les types de la phase 1
pour ne pas redéclarer les formes. Et c'est la table `llm_call` qui remplace
les compteurs volatils de `usage.py` : aujourd'hui `/api/usage` repart de
zéro à chaque redémarrage, ce qui interdit toute mesure de coût réelle. En
base, le coût par partie devient une requête.

## Étapes

### 2.1 — Outillage Drizzle et client

`drizzle-kit`, configuration, client Neon exporté une seule fois.
`DATABASE_URL` passe par l'environnement typé de la phase 0.

**Fini quand** : `drizzle-kit migrate` s'exécute sur une base neuve, et
démarrer sans `DATABASE_URL` échoue en nommant la variable.

### 2.2 — Tables d'authentification et de profil

`user`, `session`, `account`, `verification` au format attendu par Better
Auth (branché en phase 5), plus `profile` : pseudo affiché, accent préféré,
préférences.

**Fini quand** : la migration passe, et un test d'intégration insère puis
relit un `user` et son `profile` de façon typée.

### 2.3 — Tables de partie

`room` (code, hôte, réglages, état, horodatages), `game` (mode solo/multi,
sujet, URL source, instantané de l'article, nombre de faux), `game_position`
— **la solution** : index, texte faux, texte original, explication, indice —,
`participant` (compte **ou** invité, couleur, score, tp, fp, indices,
pénalité, volé, bonus temps), `answer` (paragraphes marqués).

**Fini quand** : un test d'intégration insère une partie complète
(salle → partie → positions → participants → réponses) et la relit typée, et
les requêtes de lecture « partie en cours » exportées ne joignent jamais
`game_position`.

### 2.4 — Tables d'audit

`hint_purchase` (achat horodaté, niveau, coût — la facturation devient
auditable), `item_use` (qui a saboté qui, avec quoi, quand), `flag_report`
(signalement + verdict du modèle — remplace `complaints.jsonl`).

**Fini quand** : chaque table s'insère et se relit en test d'intégration, et
la séquence d'achats d'indices d'un participant se reconstitue triée par
horodatage.

### 2.5 — `llm_call` et requêtes de coût

Modèle, type d'appel, tokens entrée/sortie, échec. Les requêtes qui
remplacent `usage.py` : coût par partie réellement générée
(`per_generated_game`, non dilué par le cache) et `cache_hit_rate`. Une
génération échouée est enregistrée comme échec, jamais comptée comme partie
générée (§3.4).

**Fini quand** : sur un jeu de données de test, la requête de coût par partie
renvoie l'agrégat attendu, et un appel en échec n'entre pas dans
`per_generated_game`.

### 2.6 — Seed de développement

Un script de seed : quelques comptes, une salle, une partie terminée avec
positions, réponses, achats d'indices et appels LLM — de quoi développer les
phases suivantes sans cliquer.

**Fini quand** : le seed remplit une base neuve sans erreur, se rejoue sans
erreur (idempotent), et les requêtes de 2.3 à 2.5 renvoient des résultats non
vides dessus.

## Porte de sortie

- `drizzle-kit migrate` passe sur une base neuve, en CI, pas seulement sur
  une base locale déjà migrée.
- Toutes les requêtes exportées sont typées ; aucun SQL libre hors du paquet.
- Le coût d'une partie est une requête qui répond juste sur le seed.
- `pnpm build && pnpm test && pnpm lint && pnpm typecheck` passent.

## Invariants concernés

Voir `01-contrat-a-preserver.md` : l'**autorité serveur** — `game_position`
porte la solution et n'apparaît dans aucune lecture avant la fin de partie
(§3.1) ; la **comptabilité** (§3.4) — `cache_hit_rate` et
`per_generated_game` restent exposés, une génération échouée n'est pas
comptée ; la **facturation des indices** devient auditable a posteriori
(`hint_purchase`), ce qui verrouille la monotonie autrement que par le seul
état en mémoire.

## Pièges

- **Pas de logique métier en base.** `participant` stocke le breakdown
  calculé par `domain`, il ne le recalcule pas ; pas de trigger, pas de
  procédure stockée.
- Une migration fusionnée ne s'édite plus : on en ajoute une. Régénérer la
  migration initiale « parce que rien n'est déployé » casse les bases des
  autres postes.
- La jointure pratique qui embarque `game_position` dans un état de partie
  « pour plus tard » est exactement la fuite que §3.1 interdit : assertion
  négative sur la sérialisation des lectures en cours.
- L'instantané d'article dans `game` est un instantané : ne pas le
  re-normaliser, la normalisation appartient à la phase 3.
- Neon en CI : prendre une base neuve (branche Neon ou Postgres local) à
  chaque exécution, sinon les migrations ne sont jamais vraiment testées.
