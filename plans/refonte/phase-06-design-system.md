# Phase 6 — Design system

| | |
|---|---|
| **État** | à faire |
| **Branche** | `feat/refonte-phase-6` |
| **Dépend de** | la phase 1 |
| **Livre** | `packages/ui` : thème, primitives, animations, composant token |

## Objectif

Transcrire l'identité visuelle actuelle en design system : les tokens de
`tokens.css` (palette « papier chaud », cinq accents, ombres, rayons)
deviennent un thème Tailwind v4, les primitives viennent de shadcn/ui, les
~15 keyframes partagés deviennent des animations du thème, et la machine à
états visuelle du token de paragraphe devient un composant à variantes.
Transcrire, pas repenser.

## Pourquoi maintenant

Cette phase ne dépend d'aucune phase serveur — seulement des types de la
phase 1 — et peut donc avancer en parallèle des phases 2 à 5. Les phases
front qui suivent consomment ses briques : sans elles, chaque écran
réinventerait ses styles comme aujourd'hui (~430 objets `style={{}}`, une
seule media query dans tout le projet). C'est aussi ici que s'ajoutent les
non-négociables : `prefers-reduced-motion` — le jeu enchaîne secousses et
flashs stroboscopiques, l'enjeu de photosensibilité est réel —, le mode
sombre, le responsive et l'accessibilité.

## Étapes

### 6.1 — Thème Tailwind v4

Les tokens de `tokens.css` transcrits dans le thème : palette, cinq accents,
ombres, rayons. Déclinaison sombre des tokens — le mode sombre est un des
ajouts non négociables.

**Fini quand** : chaque token de `tokens.css` a son équivalent nommé dans le
thème, et une page de galerie rend la palette dans les deux modes.

### 6.2 — Primitives shadcn/ui

Les primitives shadcn/ui installées et habillées par le thème. Elles
apportent le socle d'accessibilité — rôles, focus, clavier — que les
`<span onClick>` de l'existant n'ont pas.

**Fini quand** : les primitives retenues sont rendues dans la galerie, dans
les deux modes, focusables et actionnables au clavier.

### 6.3 — Animations du thème et reduced-motion

Les ~15 keyframes partagés d'`animations.css`, aujourd'hui référencés par
chaîne depuis les styles inline, deviennent des animations du thème, typées.
`prefers-reduced-motion` neutralise secousses et flashs stroboscopiques :
c'est un enjeu de photosensibilité, pas un confort.

**Fini quand** : chaque keyframe porté est nommé dans le thème, et la
galerie rendue avec `prefers-reduced-motion` actif ne joue ni secousse ni
flash (vérifié en émulant la préférence dans le navigateur).

### 6.4 — Composant token de paragraphe

Le composant le plus chargé en règles CSS du projet. Ses sept états visuels
(`selected`, `edited`, `scanned`, `hinted`, `found`, `missed`,
`false-positive`) et leurs badges en pseudo-éléments deviennent un composant
à variantes (`cva`), pas une cascade de classes globales. Et il devient un
vrai élément interactif : le token **est** le geste central du jeu, et c'est
aujourd'hui un `<span onClick>` non focusable. Rôle, focus visible,
activation clavier.

**Fini quand** : les sept états sont rendus dans la galerie, chaque variante
a son test de rendu, et le token s'atteint au tab et s'active au clavier
avec un focus visible.

### 6.5 — Responsive

Les composants du paquet sont construits fluides, points de rupture définis
dans le thème. Il y a une seule media query dans tout le projet aujourd'hui.

**Fini quand** : la galerie s'affiche sans débordement horizontal ni
chevauchement à 360 px comme à 1280 px.

### 6.6 — Galerie et audit de contraste

La galerie de composants est le livrable de la phase : tout composant
exporté par le paquet y figure, dans les deux modes. Audit de contraste sur
ce rendu.

**Fini quand** : la galerie rend tous les composants exportés et l'audit de
contraste passe dans les deux modes.

## Porte de sortie

- La galerie de composants est rendue, tous composants exportés compris.
- Les contrastes sont audités dans les deux modes.
- `prefers-reduced-motion` neutralise secousses et flashs stroboscopiques.
- Le token de paragraphe se joue au clavier, ses sept états rendus et
  testés.
- Aucun objet `style={{}}` dans `packages/ui`.

## Invariants concernés

Pas de logique de jeu dans ce paquet, donc peu de garanties serveur. Voir
tout de même `01-contrat-a-preserver.md` : la **conformité** (attribution
CC BY-SA « texte volontairement modifié » + licence + lien, visible pendant
et après la manche ; `lang="fr"`) contraint les composants qui la porteront ;
et l'**autorité serveur** borne le composant token : ses états `found`,
`missed` et `false-positive` n'existent qu'avec la solution, donc après la
fin de manche — le composant ne doit rien exiger avant.

## Pièges

- **Pas de redesign.** L'identité visuelle actuelle est transcrite, pas
  repensée. Toute « amélioration » visuelle est hors périmètre.
- **Ne pas porter les composants morts** : `HintsPanel` et la variante
  sidebar de `Leaderboard` ne font pas le voyage.
- **Des briques, pas des écrans.** Les ~430 `style={{}}` du front actuel
  tombent aux phases front suivantes, pas ici.
- **`prefers-reduced-motion` vise les animations « signature ».** Ce sont
  précisément les secousses et les flashs, pas seulement les transitions
  douces, qu'il doit neutraliser.
- **Un état de token oublié se verra en pleine manche**, pas dans la
  galerie : les combinaisons d'états et les badges justifient le test de
  rendu par variante.
