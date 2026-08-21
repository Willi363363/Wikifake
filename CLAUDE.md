# WikiFake — instructions de travail

Jeu de détection de fausses informations : le serveur récupère un article
Wikipédia, un modèle y injecte des erreurs factuelles, les joueurs doivent les
retrouver, seuls ou à plusieurs.

## À lire avant d'écrire une ligne

1. `plans/README.md` — l'index, et **où en est le projet**.
2. `plans/methode/00-cycle-de-dev.md` — comment on travaille : phases, étapes.
3. `plans/methode/01-flux-git.md` — branches, staging, main.
4. `plans/methode/02-regles-du-depot.md` — ce qui est interdit.

Puis la fiche de la phase en cours dans `plans/refonte/`. On n'improvise pas :
tout travail correspond à une **étape** d'une phase existante. Si ce n'est pas
le cas, l'étape se documente d'abord.

## Non négociable

- **Jamais de push sur `main` ni `staging`.** Une branche, une pull request.
- **Une étape = une branche = une PR.** Pas de travail hors périmètre : un
  problème découvert en chemin se signale, il ne se corrige pas ici.
- **Mettre la branche à jour depuis `staging` avant de demander la fusion.**
  Les conflits se règlent sur la branche, jamais dans la PR.
- **Ne jamais désactiver un test, un lint ou une assertion** pour verdir la CI.
- **Aucune documentation hors de `plans/`**, aucun fichier au-delà de
  200 lignes.
- **Une seule source de vérité** par règle métier. Toute duplication
  front/back est un bug en sursis.
- **Rapporter fidèlement** : test échoué, étape sautée, contrôle non lancé,
  ça se dit.
- Signer les commits produits par un agent (trailer `Co-Authored-By:`).

## Où trouver quoi

| Question | Fichier |
|---|---|
| Comment on travaille | `plans/methode/` |
| Ce qui existe aujourd'hui | `plans/etat-des-lieux/` |
| Où l'on va, phase par phase | `plans/refonte/` |
| Ce qu'on ne doit jamais casser | `plans/refonte/01-contrat-a-preserver.md` |

## Commandes

```bash
make hooks     # installer les hooks git (une fois par clone)
make check     # ce que verra le hook de pre-commit
make test      # tests backend
make run       # build du front + serveur sur :8000
```

Avant de proposer une fusion : `bash scripts/checks.sh diff origin/staging`.
