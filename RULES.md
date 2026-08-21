# Règles du dépôt

Ces règles existent pour une raison unique : que le dépôt reste lisible par
quelqu'un qui n'était pas là quand le code a été écrit. Elles s'appliquent
identiquement aux humains et aux agents — un agent produit plus de code, plus
vite, avec moins de contexte, donc il a plus besoin de garde-fous, pas moins.

Trois documents seulement : `RULES.md` (comment on travaille),
`ARCHITECTURE.md` (comment le code est fait), `REFONTE.md` (où l'on va).

## 1. `main` est protégée

**Aucun push direct sur `main`, jamais, par personne ni par aucun agent.**
Tout passe par une branche et une pull request. Sans exception « juste ce
coup-ci » : c'est exactement le commit qu'on cherchera trois semaines plus tard.

`main` est toujours déployable. Une PR qui laisse `main` cassée n'est pas
fusionnable, même si elle est urgente.

## 2. Branches

- Une branche = un sujet. Nommage `<auteur>/<sujet>`, en minuscules :
  `willi363/refonte`, `willi363/protocol-zod`.
- Branche courte. Au-delà de quelques jours, elle diverge et la revue devient
  impossible : découpez.
- Les PR empilées sont autorisées (base = une autre branche), mais déclarez-le
  dans la description : la CI les traite différemment.
- Jamais de réécriture d'un historique déjà partagé. Sur votre propre branche
  non fusionnée, `rebase` et `push --force-with-lease` sont libres.

## 3. Pull requests

Une PR est fusionnable quand :

1. La CI est verte — tous les jobs, pas seulement celui qu'on regardait.
2. Une revue humaine l'a approuvée. Une revue faite par un agent ne compte pas
   comme la revue : elle s'ajoute.
3. La description dit **pourquoi**, pas seulement quoi. Problème, cause,
   correctif, ce qui est couvert par un test.
4. Elle fait une seule chose. Un correctif plus un renommage plus une
   dépendance, c'est trois PR.

Fusion par **squash** par défaut. Merge commit réservé aux PR empilées et aux
lots de la refonte, pour garder la traçabilité par lot.

## 4. Commits

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

## 5. Agents IA

Ce que produit un agent engage celui qui le lance. Les règles ci-dessus
s'appliquent, plus celles-ci :

- **Jamais de push sur `main`.** Un agent qui n'arrive pas à pousser doit
  s'arrêter et le dire, pas chercher un contournement.
- **Jamais `--no-verify`, jamais `--force` sur une branche partagée.**
- **Jamais désactiver un test, un lint ou une assertion pour faire passer la
  CI.** Un test rouge est une information, pas un obstacle. S'il est
  légitimement obsolète, le dire en PR et le justifier.
- **Jamais de `git stash` nu** : le stash est partagé entre les worktrees et
  une autre session peut le dépiler. Préférez un commit de travail temporaire.
- **Signer son travail** : trailer `Co-Authored-By:` sur les commits produits
  par un agent. On doit pouvoir savoir d'où vient une ligne.
- **Ne pas créer de fichier hors des emplacements prévus** (§6), ni de nouveau
  document (§7), ni de dépendance (§9) sans que ce soit le sujet de la PR.
- **Ne pas élargir le périmètre.** Si un vrai problème est découvert en
  chemin, le signaler ; ne pas le corriger dans la même PR.
- **Rapporter fidèlement.** Test échoué, étape sautée, contrôle non lancé :
  ça se dit. Un rapport optimiste coûte plus cher qu'un échec annoncé.

## 6. Structure du dépôt

- Pas de nouveau répertoire à la racine sans que ce soit l'objet de la PR.
- Un fichier source dépasse 500 lignes : il se découpe. Viser 300.
- Une seule source de vérité par règle métier. Le barème, le catalogue
  d'items, les contrats de messages vivent à **un** endroit et sont importés.
  Toute duplication front/back est un bug en sursis.
- Pas de code mort. Un composant, un prompt ou une fonction que rien n'appelle
  se supprime — git s'en souvient.
- Pas de `window.*` ni de global pour faire communiquer deux modules.

## 7. Documentation

- Trois documents à la racine, listés en tête de ce fichier. Un quatrième se
  discute en PR ; les fichiers standard (`README`, `CHANGELOG`, `SECURITY`,
  `CONTRIBUTING`, `HANDOVER`) sont admis.
- `RULES.md` ≤ 200 lignes, les autres ≤ 500. Une doc qu'on ne relit pas est
  une doc fausse.
- La doc se met à jour **dans la PR qui change le comportement**, pas après.
- `ARCHITECTURE.md` est verrouillé par un test : routes et messages documentés
  doivent correspondre au code. Si vous ajoutez une route, la CI vous le
  rappellera.

## 8. Tests

- Toute correction de bug arrive avec le test qui échouait avant.
- Toute règle métier (score, autorisation, validation) est testée sans réseau,
  sans base et sans LLM.
- Les **assertions négatives** sont sacrées : elles vérifient que la solution
  du jeu ne fuit pas vers le client. On n'en supprime aucune sans un
  remplacement équivalent.
- Un test lent n'est pas une raison de le supprimer, mais de le déplacer.

## 9. Secrets et dépendances

- Aucun secret dans git. Jamais. Un `.env` n'est pas versionné ; seul
  `.env.example` l'est, avec des valeurs factices.
- Une clé qui a touché un commit est compromise : on la révoque, on ne la
  retire pas discrètement.
- Le fichier de verrouillage des dépendances est versionné, les versions
  épinglées.
- Une nouvelle dépendance se justifie en PR : ce qu'elle apporte, son poids,
  qui la maintient. Trois lignes de code valent mieux qu'un paquet.

## 10. Journalisation

Pas de `print()` ni de `console.log` dans le code applicatif : un logger, avec
un niveau. `console.warn` et `console.error` sont admis côté client.

Dette connue à cette date : cinq `print()` subsistent dans `backend/src/core/`
(`settings.py`, `misinformation.py`, `flag_verifier.py`). Les contrôles ne
portent que sur les fichiers modifiés, donc ils ne bloquent personne, mais
toucher l'un de ces fichiers implique de les corriger.

## 11. Comment ces règles s'appliquent

Les hooks locaux donnent le retour en une seconde. Ils se contournent
(`--no-verify`) : ce sont des garde-fous, pas des serrures. La serrure est la
CI, et la vraie serrure est la protection de branche GitHub.

| Règle | Hook local | CI | GitHub |
|---|---|---|---|
| Pas de commit ni push sur `main` | `pre-commit`, `pre-push` | job `push-direct` | branch protection |
| Nom de branche | avertissement | bloquant | — |
| Format du commit | `commit-msg` | bloquant | — |
| Secret en dur, `.env` versionné | `pre-commit` | bloquant | — |
| Hygiène, taille de fichier | `pre-commit` | bloquant | — |
| `print` / `console.log` | `pre-commit` | bloquant | — |
| Limites de documentation | `pre-commit` | bloquant | — |
| Linters | si installés | bloquant | — |
| Revue, CI verte | — | — | branch protection |

Les deux côtés exécutent le **même** fichier, `scripts/checks.sh` : il n'y a
pas une version locale et une version CI qui divergent.

## 12. Mise en place

```bash
git config core.hooksPath .githooks   # une fois par clone
bash scripts/checks.sh staged         # ce que verra le hook
bash scripts/checks.sh diff origin/main   # ce que verra la CI
```

Reste à activer côté GitHub, sur `main` : PR obligatoire, une approbation,
CI verte exigée, pas de push direct, pas de force-push. Sans ça, §1 n'est
qu'une intention.
