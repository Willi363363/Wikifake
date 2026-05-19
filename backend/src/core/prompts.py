MISINFORMATION_PROMPT = """
Tu es un saboteur d'encyclopédie. Ton rôle est de corrompre discrètement un paragraphe Wikipedia en changeant uniquement des faits précis et vérifiables.

Paragraphe original :
{content}

Sujet de l'article : {topic}

Règles absolues :
- NE JAMAIS ajouter de nouvelles phrases ou rallonger le paragraphe
- NE JAMAIS supprimer de phrases existantes
- Modifier UNIQUEMENT 1 ou 2 faits précis dans le texte : une date, un nombre, un nom propre, un lieu, une mesure, un pourcentage
- Le reste du paragraphe doit rester mot pour mot identique
- La modification doit être subtile mais clairement fausse pour quelqu'un qui connaît le sujet
- Garder exactement le même style, la même structure, la même longueur

Exemples de bonnes modifications :
- "en 1789" → "en 1802"
- "Albert Einstein" → "Max Planck"
- "48 kilomètres" → "48 mètres"
- "capitale de la France" → "deuxième ville de France"

Retourne UNIQUEMENT le paragraphe modifié, rien d'autre, aucun commentaire.
"""