# The brief this effort came from

The owner's original request, as it was written, on the day the product effort
was asked for. Everything in `product/` is an answer to something on this page:
the tracks, their order, the two rules in `00-overview.md`, and the refusals in
`11-deferred.md`.

**It is kept verbatim, and it is kept in French.** `CLAUDE.md` says everything
written in this repository is in English, and that rule is about *our prose* —
what we choose to say. This is not ours and it is not prose we wrote: it is the
record of what was asked, in the words it was asked in. Translating it would
make it a paraphrase, and a paraphrase cannot settle an argument about what was
meant. Same reason the article text stays French: it is data, not writing.

**Read it when a decision looks arbitrary.** Most of them are not. A few
examples, with where each landed:

| What was asked | Where it went |
|---|---|
| "une réelle expérience scrollable… la fenêtre comme une scène" | track C, `03-landing.md` |
| "je veux plus rien à faire… de manière autonome" | why track F generates quests from a rule catalogue, and why seasons are refused |
| "hébergement chez Supabase" | refused, with the reasoning, in `11-deferred.md` |
| "mail + mot de passe et pseudo", "strict minimum" | track E — Google sign-in and a pseudonym, no address on any screen |
| "un admin panel complet décomposé sous section avec des KPI" | tracks I and K |
| "pas de système de pubs ou de paiement… avant que le reste soit clean" | rule 1 of `00-overview.md` |
| "si je veux vendre le projet plus tard" | the modularity every track's exit gate defends |

**Two things it asked for do not exist, deliberately.** Revenue figures on the
admin panel, because there is no revenue — `09-admin.md` says why a dashboard
showing zero in six ways teaches nothing. And the AI-generated advertising
videos, which `11-deferred.md` parks with the rest of the monetisation.

---

But final :

Livré un jeu jouable sécurisé et attirant qui permette de générer des revenus pourquoi pas avec un système de pubs sur la page.

Objectif :

Améliorer l'UI afin d'être plus attirant sympa a l'oeil, bosser sur l'interface l'UX, l'accéssibilité. Et pourquoi pas faire une refonte complète afin de proposer une réelle expérience scrollable comme les sites actuels de web design du genre : awwwards.com avec un scroll déroulant une réelle timeline avec le site la fenetre comme une scene principale une caméra fixe, ce n'est pas la caméra qui se déplace mais bien les éléménts qui passent devant la scène, qui s'entrechoquent, intéragissent entre eux afin de proposer une UI originale comme les plus grands sites de web design le fond, vraiment un design propre. Une DA bien respecté et définit avant tout.

Bosser sur le côté gamification, c'est à dire pourquoi pas un système de compte pourquoi pas connexion avec google afin d'avoir des statistics par joueur, hébergement chez Supabase si données utilisateurs alors ca implique forcèment une DB afin de stocker les données. On va pas s'emmerder avec des infos personelles ou quoi hors de questions ca sera beaucoup trop compliqué nivea RGPD donc on demande le strict minimum pour un compte et s y connecter afin de se souvenir des donnéees de l utilisateur. Mail + mot de passe et pseudo.

Proposer un système de quêtes quotidiennes, hebdomadaires et pourquoi pas mensuelles on va pas s emmerder avec un systeme de saison ca sera trop compliqué je veux que une fois l aplli lancée et déployé j'ai plus rien a faire j aurai la flemme de rajouter du contenu chaque mois je veux que ca marche de soi meme de maniere autonome.

pourquoi pas un classement mondial puis regional ( europe amerique ).

Un admin panel afin de voir toutes les données :
- revenus généres.
- utilisateurs les plus actifs
- nombre d'activés ( connecté ayant fait une game ) par rapport aux utilisateurs toujours présent sur la plateforme.
- vraiment un panel admin complet décomposé sous section avec des KPI afin d'avoir plein de données importantes afin de suivre la "santé" de l'application.
- voir les revenus généré grace aux pubs savoir si oui ou non on dois diminuer ou augmenter le nombre de pubs. Savoir comment mieux les integrer peut etre changer de mode de revenu en suivant les données financiers sur l admin panel.

Pourquoi systeme de recompenses avec achat in game avec des pieces possibilité de gagner de l argent si les gens veulent pas faire les quetes mais mettre directement de l argent sur le jeu. je sais pas comment on pourrais dépenser ces pieces : des indices peut etre en game ou je sais pas des skins des modes differnets je sais pas.

Je souhaiterai alors que toutes ces étapes soit documenté dans un plan tu sépare bien les chantiers et je veux pas de systeme de pubs ou de payement ou de revenu ou quoi que ce soit avant que le reste soit clean.

Sépare bien les plans et chantier comme ca je pourrai lancer un workflow d'agent afin de bosser sur chaque feature différentes ce qui permettra au projet d'avancer beaucoup plus vite.

Les regles de travail sont toujours les meme au niveau des PR conventions de commits ou quoi.

Pose des questions avant de commencer a documenter ecrire prendre une direction imaginer ou supposer.

commence par la refonte UI design et DA afin que lorsque on ajoute les autres fonctionnalites tu suive le fil et on est pas tout un site a refaire en UI par la suite. on commence sur des bonnes bases une belle DA ca suivra tout seul apres.

garde l esprit modularité structuré comme dans une grande entreprise comme un saas.

si je veux vendre le projet plus tard je pourrai au moins.

Faire des vidéos par IA avec seedance connecté a claude afin de générer de la pub utiliser plus meta et tiktok

améliore la documentation aussi tout ce qui est README parle pas trop du cote tech mais plus vraiment du concept en tant que tel du jeu des fonctionnalités et fait des liens entre les documentations afin que une IA ou un humain puisse commencer par lire le README puis soit redirigé vers un .md parlant de la stack entiere etc... ou un .md pour savoir comment lancer le projet en local.

ajoute tout ce qui est possible parmis cette liste ( bien sur cette liste est une liste pour un saas mais etant donné que nous c est un jeu si tu trouve que il y a des trucs inutiles notes les dans la docu pour plus tard si jamais on grandit on fera plus tard le moment venu si on en as besoin )  privacy policy terms page clear CTA FAQ robot.txt sitemap.xml custom 404 alt text analytics meta titles meta description social share favicon canonical URLs Cookie consents mobile version accesibility test forms check broken links optimize performance.
