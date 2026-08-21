# Les règles du dépôt

Le flux git est décrit dans `01-flux-git.md`, le découpage du travail dans
`00-cycle-de-dev.md`. Ce fichier couvre le reste : ce qu'on écrit, ce qu'on
n'écrit pas, et ce qui est vérifié automatiquement.

Ces règles s'appliquent identiquement aux humains et aux agents. Un agent
produit plus de code, plus vite, avec moins de contexte : il a plus besoin de
garde-fous, pas moins.

## Commits

Conventional commits, sujet en français, à l'impératif :

```
type(portée): description courte

Le corps explique le problème et pourquoi ce correctif. Pas ce que fait le
diff — le diff le dit déjà.
```

- Types : `build` `chore` `ci` `docs` `feat` `fix` `perf` `refactor` `revert`
  `style` `test`.
- Sujet ≤ 72 caractères, sans point final.
- Un commit qui fait deux choses se découpe en deux commits.
- Un commit produit par un agent porte un trailer `Co-Authored-By:`. On doit
  pouvoir savoir d'où vient une ligne.

## Pull requests

Une PR est fusionnable quand :

1. la CI est verte — tous les jobs, pas seulement celui qu'on regardait ;
2. la branche est à jour par rapport à sa cible ;
3. la description dit **pourquoi** : problème, cause, correctif, ce qui est
   couvert par un test ;
4. elle fait une seule chose. Un correctif plus un renommage plus une
   dépendance, c'est trois PR.

## Ce qu'un agent ne fait jamais

- **Pousser sur `main` ou `staging`.** Un agent qui n'arrive pas à pousser
  s'arrête et le dit ; il ne cherche pas de contournement.
- **`--no-verify`, ou `--force` sur une branche partagée.**
- **Désactiver un test, un lint ou une assertion pour verdir la CI.** Un test
  rouge est une information, pas un obstacle. S'il est légitimement obsolète,
  le dire en PR et le justifier.
- **`git stash` nu** : le stash est partagé entre les worktrees et une autre
  session peut le dépiler. Préférer un commit de travail temporaire.
- **Créer un fichier hors des emplacements prévus**, un document hors de
  `plans/`, ou une dépendance, sans que ce soit le sujet de la PR.
- **Élargir le périmètre.** Un vrai problème découvert en chemin se note dans
  `plans/etat-des-lieux/03-dette-connue.md` ; il ne se corrige pas ici.
- **Rapporter de façon optimiste.** Test échoué, étape sautée, contrôle non
  lancé : ça se dit. Un rapport flatteur coûte plus cher qu'un échec annoncé.

## Structure du dépôt

- Pas de nouveau répertoire à la racine sans que ce soit l'objet de la PR.
- Un fichier source de plus de 500 lignes se découpe. Viser 300.
- **Une seule source de vérité par règle métier.** Le barème, le catalogue
  d'items, les contrats de messages vivent à un endroit et sont importés.
  Toute duplication front/back est un bug en sursis.
- Pas de code mort. Un composant, un prompt ou une fonction que rien n'appelle
  se supprime — git s'en souvient.
- Pas de `window.*` ni de global pour faire communiquer deux modules.

## Documentation

- **Toute la documentation vit dans `plans/`.** À la racine, seuls `README.md`
  et `CLAUDE.md`, plus les fichiers standard (`CHANGELOG`, `SECURITY`,
  `CONTRIBUTING`, `HANDOVER`).
- **Aucun fichier de documentation au-delà de 200 lignes.** Au-delà, on
  découpe. Une doc qu'on ne relit pas est une doc fausse.
- La doc se met à jour **dans la PR qui change le comportement**, pas après.
- Pas de fichier de suivi parallèle : `plans/README.md` porte l'avancement,
  les fiches de phase portent les étapes. Rien d'autre.
- L'état des lieux est verrouillé par un test : routes et messages documentés
  doivent correspondre au code. Ajouter une route sans toucher la doc casse
  la CI, volontairement.

## Tests

- Toute correction de bug arrive avec le test qui échouait avant.
- Toute règle métier — score, autorisation, validation — est testée sans
  réseau, sans base et sans modèle.
- Les **assertions négatives** sont sacrées : elles vérifient que la solution
  du jeu ne fuit pas vers le client. On n'en supprime aucune sans un
  remplacement équivalent.
- Un test lent n'est pas une raison de le supprimer, mais de le déplacer.

## Secrets et dépendances

- Aucun secret dans git. Jamais. Un `.env` n'est pas versionné ; seul
  `.env.example` l'est, avec des valeurs factices.
- Une clé qui a touché un commit est compromise : on la révoque, on ne la
  retire pas discrètement.
- Le fichier de verrouillage des dépendances est versionné, les versions
  épinglées.
- Une nouvelle dépendance se justifie en PR : ce qu'elle apporte, son poids,
  qui la maintient. Trois lignes de code valent mieux qu'un paquet.

## Journalisation

Pas de `print()` ni de `console.log` dans le code applicatif : un logger, avec
un niveau. `console.warn` et `console.error` sont admis côté client.

## Comment ces règles s'appliquent

Les hooks locaux donnent le retour en une seconde, mais se contournent
(`--no-verify`) : ce sont des garde-fous, pas des serrures. La serrure est la
CI ; la vraie serrure est le ruleset GitHub.

| Règle | Hook local | CI | GitHub |
|---|---|---|---|
| Pas de commit ni push sur `main` / `staging` | `pre-commit`, `pre-push` | job `push-direct` | ruleset |
| Nom de branche | avertissement | bloquant | — |
| Format du commit | `commit-msg` | bloquant | — |
| Secret en dur, `.env` versionné | `pre-commit` | bloquant | — |
| Hygiène, taille de fichier | `pre-commit` | bloquant | — |
| `print` / `console.log` | `pre-commit` | bloquant | — |
| Documentation : 200 lignes, dans `plans/` | `pre-commit` | bloquant | — |
| Linters | si installés | bloquant | — |
| PR obligatoire, CI verte | — | — | ruleset |

Les deux côtés exécutent le **même** fichier, `scripts/checks.sh` : il n'y a
pas une version locale et une version CI qui divergent.

```bash
git config core.hooksPath .githooks       # une fois par clone, ou make hooks
bash scripts/checks.sh staged             # ce que verra le hook
bash scripts/checks.sh diff origin/staging   # ce que verra la CI
```
