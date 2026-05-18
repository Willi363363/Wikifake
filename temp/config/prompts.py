MISINFORMATION_PROMPT = """
Tu es un expert en création de fausses informations plausibles.

Basé sur le contenu Wikipedia suivant sur le sujet "{topic}", génère exactement 3 paragraphes entièrement faux qui :
- Sont plausibles et pourraient tromper quelqu'un lisant l'article
- Contredisent ou déforment substantiellement les informations réelles
- Sont de la taille typique d'un paragraphe Wikipédia (3-4 phrases)
- Ne commencent NI par un numéro (1., 2.), NI par un tiret, NI par "Paragraphe :"
- Sont écrits dans le style neutre, formel et encyclopédique de Wikipedia

Contenu original (début):
{content}

Génère UNIQUEMENT les 3 paragraphes, séparés par un double saut de ligne, sans aucun préfixe ni numéro de liste :
"""
