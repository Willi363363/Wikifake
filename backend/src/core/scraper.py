import wikipedia
import time
import difflib
from typing import Optional
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from src.log import get_logger

from .settings import (
    HTTP_TIMEOUT,
    MAX_TOPIC_ATTEMPTS,
    MIN_ARTICLE_PARAGRAPHS,
    MIN_CONTENT_CHARS,
    MODEL_NAME,
)
import requests
from bs4 import BeautifulSoup
import re

log = get_logger(__name__)

USER_AGENT = "WikiFake/1.0 (jeu éducatif de fact-checking)"
# Pause entre deux tentatives, pour ne pas marteler Wikipédia.
RETRY_BACKOFF = 1

_llm_instance = None

def _get_llm():
    global _llm_instance
    if _llm_instance is None:
        _llm_instance = ChatGoogleGenerativeAI(model=MODEL_NAME, temperature=0.9)
    return _llm_instance

def get_topic_from_category(category: str, exclude_topics: list = None) -> str:
    """Demande à l'IA de trouver un sujet précis sur Wikipedia basé sur une catégorie."""
    llm = _get_llm()
    
    exclude_str = ""
    if exclude_topics:
        exclude_str = f" N'utilise PAS ces sujets qui ont déjà échoué: {', '.join(exclude_topics)}."

    prompt = ChatPromptTemplate.from_template(
        "Tu es un expert Wikipedia. L'utilisateur a entré la catégorie '{category}'. "
        "Donne-moi le titre exact d'un article Wikipedia français intéressant lié à cette catégorie.{exclude_str} "
        "Retourne UNIQUEMENT le nom de l'article, rien d'autre."
    )
    chain = prompt | llm | StrOutputParser()
    topic = chain.invoke({"category": category, "exclude_str": exclude_str}).strip()
    return topic

def _direct_match(category: str) -> Optional[str]:
    """Renvoie le titre exact si la saisie est déjà un article Wikipedia.

    On ne retient le premier résultat que s'il correspond vraiment à la saisie :
    une recherche Wikipedia renvoie un hit pour n'importe quelle entrée, donc
    prendre search()[0] tel quel court-circuitait get_topic_from_category pour
    toutes les catégories larges ("Histoire", "Sport") et figeait le même
    article à chaque partie.
    """
    try:
        results = wikipedia.search(category, results=3)
    except Exception as exc:
        log.debug("Recherche directe impossible pour %r: %s", category, exc)
        return None

    target = category.strip().casefold()
    for title in results:
        candidate = title.casefold()
        if candidate == target:
            return title
        if difflib.SequenceMatcher(None, candidate, target).ratio() >= 0.9:
            return title
    return None


