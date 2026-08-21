# Le cycle de développement

On avance par **phases**, chaque phase découpée en **étapes**. Rien ne se fait
en dehors de ce découpage : c'est ce qui permet à quelqu'un — humain ou agent —
d'ouvrir le dépôt, de lire trois fichiers, et de savoir exactement quoi faire.

## Pourquoi ce découpage

Un projet qui avance par « tâches » se disperse : chacun ouvre le chantier qui
l'intéresse, les branches vivent trois semaines, et personne ne sait plus ce
qui est fini. Une phase répond à « où en est-on », une étape à « que fais-je
maintenant ». Les deux sont écrites avant d'être faites.

Pour un agent, ce découpage remplace le contexte qu'il n'a pas : la fiche de
phase dit ce qui précède, ce qui suit, et à quoi on reconnaît que c'est fini.

## Anatomie d'une phase

Une phase est un fichier de `plans/refonte/`, nommé `phase-NN-<sujet>.md`, qui
contient toujours les mêmes sections :

| Section | Contenu |
|---|---|
| En-tête | état (à faire / en cours / terminée), branche, phase dont elle dépend |
| Objectif | ce que la phase livre, en trois lignes |
| Pourquoi maintenant | la contrainte qui impose sa place dans l'ordre |
| Étapes | la liste numérotée, chacune avec son critère de fin |
| Porte de sortie | ce qui doit être vrai pour clore la phase |
| Invariants concernés | renvoi vers `01-contrat-a-preserver.md` |
| Pièges | ce qui va mal se passer, écrit à l'avance |

Une phase a **une** branche parapluie. Elle ne se clôt jamais à moitié : soit
sa porte de sortie est franchie, soit la phase est encore en cours.

## Anatomie d'une étape

Une étape est numérotée `NN.M` et tient en un paragraphe. Elle dit :

- **ce qu'on fait** — au niveau du fichier, pas de la ligne ;
- **fini quand** — un critère vérifiable, pas une impression. « Les tests de
  parité d'index passent » est un critère ; « le scraper marche » n'en est pas.

Une étape se tient dans une branche et une pull request. Si elle demande plus
de deux ou trois commits, c'est qu'elle en cachait deux : on la redécoupe dans
la fiche de phase **avant** de continuer.

## Le cycle, à chaque fois

1. Lire `plans/README.md` pour savoir quelle phase est en cours.
2. Ouvrir la fiche de phase, choisir la première étape non faite.
3. Créer la branche (voir `01-flux-git.md`).
4. Faire l'étape, et rien d'autre.
5. `make check`, puis les tests concernés.
6. Commiter par unité logique, message conventionnel.
7. Mettre la branche à jour depuis sa cible, ouvrir la pull request.
8. Après fusion : cocher l'étape dans la fiche de phase, **dans la même PR
   que le travail** si possible, sinon immédiatement après.

## Ce qui est « fini »

Une étape est finie quand, cumulativement :

- son critère de fin est vérifié ;
- les tests qui la concernent existent et passent ;
- `make check` est vert ;
- la documentation touchée est à jour — pas « à mettre à jour plus tard » ;
- rien n'a été ajouté hors périmètre.

Un travail qui ne remplit pas ces cinq points n'est pas fini, même s'il
fonctionne.

## Quand une étape déborde

Trois cas, trois réponses :

- **On découvre un bug non lié.** On le note dans
  `plans/etat-des-lieux/03-dette-connue.md` et on continue. On ne le corrige
  pas ici.
- **L'étape était mal découpée.** On s'arrête, on réécrit les étapes dans la
  fiche de phase, on reprend. Réécrire le plan fait partie du travail.
- **Une décision manque.** On s'arrête et on demande. Deviner une décision
  structurante coûte plus cher que d'attendre une réponse.

## Suivi de l'avancement

`plans/README.md` porte le tableau des phases et leur état. C'est le seul
endroit qui dit où l'on en est : il se met à jour à chaque phase franchie.
Les cases d'étapes se cochent dans la fiche de phase.

Aucun autre fichier de suivi. Pas de `TODO.md`, pas de `NOTES.md` — ils
divergent en une semaine et mentent en deux.
