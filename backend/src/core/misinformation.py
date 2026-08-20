import random
import json
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from .settings import MODEL_NAME

NUM_FAKES = 4
MIN_PARAGRAPH_LENGTH = 100

_llm_instance = None

def _get_llm():
    global _llm_instance
    if _llm_instance is None:
        _llm_instance = ChatGoogleGenerativeAI(model=MODEL_NAME, temperature=0.7)
    return _llm_instance

def _filter_paragraphs(paragraphs: list) -> list[tuple[int, str]]:
    return [
        (idx, p) for idx, p in enumerate(paragraphs)
        if len(p.strip()) >= MIN_PARAGRAPH_LENGTH
    ]

def _generate_fakes_batch(selected: list[tuple[int, str]], topic: str) -> list[dict]:
    """Generates all fake paragraph modifications in ONE single LLM request."""
    llm = _get_llm()

    prompt = ChatPromptTemplate.from_messages([
        ("system", """
Tu es un expert en création de désinformation crédible pour un jeu éducatif.
On te donne plusieurs paragraphes d'un article Wikipedia sur "{topic}".
Pour CHAQUE paragraphe fourni dans la liste, modifie-le subtilement pour y introduire UNE fausse information crédible.
Il ne s'agit pas de changer tout le paragraphe, mais de modifier un fait (une date, un rôle historique, un lieu, une cause, etc) pour que ça paraisse tout à fait vrai pour un lecteur inattentif.

Tu dois retourner un tableau JSON d'objets (un par paragraphe dans le même ordre) avec exactement ces clés :
- "paragraph_index": l'indice d'origine fourni dans la requête (un entier).
- "swapped_text": Le paragraphe complet modifié.
- "explanation": Une explication très courte (1 phrase) sur LA VÉRITÉ.
- "hint": Un indice très court pour aider le joueur (ex: "Vérifiez cette date d'élection").

Assure-toi de renvoyer UNIQUEMENT le tableau JSON valide, sans autres textes.
"""),
        ("human", "Paragraphes à modifier :\n{paragraphs_json}"),
    ])

    items_payload = json.dumps([
        {"paragraph_index": idx, "original_text": text[:1000]}
        for idx, text in selected
    ], ensure_ascii=False)

    chain = prompt | llm | StrOutputParser()
    try:
        response = chain.invoke({"topic": topic, "paragraphs_json": items_payload}).strip()

        if response.startswith("```json"):
            response = response.replace("```json", "", 1)
        if response.endswith("```"):
            response = response[:-3]

        data = json.loads(response.strip())
        if isinstance(data, list):
            return data
        return []
    except Exception as e:
        print(f"Erreur LLM batch fake generation: {e}")
        return []

def swap_paragraphs(paragraphs: list, topic: str) -> tuple[list, list]:
    candidates = _filter_paragraphs(paragraphs)
    if not candidates:
        return paragraphs, []

    num_fakes = min(NUM_FAKES, len(candidates))
    selected = random.sample(candidates, num_fakes)

    modified = paragraphs.copy()
    swaps = []

    fakes_batch = _generate_fakes_batch(selected, topic)

    fakes_by_idx = {
        item.get("paragraph_index"): item
        for item in fakes_batch
        if isinstance(item, dict) and "swapped_text" in item
    }

    for idx, original_text in selected:
        fake_data = fakes_by_idx.get(idx)
        if not fake_data:
            continue

        modified[idx] = fake_data["swapped_text"]

        swaps.append({
            "paragraph_index": idx,
            "original_text": original_text,
            "swapped_text": fake_data["swapped_text"],
            "explanation": fake_data.get("explanation", "Cette information est fausse."),
            "hint": fake_data.get("hint", "Vérifiez cette information.")
        })

    return modified, swaps
