import wikipedia
import time
from typing import Optional
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from config import MODEL_NAME
import requests
from bs4 import BeautifulSoup

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
    
    wikipedia.set_user_agent("FakeNews/1.0 (+http://www.example.com/bot)")
    wikipedia.set_lang('fr')
    
    while True:
        try:
            # Trouver un sujet précis
            topic = get_topic_from_category(category, exclude_topics)
            print(f"Sujet choisi par l'IA: {topic} ... Recherche de la page...")
            
            try:
                page = wikipedia.page(topic, auto_suggest=True)
            except wikipedia.exceptions.DisambiguationError as e:
                page = wikipedia.page(e.options[0])
            except wikipedia.exceptions.PageError:
                print(f"Article '{topic}' introuvable sur Wikipédia. Nouvel essai...")
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
            
            if len(paragraphs) < 2:
                print(f"L'article '{topic}' est trop court. Nouvel essai...")
                exclude_topics.append(topic)
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
    """
    Extrait le texte des paragraphes d'un contenu Wikipedia.
    """
    if "raw_paragraphs" in content_data:
        return [p.get_text(strip=True) for p in content_data["raw_paragraphs"]]
    return []
