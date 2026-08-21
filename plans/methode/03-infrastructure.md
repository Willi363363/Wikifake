# L'infrastructure qui tient les règles

Les deux fichiers précédents disent comment on travaille. Celui-ci dit ce qui
l'empêche mécaniquement de déraper, et ce qui reste à la charge de l'humain.

## Trois environnements, deux déployés

| Branche | Environnement | Service Render | Sonde |
|---|---|---|---|
| `staging` | préproduction | `wikifake-staging` | variable `STAGING_DEPLOY_URL` |
| `main` | production | `wikifake` | variable `DEPLOY_URL` |

Un push sur l'une ou l'autre déclenche `deploy-check.yml`, qui interroge
`/api/health` jusqu'à ce que le commit servi soit celui qui vient d'être
poussé. Sans variable configurée, le job s'ignore proprement et explique
comment le régler — un fork ne voit jamais sa CI échouer pour ça.

**Pourquoi une préproduction :** sans environnement derrière, `staging` n'est
qu'un rituel. Promouvoir vers `main` reste alors le même saut dans le vide
qu'un push direct. Avec un déploiement et une sonde, la promotion devient une
décision informée : on a vu le code tourner.

`render.yaml` décrit les deux services, mais **ne prend effet que si le service
est rattaché à un Blueprint Render**. Tant que la configuration est faite à la
main dans le tableau de bord, ce fichier documente ce qui doit être vrai sans
l'appliquer.

## La porte humaine

Le problème, énoncé franchement : **avec un seul compte GitHub, aucun contrôle
serveur ne distingue un humain d'un agent.** Les deux portent le même jeton.
Exiger une approbation ne sert à rien — personne ne peut approuver sa propre
pull request, et un agent qui contourne ne serait pas détecté.

La porte est donc posée à deux endroits :

1. **Là où les agents s'exécutent.** `.claude/settings.json` leur refuse
   `gh pr merge`, `gh pr review`, `gh pr edit`, la modification de ruleset et
   le push vers `main` ou `staging`. Ce n'est pas une convention : l'appel
   n'aboutit pas.
2. **Dans la CI.** Le job `Revue humaine` échoue tant que la PR ne porte pas le
   label `revu`, apposé à la main après lecture. Un agent ne peut pas se le
   donner, puisque `gh pr edit` lui est refusé. Le geste est horodaté dans le
   journal du dépôt.

**Ce que ça ne couvre pas :** un humain qui contourne délibérément, ou un agent
lancé hors de ce harnais. La vraie réponse d'entreprise est une identité
distincte pour les agents — compte machine ou GitHub App — et une approbation
obligatoire. Le jour où le dépôt compte plus d'une personne, c'est le premier
réglage à changer : approbation requise à 1, et la porte par label devient
superflue.

## L'analyse automatique

| Contrôle | Outil | Portée |
|---|---|---|
| Secrets, hygiène, journalisation, docs | `scripts/checks.sh` | fichiers modifiés |
| Secrets, formats connus | gitleaks | historique de la PR |
| Dépendances vulnérables ou en retard | Dependabot | npm, pip, actions |

`scripts/checks.sh` est immédiat et tourne aussi en local ; gitleaks connaît les
formats de jetons et lit l'historique, pas seulement le contenu final. Les deux
se complètent : le premier attrape ce qu'on vient d'écrire, le second ce qu'on
croyait avoir retiré.

Dependabot cible `staging`, jamais `main` : une mise à jour de dépendance suit
le même trajet que le reste.

## Les checks requis

Le ruleset GitHub couvre `main` et `staging` : pull request obligatoire, ni
push direct, ni force-push, ni suppression, et ces checks au vert :

`frontend`, `backend`, `Conformité de la PR`, `Revue humaine`,
`Analyse de secrets`.

**Un check requis qui ne remonte jamais bloque la fusion pour toujours.** À
chaque fois qu'un nom de job change — et la refonte en changera —, la liste des
checks requis doit être mise à jour dans le même mouvement. C'est écrit dans la
fiche de la phase 9.

Modifier le ruleset est refusé aux agents. La commande est :

```bash
gh api --method PUT /repos/<owner>/<repo>/rulesets/<id> --input ruleset.json
```

## Ce qui manque encore, assumé

- Pas de seuil de couverture de tests : la nouvelle stack n'existe pas encore,
  il arrive avec la phase 0.
- Pas de `CODEOWNERS` : avec un seul propriétaire, il serait décoratif.
- Pas d'analyse statique de sécurité (CodeQL) : à rouvrir quand le code
  TypeScript existera.
