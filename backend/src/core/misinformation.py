import json
import random

from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI

from .settings import MODEL_NAME

NUM_FAKES = 4
MIN_PARAGRAPH_LENGTH = 100

def _filter_paragraphs(paragraphs: list) -> list[tuple[int, str]]:
    return [
        (idx, p) for idx, p in enumerate(paragraphs)
        if len(p.strip()) >= MIN_PARAGRAPH_LENGTH
    ]

def _generate_fake_version(original: str, topic: str) -> dict | None:
    llm = ChatOpenAI(model=MODEL_NAME, temperature=0.7)

    prompt = ChatPromptTemplate.from_messages([
        ("system", """
            Tu es un expert en création de désinformation crédible pour un jeu éducatif.
            On te donne un paragraphe d'un article Wikipedia sur "{topic}".
            Modifie subtilement ce paragraphe pour y introduire UNE fausse information crédible.
            Il ne s'agit pas de changer tout le paragraphe, mais de modifier un fait (une date, un rôle historique, un lieu, une cause, etc) pour que ça paraisse tout à fait vrai pour un lecteur inattentif.
            
            Tu dois retourner un objet JSON valide avec les clés suivantes :
            - "swapped_text": Le paragraphe complet modifié.
            - "explanation": Une explication très courte (1 phrase) sur LA VÉRITÉ. Par exemple: "En réalité, il n'a jamais été élu en 1992 mais en 1995."
            - "hint": Un indice très court pour aider le joueur (ex: "Vérifiez cette date d'élection").
            
            Assure-toi de renvoyer UNIQUEMENT le JSON valide, sans autres textes.
        """),
        ("human", "Paragraphe original :\n{original}"),
    ])

    chain = prompt | llm | StrOutputParser()
    try:
        response = chain.invoke({"topic": topic, "original": original[:1000]}).strip()
        
        # clean json markdown
        if response.startswith("```json"):
            response = response.replace("```json", "", 1)
        response = response.removesuffix("```")
            
        data = json.loads(response.strip())
        return data
    except Exception as e:  # noqa: BLE001
        print(f"Erreur LLM fake generation: {e}")
        return None

def swap_paragraphs(paragraphs: list, topic: str) -> tuple[list, list]:
    # We rename this internally to inject_fakes but keep signature
    candidates = _filter_paragraphs(paragraphs)
    if not candidates:
        return paragraphs, []
        
    num_fakes = min(NUM_FAKES, len(candidates))
    selected = random.sample(candidates, num_fakes)

    modified = paragraphs.copy()
    swaps = []

    for idx, original_text in selected:
        fake_data = _generate_fake_version(original_text, topic)
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
