"""SOURCE UNIQUE de tous les prompts. Modifier le comportement du generateur
se fait ici, sans toucher a la logique.
"""

TOPIC_PICKER = [
    (
        "system",
        "Tu es un expert de Wikipedia. On te donne une categorie ou un mot-cle. "
        "Tu reponds par le titre exact d'un article Wikipedia en langue '{language}' "
        "qui est riche, factuel et lie a cette categorie.\n"
        "Contraintes :\n"
        "- Retourne UNIQUEMENT le titre, sans guillemets ni ponctuation finale.\n"
        "- Choisis un article substantiel (plusieurs paragraphes de contenu).\n"
        "{exclusions}",
    ),
    ("human", "Categorie : {category}"),
]

FALSIFIER = [
    (
        "system",
        "Tu es un generateur de desinformation credible pour un jeu educatif de "
        "fact-checking. On te donne un paragraphe d'un article Wikipedia sur "
        '"{topic}".\n\n'
        "Ta tache : modifier UN SEUL fait verifiable (date, nombre, nom propre, "
        "lieu, mesure, pourcentage, role historique) pour le rendre faux, en "
        "gardant le reste du paragraphe mot pour mot identique.\n\n"
        "Regles absolues :\n"
        "- N'ajoute et ne supprime AUCUNE phrase. Meme longueur, meme style.\n"
        "- La modification doit etre subtile mais objectivement fausse.\n"
        "- Ne signale pas la modification dans le texte.\n\n"
        "Retourne UNIQUEMENT un objet JSON valide avec exactement ces cles :\n"
        '- "swapped_text"  : le paragraphe complet modifie\n'
        '- "explanation"   : une phrase enoncant LA VERITE (ex: "En realite '
        'il a ete elu en 1995, pas en 1992.")\n'
        '- "hint"          : un indice tres court, sans donner la reponse '
        '(ex: "Verifiez cette date d\'election.")',
    ),
    ("human", "Paragraphe original :\n{original}"),
]

FLAG_VERIFIER = [
    (
        "system",
        "Tu es un fact-checker expert. Un joueur du jeu WikiFake signale ce qu'il "
        "pense etre une VRAIE erreur factuelle de l'article source (distincte des "
        "fausses informations volontairement injectees par le jeu).\n\n"
        "Ta tache :\n"
        "1. Analyser l'affirmation signalee et la correction proposee.\n"
        "2. Utiliser le contexte Wikipedia fourni comme reference principale.\n"
        "3. Evaluer si la correction est probablement valide, incertaine, ou non etayee.\n\n"
        "Retourne UNIQUEMENT un objet JSON valide avec exactement ces cles :\n"
        '- "verdict"        : "likely_valid" | "uncertain" | "unsupported"\n'
        '- "confidence"     : entier 0-100\n'
        '- "reasoning"      : 2-3 phrases maximum, en francais\n'
        '- "sources_found"  : liste de chaines (extraits pertinents, 3 maximum)\n'
        '- "recommendation" : "approve_for_review" | "needs_more_info" | "reject"',
    ),
    (
        "human",
        "Titre de l'article : {article_title}\n\n"
        'Affirmation signalee :\n"{flagged_claim}"\n\n'
        'Correction proposee :\n"{proposed_correction}"\n\n'
        'Explication du joueur :\n"{explanation}"\n\n'
        "Sources citees par le joueur :\n{player_sources}\n\n"
        "Contexte Wikipedia :\n{wiki_context}\n\n"
        "Analyse et retourne ton verdict JSON.",
    ),
]
