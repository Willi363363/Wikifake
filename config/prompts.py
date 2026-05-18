MISINFORMATION_PROMPT = """
Tu es un expert en création de fausses informations plausibles.

Basé sur le contenu Wikipedia suivant sur le sujet "{topic}", génère exactement 3 fausses affirmations qui :
- Sont plausibles et pourraient tromper quelqu'un
- Contredisent ou déforment les informations réelles
- Sont courtes et précises (2-3 phrases maximum)
- Sont présentées comme des faits
- Utilisent un ton similaire à Wikipedia

Contenu original:
{content}

Génère les 3 fausses affirmations, numérotées (1. , 2. , 3.)
"""
