import random
import json

from src.log import get_logger
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate
from src.usage import record_call

from .settings import MODEL_NAME

log = get_logger(__name__)

NUM_FAKES = 4
MIN_PARAGRAPH_LENGTH = 100

# Le batch produit NUM_FAKES réécritures complètes + explications + indices.
# Sans plafond explicite, une troncature silencieuse rend le JSON invalide et
# fait échouer tout le lot.
MAX_OUTPUT_TOKENS = 8192

_llm_instance = None

def _get_llm():
    global _llm_instance
    if _llm_instance is None:
        _llm_instance = ChatGoogleGenerativeAI(
            model=MODEL_NAME,
            temperature=0.7,
            max_output_tokens=MAX_OUTPUT_TOKENS,
        )
    return _llm_instance

def _filter_paragraphs(paragraphs: list) -> list[tuple[int, str]]:
    return [
        (idx, p) for idx, p in enumerate(paragraphs)
        if len(p.strip()) >= MIN_PARAGRAPH_LENGTH
    ]

def _parse_json_array(raw: str) -> list:
    """Extrait le tableau JSON d'une réponse LLM, fences et prose comprises."""
    text = raw.strip()

    if text.startswith("```json"):
        text = text[7:]
    elif text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]
    text = text.strip()

    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        # Repli : isoler le premier bloc [...] quand le modèle ajoute du texte.
        start, end = text.find("["), text.rfind("]")
        if start == -1 or end <= start:
            return []
        data = json.loads(text[start:end + 1])

    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        # Certaines réponses enveloppent le tableau : {"paragraphs": [...]}.
        for value in data.values():
            if isinstance(value, list):
                return value
        return [data]
    return []

def _is_valid_fake(item) -> bool:
    """Un item n'est exploitable que si swapped_text est une chaîne non vide."""
    return (
        isinstance(item, dict)
        and isinstance(item.get("swapped_text"), str)
        and bool(item["swapped_text"].strip())
    )

def _coerce_index(value):
    """Le modèle renvoie parfois l'indice en chaîne ("12") au lieu d'un entier."""
    try:
        return int(value)
    except (TypeError, ValueError):
        return None

def _match_fakes(selected: list[tuple[int, str]], fakes_batch: list) -> dict:
    """Associe chaque paragraphe sélectionné à son item LLM.

    Les paragraph_index ne sont utilisés que s'ils sont TOUS cohérents avec les
    indices demandés. Sinon on associe uniquement par position, le prompt
    imposant « un par paragraphe dans le même ordre ».

    Ce tout-ou-rien est volontaire : un modèle qui renumérote sa réponse 0..3
    peut produire un indice qui existe aussi dans la requête, et un match
    partiel de ce genre est pire qu'aucun match — le texte truqué d'un
    paragraphe atterrirait sur un autre, avec l'explication du mauvais.
    """
    valid_items = [item for item in fakes_batch if _is_valid_fake(item)]
    if not valid_items:
        return {}

    requested = {idx for idx, _ in selected}
    coerced = [_coerce_index(item.get("paragraph_index")) for item in valid_items]
    trust_indices = all(key is not None and key in requested for key in coerced)

    resolved = {}
    taken = set()

    if trust_indices:
        positions_by_idx = {}
        for position, key in enumerate(coerced):
            if key not in positions_by_idx:
                positions_by_idx[key] = position
        for idx, _ in selected:
            position = positions_by_idx.get(idx)
            if position is not None and position not in taken:
                resolved[idx] = valid_items[position]
                taken.add(position)
    else:
        print(
            "Indices LLM incohérents avec la requête "
            f"({coerced} vs {sorted(requested)}) : association par position."
        )

    free = [p for p in range(len(valid_items)) if p not in taken]
    for idx, _ in selected:
        if idx in resolved or not free:
            continue
        resolved[idx] = valid_items[free.pop(0)]

    return resolved

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

    # On invoque le modèle sans parseur de sortie pour conserver
    # `usage_metadata` : c'est la seule source fiable du coût réel.
    rendered = prompt.format_messages(topic=topic, paragraphs_json=items_payload)
    prompt_text = "\n".join(str(message.content) for message in rendered)
    try:
        message = llm.invoke(rendered)
        text = str(message.content).strip()
        record_call("falsification", prompt_text, text,
                    getattr(message, "usage_metadata", None))
        return _parse_json_array(text)
    except Exception as exc:
        record_call("falsification", prompt_text, "", None, failed=True)
        log.warning("Génération groupée des faux échouée: %s", exc)
        return []

def swap_paragraphs(paragraphs: list, topic: str) -> tuple[list, list]:
    candidates = _filter_paragraphs(paragraphs)
    if not candidates:
        return paragraphs, []

    num_fakes = min(NUM_FAKES, len(candidates))
    selected = random.sample(candidates, num_fakes)

    modified = paragraphs.copy()
    swaps = []

    resolved = _match_fakes(selected, _generate_fakes_batch(selected, topic))

    # Un seul appel groupé signifie qu'une erreur API, un rate-limit ou une
    # troncature fait perdre les NUM_FAKES d'un coup. On rejoue uniquement les
    # paragraphes manquants pour retrouver la dégradation gracieuse qu'offrait
    # la génération paragraphe par paragraphe.
    missing = [(idx, text) for idx, text in selected if idx not in resolved]
    if missing:
        print(f"{len(missing)}/{len(selected)} paragraphes manquants : nouvelle tentative.")
        resolved.update(_match_fakes(missing, _generate_fakes_batch(missing, topic)))

    for idx, original_text in selected:
        fake_data = resolved.get(idx)
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
