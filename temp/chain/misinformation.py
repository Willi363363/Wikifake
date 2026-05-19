import random
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from config import MODEL_NAME

NUM_SWAPS = 3
MIN_PARAGRAPH_LENGTH = 80
MIN_DISTANCE = 3


def _filter_paragraphs(paragraphs: list) -> list[tuple[int, str]]:
    return [
        (idx, p) for idx, p in enumerate(paragraphs)
        if len(p.strip()) >= MIN_PARAGRAPH_LENGTH
    ]


def _pick_swap_pairs(candidates: list[tuple[int, str]], n: int) -> list[tuple[int, int]]:
    if len(candidates) < 2:
        return []

    pairs = []
    used = set()

    attempts = 0
    while len(pairs) < n and attempts < 100:
        attempts += 1
        a, b = random.sample(candidates, 2)
        idx_a, idx_b = a[0], b[0]

        if idx_a in used or idx_b in used:
            continue
        if abs(idx_a - idx_b) < MIN_DISTANCE:
            continue

        pairs.append((idx_a, idx_b))
        used.add(idx_a)
        used.add(idx_b)

    return pairs


def _generate_explanation(original: str, swapped_in: str, topic: str) -> str:
    llm = ChatOpenAI(model=MODEL_NAME, temperature=0.3)

    prompt = ChatPromptTemplate.from_messages([
        ("system", """
            Tu es un expert pédagogique en détection de désinformation.
            On t'donne deux paragraphes d'un article Wikipedia sur "{topic}".
            Le paragraphe A est celui qui était à cet endroit à l'origine.
            Le paragraphe B est celui qui a été substitué à sa place (fausse info).
            Explique en 2-3 phrases claires et pédagogiques pourquoi B est mal placé
            et ce qui le rend suspect comparé à A.
            Sois précis et éducatif, sans jargon.
            Réponds uniquement en français.
        """),
        ("human", "Paragraphe original (A) :\n{original}\n\nParagraphe substitué (B) :\n{swapped}"),
    ])

    chain = prompt | llm | StrOutputParser()

    return chain.invoke({
        "topic": topic,
        "original": original[:600],
        "swapped": swapped_in[:600],
    })


def swap_paragraphs(paragraphs: list, topic: str) -> tuple[list, list]:
    candidates = _filter_paragraphs(paragraphs)
    pairs = _pick_swap_pairs(candidates, NUM_SWAPS)

    modified = paragraphs.copy()
    swaps = []

    for idx_a, idx_b in pairs:
        original_a = paragraphs[idx_a]
        original_b = paragraphs[idx_b]

        modified[idx_a] = original_b
        modified[idx_b] = original_a

        explanation_a = _generate_explanation(original_a, original_b, topic)
        explanation_b = _generate_explanation(original_b, original_a, topic)

        swaps.append({
            "paragraph_index": idx_a,
            "original_text": original_a,
            "swapped_text": original_b,
            "explanation": explanation_a,
        })
        swaps.append({
            "paragraph_index": idx_b,
            "original_text": original_b,
            "swapped_text": original_a,
            "explanation": explanation_b,
        })

    return modified, swaps


def build_game_content(paragraphs: list, swaps: list) -> dict:
    false_indices = {s["paragraph_index"] for s in swaps}

    return {
        "paragraphs": paragraphs,
        "swaps": swaps,
        "false_indices": list(false_indices),
        "total_false_statements": len(swaps),
    }