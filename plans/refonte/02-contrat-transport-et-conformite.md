# Le contrat à préserver — 2/2

> Cache et comptabilité, robustesse du transport, conformité CC BY-SA et
> indexation, identité du déploiement, verrou documentaire. Le début du
> contrat — pourquoi il existe, l'index complet, l'autorité serveur (C1), le
> barème (C2), la génération d'article (C3) et les défauts connus (D) — est
> dans `01-contrat-a-preserver.md`.

Mêmes règles que la première moitié : chaque garantie a coûté un bug en
production, et chacune doit avoir un test équivalent dans la nouvelle stack
avant la suppression du Python — la condition d'entrée de la phase 10. Les
identifiants sont stables : les fiches de phase citent `C5.3` ou `C7.2`, pas
« la validation JSON » ou « le health check ».

## C4 — Cache et comptabilité

- **C4.1** — Clés normalisées : « Paris », « paris », «  PARIS  », « PÁRIS »
  sont une seule entrée. Catégorie vide ignorée.
- **C4.2** — Entrées **copiées à l'entrée et à la sortie** : muter le résultat
  d'un `get` n'affecte rien d'autre.
- **C4.3** — TTL 6 h, 3 variantes par catégorie, 200 catégories en LRU.
- **C4.4** — Plusieurs variantes servies en rotation : une même recherche ne
  sert pas éternellement le même article.
- **C4.5** — Une génération échouée n'est ni mise en cache ni comptée.
- **C4.6** — `cache_hit_rate` et `per_generated_game` (coût par partie
  réellement générée, non dilué par le cache) restent exposés.

Dans la cible, le cache passe en Redis avec les mêmes règles — il devient
partagé entre instances et survit aux redéploiements — et les compteurs
volatils d'`usage.py` sont remplacés par la table `llm_call`, qui rend le coût
par partie interrogeable au lieu de repartir de zéro à chaque redémarrage.

## C5 — Robustesse du transport

- **C5.1** — Pseudo validé : non vide, ≤ 24 caractères, `^[\w\-. ]+$`, trimé.
  Rejets typés (`invalid_name`), et le message d'erreur part **avant** la
  fermeture.
- **C5.2** — Homonyme connecté refusé (`name_taken`) sans toucher au joueur en
  place.
- **C5.3** — JSON invalide → `bad_json` et **la connexion survit**. Type
  inconnu → ignoré.
- **C5.4** — Chat borné à 400 caractères, chat vide abandonné.
- **C5.5** — Curseurs bornés à `[0,1]` et rate-limités côté serveur.
- **C5.6** — Codes de salle uniques sur 6 caractères, création plafonnée
  (503 au-delà).
- **C5.7** — Trames au-delà de 64 000 caractères → fermeture 1009.

Dans la cible, le throttle serveur s'étend à `live_score` (défaut D6) en plus
de `cursor` ; les garanties ci-dessus restent le plancher, pas le plafond.

## C6 — Conformité CC BY-SA et indexation

- **C6.1** — **L'attribution CC BY-SA est une exigence légale testée** :
  « texte volontairement modifié » + licence + lien doivent rester visibles
  **pendant et après** la manche.
- **C6.2** — `robots.txt` : `Disallow /api /ws`, exclusion de GPTBot,
  ClaudeBot, Google-Extended, CCBot — le corpus est faux par construction, il
  ne doit pas entraîner de modèles. Sitemap déclaré.
- **C6.3** — `<html lang="fr">`, meta title/description bornées, Open Graph,
  canonical.

## C7 — Identité du déploiement

- **C7.1** — `GET /ping` répond **exactement** `{"status": "alive"}`.
- **C7.2** — `GET /api/health` expose `status`, `version`, `commit` (chaîne
  **présente même vide** en local), `commit_short` (7 caractères), `model`,
  `llm_configured` (booléen). **La clé API n'apparaît jamais.** La sonde CI
  compare `commit` au SHA poussé — ce contrat doit survivre à la migration ou
  la boucle de vérification de déploiement meurt en silence.
- **C7.3** — `GET /` répond toujours du HTML 200 avec un `<title>` non vide.

## C8 — Le verrou documentation ↔ code

- **C8.1** — La garantie actuelle : `test_architecture_doc.py` vérifie
  mécaniquement que `plans/etat-des-lieux/` ne dérive pas — les modules cités
  existent, les cibles `make` existent, la liste des messages WS entrants
  documentés **égale** la table de dispatch, chaque sortant documenté est
  réellement émis, les routes documentées **égalent** les décorateurs de
  route.
- **C8.2** — Ce mécanisme est du Python à base de regex : **il doit être
  réimplémenté**, sinon la garantie disparaît sans bruit. Dans la cible, il
  devient trivial et bien plus solide, puisque le protocole est un objet Zod :
  la documentation se génère depuis les schémas, et le test compare le fichier
  généré au fichier commité.

## Comment ces garanties se testent dans la cible

| Sections | Moyen de preuve |
|---|---|
| C4 | Tests d'intégration du cache Redis et de la facturation (règles de normalisation, TTL, LRU, rotation, échec non compté) |
| C5 | Client WebSocket de test contre `apps/realtime` : refus d'homonyme, survie au JSON invalide, throttles, bornes |
| C6 | E2E Playwright en assertions négatives et positives : attribution visible pendant et après la manche ; tests sur `robots.txt` et les métadonnées |
| C7 | Contrat conservé au champ près, sonde de déploiement CI portée telle quelle |
| C8 | Doc générée depuis les schémas Zod, test générée-vs-commitée |

Les assertions négatives (aucun texte de vérité dans le DOM pendant la manche)
sont l'héritage le plus important du projet actuel : elles attrapent une fuite
de solution qu'aucun test positif ne verrait.