def get_wikipedia_content(category: str) -> Optional[dict]:
    """Trouve un article Wikipedia jouable pour cette catégorie.

    Retourne None après `MAX_TOPIC_ATTEMPTS` essais infructueux. La boucle
    était auparavant infinie alors que chaque tour consomme un appel au
    modèle : une catégorie sans issue bloquait la requête et brûlait des
    crédits sans limite.
    """
    exclude_topics = []

    wikipedia.set_user_agent(USER_AGENT)
    wikipedia.set_lang('fr')

    first_try = True
    last_reason = "aucune tentative"

    for attempt in range(1, MAX_TOPIC_ATTEMPTS + 1):
        try:
            # On tente d'abord une recherche directe si le nom entré est déjà un sujet Wikipedia
            direct_hit = None
            if first_try:
                first_try = False
                direct_hit = _direct_match(category)

            if direct_hit:
                # Titre déjà trouvé : inutile de relancer une recherche dessus.
                topic = direct_hit
                search_results = [direct_hit]
                log.info("Sujet choisi: %s (correspondance directe)", topic)
            else:
                topic = get_topic_from_category(category, exclude_topics)
                log.info("Tentative %d/%d — sujet: %s", attempt, MAX_TOPIC_ATTEMPTS, topic)
                search_results = wikipedia.search(topic, results=3)

            if not search_results:
                last_reason = f"aucun résultat pour {topic!r}"
                log.info("%s — nouvel essai", last_reason)
                exclude_topics.append(topic)
                continue
                
            page = None
            for p_title in search_results:
                if p_title in exclude_topics:
                    continue
                try:
                    page = wikipedia.page(p_title, auto_suggest=False)
                    break
                except Exception as exc:
                    log.debug("Page %r inaccessible: %s", p_title, exc)
                    exclude_topics.append(p_title)
                    continue
            
            if not page:
                last_reason = f"aucune page accessible pour {topic!r}"
                log.info("%s — nouvel essai", last_reason)
                exclude_topics.append(topic)
                time.sleep(RETRY_BACKOFF)
                continue
                
            url = page.url
            log.info("Page trouvée: %s", url)

            # Scraper le HTML exact avec un User-Agent valide et un timeout :
            # sans lui, une requête pendante bloque le thread de génération.
            response = requests.get(url, headers={"User-Agent": USER_AGENT},
                                    timeout=HTTP_TIMEOUT)
            response.raise_for_status()
            html_content = response.text
            
            # Extraire les paragraphes pour l'IA
            soup = BeautifulSoup(html_content, 'html.parser')
            content_div = soup.find(id='bodyContent')
            paragraphs = collect_content_paragraphs(content_div or soup)

            if len(paragraphs) < MIN_ARTICLE_PARAGRAPHS:
                last_reason = (
                    f"article {page.title!r} trop court "
                    f"({len(paragraphs)} paragraphes exploitables)"
                )
                log.info("%s — nouvel essai", last_reason)
                exclude_topics.append(page.title)
                time.sleep(RETRY_BACKOFF)
                continue
                        
            return {
                "title": page.title,
                "url": url,
                "html": html_content,
                "soup": soup,
                "raw_paragraphs": paragraphs,
                "text_content": page.content
            }
        except Exception as exc:
            last_reason = f"erreur inattendue: {exc}"
            log.warning("%s — nouvel essai", last_reason)
            # Exclure le sujet en cours pour que le modèle en propose un autre.
            if 'topic' in locals() and topic not in exclude_topics:
                exclude_topics.append(topic)
            time.sleep(RETRY_BACKOFF)

    log.error("Aucun article exploitable pour %r après %d tentatives (%s)",
              category, MAX_TOPIC_ATTEMPTS, last_reason)
    return None


def collect_content_paragraphs(container) -> list:
    """Paragraphes de contenu d'une page Wikipedia, dans l'ordre du document.

    Chaque `<p>` est visité UNE SEULE FOIS. La version précédente concaténait
    `find_all('p', recursive=False)` et `find_all('p')` : comme le second
    contient déjà les enfants directs, tout paragraphe de premier niveau était
    ajouté deux fois, ce qui désalignait `raw_paragraphs` avec le document et
    faisait apparaître des doublons dans l'article servi au joueur.
    """
    paragraphs = []
    seen = set()
    for tag in container.find_all('p'):
        text = tag.get_text(strip=True)
        if len(text) <= MIN_CONTENT_CHARS:
            continue
        # Wikipedia sert parfois deux fois le même paragraphe (variantes
        # mobile/desktop) : on dédoublonne sur le texte complet.
        if text in seen:
            continue
        seen.add(text)
        paragraphs.append(tag)
    return paragraphs


_MULTISPACE_RE = re.compile(r'\s+')
_SPACE_BEFORE_PUNCT_RE = re.compile(r'\s+([.,;:!?%)\]])')


def clean_paragraph_text(raw: str) -> str:
    """Normalise le texte d'un paragraphe : espaces, insécables, ponctuation."""
    text = raw.replace('\xa0', ' ')
    text = _MULTISPACE_RE.sub(' ', text)
    text = _SPACE_BEFORE_PUNCT_RE.sub(r'\1', text)
    return text.strip()


def extract_paragraphs(content_data: dict) -> list:
    """Texte lisible de chaque paragraphe, dans le même ordre.

    `get_text(" ")` insère le séparateur entre les nœuds : les mots collés par
    les balises inline sont séparés SANS toucher au document. La version
    précédente réécrivait chaque `tag.string` pour y ajouter des espaces, et
    modifiait donc la soup que l'appelant réutilise ensuite pour produire le
    HTML de l'article — un effet de bord invisible sur un objet partagé.
    """
    if "raw_paragraphs" not in content_data:
        return []

    # Pas de filtrage : `result[i]` doit toujours correspondre à
    # `raw_paragraphs[i]`, sinon les index de `positions` se décalent.
    return [clean_paragraph_text(tag.get_text(" ")) for tag in content_data["raw_paragraphs"]]
