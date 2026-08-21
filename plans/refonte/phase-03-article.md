# Phase 3 — Article

| | |
|---|---|
| **État** | à faire |
| **Branche** | `feat/refonte-phase-3` |
| **Dépend de** | phase 2 |
| **Livre** | `packages/article` : scraping, falsification LLM, cache Redis |

## Objectif

Construire le paquet qui produit les articles falsifiés : recherche et
récupération via l'API MediaWiki en direct, collecte des paragraphes avec
cheerio, falsification par `generateObject` de l'AI SDK validée par Zod,
cache Redis, compteurs d'appels LLM en base. Générateur sans état, couvert
par des fixtures de vraies pages Wikipédia gelées.

## Pourquoi maintenant

C'est **la** phase à risque, et elle se fait avant l'API et l'UI. L'invariant
de parité d'index texte ↔ nœuds DOM est celui qui a coûté le pire bug de
l'histoire du projet : les positions étaient tirées au hasard, et le joueur
était noté sur les mauvais paragraphes. Si cette garantie casse pendant le
portage vers cheerio, mieux vaut le découvrir sur des fixtures gelées que
derrière trois couches d'API et d'interface. La phase 2 fournit la base dont
la table `llm_call` a besoin.

## Étapes

### 3.1 — Fixtures de vraies pages Wikipédia gelées

Geler dans le paquet le HTML de vraies pages Wikipédia, comme aujourd'hui :
au moins un cas avec paragraphes dupliqués (variantes mobile/desktop), un cas
avec balises inline (`un<b>deux</b>trois`), un cas avec paragraphes courts.
Elles servent toutes les étapes suivantes.

**Fini quand** : les fixtures sont commitées et chargées par un premier test.

### 3.2 — Client MediaWiki, langue et user-agent explicites

Recherche, résolution de page sans auto-suggestion, HTML rendu. La langue et
le user-agent sont des paramètres **explicites à chaque appel** : aujourd'hui
la bibliothèque Python porte un état global, et le vérificateur de
signalements interroge silencieusement Wikipédia dans une autre langue selon
l'ordre des appels. Wikipédia introuvable → échec propre, pas d'exception.

**Fini quand** : un test montre deux appels successifs dans deux langues
différentes sans fuite de l'un vers l'autre, et la page introuvable produit
une valeur d'échec typée, pas une exception.

### 3.3 — Collecte des paragraphes avec cheerio

Parité d'index stricte : `paragraphs[i]` correspond au i-ème nœud `<p>`
collecté, et la collecte, l'extraction du texte et l'injection partagent les
mêmes références de nœuds. Déduplication des variantes, ordre du document
préservé, paragraphes de moins de 50 caractères écartés. Espaces insérés
entre balises inline (« un deux trois ») mais ponctuation non décollée
(« 1889. », pas « 1889 . »).

**Fini quand** : sur chaque fixture, les tests de parité d'index, de
déduplication et de normalisation des espaces passent.

### 3.4 — Falsification par `generateObject`

`generateObject` de l'AI SDK avec schéma Zod. Cela supprime d'un coup les
~130 lignes d'heuristiques de parsing qui sont aujourd'hui de la logique
métier : retrait des clôtures Markdown, repli du premier `[` au dernier `]`,
déballage d'objet enveloppe, politique tout-ou-rien sur les index, repli
positionnel, relance partielle. Le prompt réellement utilisé est repris tel
quel ; le prompt mort de `core/prompts.py` n'est pas porté. La troncature à
1 000 caractères des originaux envoyés au modèle est **corrigée** : elle
raccourcit aujourd'hui silencieusement les longs paragraphes servis.

**Fini quand** : une sortie de modèle mal formée est rejetée par le schéma
(modèle simulé en test), et un test vérifie qu'un paragraphe de plus de
1 000 caractères part entier au modèle et revient entier dans l'article.

### 3.5 — Injection et parité de bout en bout

`positions` désigne exactement les paragraphes que le LLM a modifiés.
`false_info_number` séquentiels de 1 à n, `positions` triées par index
croissant, index base 1 dans le contrat client. Le générateur est sans
état : deux parties concurrentes ne se mutent pas.

**Fini quand** : sur fixtures, un test de bout en bout (modèle simulé)
vérifie que chaque position désigne un paragraphe différent de l'original,
et eux seuls ; deux générations concurrentes n'échangent aucun état.

### 3.6 — Cache Redis

Mêmes règles qu'aujourd'hui : clés normalisées (« Paris », « paris »,
«  PARIS  », « PÁRIS » sont une seule entrée, catégorie vide ignorée),
entrées copiées à l'entrée et à la sortie, TTL 6 h, 3 variantes par
catégorie, 200 catégories en LRU, variantes servies en rotation. Une
génération échouée n'est ni mise en cache ni comptée. Le cache devient
partagé entre instances et survit aux redéploiements.

**Fini quand** : les règles de cache de §3.4 du contrat passent en tests
d'intégration contre un Redis local, mutation du résultat d'un `get`
comprise.

### 3.7 — Compteurs en base

Chaque appel LLM écrit une ligne `llm_call` (modèle, type d'appel, tokens
entrée/sortie, échec). `cache_hit_rate` et `per_generated_game` — coût par
partie réellement générée, non dilué par le cache — deviennent des requêtes.

**Fini quand** : après une génération réussie et une échouée en test
d'intégration, `llm_call` porte les deux lignes, et `per_generated_game`
ne compte que la réussie.

## Porte de sortie

- Parité d'index et non-duplication vérifiées sur fixtures HTML réelles.
- Règles de cache de §3.4 vérifiées contre Redis.
- Générateur sans état ; échec Wikipédia propre, ni mis en cache ni compté.
- Aucun code d'API ni d'UI : le paquet ne s'utilise que depuis ses tests.

## Invariants concernés

Voir `01-contrat-a-preserver.md` : **génération d'article** (§3.3 — parité
d'index, `positions` exactes, déduplication, normalisation des espaces,
générateur sans état, échec propre) et **cache et comptabilité** (§3.4 —
normalisation des clés, copies, TTL, rotation, `cache_hit_rate`,
`per_generated_game`).

## Pièges

- **Le test de parité d'abord.** C'est le morceau à écrire en premier ; tout
  le reste de la chaîne repose dessus.
- Cheerio permet de partager les références de nœuds, mais seulement si
  collecte, extraction et injection travaillent sur le même arbre : un
  re-parse intermédiaire recrée le bug historique en silence.
- **Ne pas toucher au prompt.** `generateObject` peut déjà changer le
  comportement du modèle ; comparer sur un jeu de catégories fixe avant toute
  retouche. Ne pas mélanger changement de stack et changement de
  comportement.
- Ne pas porter `core/prompts.py` : c'est du code mort, le vrai prompt est
  inline dans `misinformation.py`.
- Le seuil de falsifiabilité existe deux fois aujourd'hui (settings et en dur
  dans `misinformation.py`) : une seule constante dans la cible.
