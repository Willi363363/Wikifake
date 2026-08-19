import wikipedia
import time
from typing import Optional
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from .settings import MODEL_NAME
import requests
from bs4 import BeautifulSoup
import re

def get_topic_from_category(category: str, exclude_topics: list = None) -> str:
    """Demande à l'IA de trouver un sujet précis sur Wikipedia basé sur une catégorie."""
    llm = ChatOpenAI(model=MODEL_NAME, temperature=0.9)
    
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

def get_wikipedia_content(category: str) -> Optional[dict]:
    """
    Récupère le HTML brut et les paragraphes d'une page Wikipedia spécifique en bouclant
    jusqu'à succès.
    """
    exclude_topics = []
    
    wikipedia.set_user_agent("FakeNewsHunter/1.0 (+http://www.example.com/bot)")
    wikipedia.set_lang('fr')
    
    while True:
        try:
            # Trouver un sujet précis
            topic = get_topic_from_category(category, exclude_topics)
            print(f"Sujet choisi par l'IA: {topic} ... Recherche de la page...")
            
            # Faire une recherche Wikipedia pour s'assurer de trouver de vraies pages
            search_results = wikipedia.search(topic, results=3)
            
            if not search_results:
                print(f"Aucun résultat trouvé pour '{topic}'. Nouvel essai...")
                exclude_topics.append(topic)
                continue
                
            page = None
            for p_title in search_results:
                if p_title in exclude_topics:
                    continue
                try:
                    page = wikipedia.page(p_title, auto_suggest=False)
                    break
                except Exception:
                    exclude_topics.append(p_title)
                    continue
            
            if not page:
                print(f"Les pages trouvées pour '{topic}' ne sont pas accessibles. Nouvel essai...")
                exclude_topics.append(topic)
                time.sleep(1)
                continue
                
            url = page.url
            print(f"Page trouvée ! URL: {url}")
            
            # Scraper le HTML exact avec un User-Agent valide
            headers = {"User-Agent": "FakeNewsHunter/1.0 (+http://www.example.com/bot)"}
            response = requests.get(url, headers=headers)
            response.raise_for_status()
            html_content = response.text
            
            # Extraire les paragraphes pour l'IA
            soup = BeautifulSoup(html_content, 'html.parser')
            content_div = soup.find(id='bodyContent')
            paragraphs = []
            if content_div:
                for p in content_div.find_all('p', recursive=False) + content_div.find_all('p'):
                    text = p.get_text(strip=True)
                    if len(text) > 50: # Garder seulement les vrais paragraphes
                        paragraphs.append(p)
            
            if len(paragraphs) < 3:
                print(f"L'article '{page.title}' est trop court. Nouvel essai...")
                exclude_topics.append(page.title)
                time.sleep(1)
                continue
                        
            return {
                "title": page.title,
                "url": url,
                "html": html_content,
                "soup": soup,
                "raw_paragraphs": paragraphs,
                "text_content": page.content
            }
        except Exception as e:
            print(f"Erreur inattendue ({str(e)}). Nouvel essai...")
            # Ajouter aux exclus pour que l'IA choisisse un autre sujet la prochaine fois
            if 'topic' in locals() and topic not in exclude_topics:
                exclude_topics.append(topic)
            time.sleep(1)


def extract_paragraphs(content_data: dict) -> list:
    if "raw_paragraphs" not in content_data:
        return []

    result = []
    for p in content_data["raw_paragraphs"]:
        for tag in p.find_all(True):
            if tag.string:
                tag.string.replace_with(f" {tag.string} ")
        text = p.get_text()
        text = re.sub(r' +', ' ', text).strip()
        text = re.sub(r' ([.,;:!?])', r'\1', text)
        if text:
            result.append(text)

    return result
