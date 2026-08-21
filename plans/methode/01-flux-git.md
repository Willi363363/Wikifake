# Le flux git

Deux branches permanentes, jamais touchées directement :

- **`main`** — ce qui est en production. Toujours déployable.
- **`staging`** — la branche d'intégration. Tout y passe avant `main`.

Les deux sont protégées par un ruleset GitHub : pull request obligatoire, CI
verte exigée, ni push direct, ni force-push, ni suppression. Le hook
`pre-push` refuse aussi localement, mais c'est le ruleset qui décide.

## Le trajet d'un changement

```
  feat/<sujet>  ──PR──►  staging  ──PR──►  main
       ▲                    │
       └── mise à jour ─────┘
           avant la fusion
```

1. Créer la branche depuis `staging` à jour.
2. Faire l'étape, commiter, pousser.
3. **Mettre la branche à jour depuis `staging`** — c'est l'étape qu'on saute et
   qu'on regrette.
4. Ouvrir la PR vers `staging`. CI verte, puis fusion.
5. Quand `staging` est stable, une PR `staging` → `main` promeut le lot.

### Pourquoi mettre à jour avant, et pas pendant

Un conflit se résout correctement sur une branche de travail : on a le contexte,
on peut lancer les tests, on peut recommencer. Le même conflit résolu dans
l'interface de GitHub se résout à l'aveugle, sans exécuter une ligne, et c'est
ainsi qu'on fusionne du code qui ne compile pas. **La règle : `staging` ne voit
jamais un conflit.** Quand la PR s'ouvre, la fusion est triviale.

```bash
git switch -c feat/<sujet> origin/staging   # partir d'une base à jour

# … travail, commits …

git fetch origin
git rebase origin/staging                   # rejouer par-dessus staging
# conflits → on résout ici, on relance les tests
make check && make test
git push --force-with-lease
gh pr create --base staging
```

`rebase` sur une branche d'étape : elle est courte, personne ne s'appuie
dessus, l'historique reste linéaire. `--force-with-lease` et jamais `--force`.

## Gros changement : branche parapluie et branches de phase

Quand un chantier dépasse une étape — une refonte, un changement de stack, une
reprise d'UI — il ne part pas en une seule branche géante. Une **branche
parapluie** porte le chantier, une **branche par phase** porte le travail :

```
  feat/refonte-phase-1 ──┐
  feat/refonte-phase-2 ──┼──►  feat/refonte  ──PR──►  staging  ──►  main
  feat/refonte-phase-3 ──┘
```

- La parapluie (`feat/refonte`) part de `staging` et ne reçoit que des fusions.
- Chaque phase (`feat/refonte-phase-1`) part de la parapluie, y retourne par
  une PR, et porte le numéro de la phase documentée dans `plans/refonte/`.
- Une phase se met à jour depuis la parapluie avant sa PR, même règle.
- La parapluie se met à jour depuis `staging` régulièrement — surtout si
  d'autres travaux avancent en parallèle.
- Quand assez de phases sont fusionnées pour former un tout cohérent, une seule
  PR `feat/refonte` → `staging`.

**La parapluie ne se rebase pas.** Des branches de phase s'appuient dessus :
réécrire son historique les casse toutes. On y fusionne `staging`
(`git merge origin/staging`), on ne la rejoue pas.

## Méthode de fusion

| Fusion | Méthode | Raison |
|---|---|---|
| étape → parapluie ou `staging` | **squash** | une étape = un commit dans l'historique |
| parapluie → `staging` | **merge commit** | garder un commit par étape, pas un bloc opaque |
| `staging` → `main` | **merge commit** | `staging` reste un ancêtre de `main` |

Après une promotion vers `main`, `staging` se réaligne sans effort, puisque
`main` en descend :

```bash
git switch staging && git merge --ff-only origin/main && git push
```

## Nomenclature

`<type>/<sujet>`, en minuscules, avec un tiret comme séparateur de mots :

```
feat/refonte              feat/refonte-phase-1
fix/reset-manche          docs/plans
refactor/scoring          ci/garde-staging
```

Types : `feat` `fix` `refactor` `perf` `docs` `test` `ci` `build` `chore`
`hotfix`. Le contrôle en CI exige deux segments en minuscules ; la liste
ci-dessus est la convention, tenez-la.

## Urgence

Un correctif de production part de `main`, va sur `staging`, puis est promu.
Il ne saute pas `staging` : une correction faite dans l'urgence est
précisément celle qui a besoin d'un passage par la CI.

```bash
git switch -c hotfix/<sujet> origin/main
# … correctif + test de non-régression …
gh pr create --base staging
```

## Ce qu'on ne fait jamais

- Pousser sur `main` ou `staging`. Aucune exception, humain ou agent.
- Réécrire l'historique d'une branche partagée ou d'une parapluie.
- Fusionner avec une CI rouge, ou en désactivant un contrôle.
- Résoudre un conflit dans l'interface GitHub.
- Laisser une branche vivre plus de quelques jours : elle diverge, et la
  fusion devient un projet en soi.
