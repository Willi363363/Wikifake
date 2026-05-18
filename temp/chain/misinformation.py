from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from config import MISINFORMATION_PROMPT, MODEL_NAME
import random


def generate_misinformation(content: str, topic: str) -> list:
    """
    Génère des fausses informations basées sur le contenu réel.
    
    Args:
        content: Le contenu original de Wikipedia
        topic: Le sujet/catégorie
        
    Returns:
        Une liste de fausses affirmations
    """
    try:
        llm = ChatOpenAI(model=MODEL_NAME, temperature=0.7)
        
        prompt = ChatPromptTemplate.from_template(MISINFORMATION_PROMPT)
        chain = prompt | llm | StrOutputParser()
        
        result = chain.invoke({
            "content": content[:2000],  # Limiter pour économiser les tokens
            "topic": topic
        })
        
        # Extraire les fausses affirmations (séparées par \n\n selon le prompt)
        import re
        blocks = result.split('\n\n')
        misinformations = []
        for block in blocks:
            text = block.strip()
            # Nettoyer d'éventuels numéros résiduels au début (ex "1.", "1) ", "- ")
            text = re.sub(r'^(\d+[\.\)]\s*|-\s*|(Paragraphe\s*\d+\s*:*\s*))', '', text, flags=re.IGNORECASE).strip()
            if text:
                misinformations.append(text)
        return misinformations[:3]  # Retourner maximum 3 fausses infos
        
    except Exception as e:
        print(f"Erreur lors de la génération: {str(e)}")
        return []


def integrate_misinformation(paragraphs: list, misinformations: list) -> tuple:
    """
    Intègre les fausses informations dans les paragraphes réels.
    
    Args:
        paragraphs: Les paragraphes originaux
        misinformations: Les fausses affirmations à intégrer
        
    Returns:
        Un tuple contenant (contenu_modifié, positions_des_fausses_infos)
    """
    if not paragraphs or not misinformations:
        return paragraphs, []
    
    modified_paragraphs = paragraphs.copy()
    positions = []
    
    # Intégrer les fausses infos dans des paragraphes aléatoires
    selected_indices = random.sample(range(len(modified_paragraphs)), 
                                    min(len(misinformations), len(modified_paragraphs)))
    
    for idx, mis_info in enumerate(misinformations):
        if idx < len(selected_indices):
            para_idx = selected_indices[idx]
            # Ajouter la fausse info à la fin du paragraphe
            modified_paragraphs[para_idx] = modified_paragraphs[para_idx] + f"\n\n[FAUSSE INFO {idx+1}] {mis_info}"
            positions.append({
                "paragraph_index": para_idx,
                "false_statement": mis_info,
                "false_info_number": idx + 1
            })
    
    return modified_paragraphs, positions


def create_game_content(paragraphs: list, misinformations: list) -> dict:
    """
    Crée le contenu du jeu avec les fausses infos intégrées.
    
    Args:
        paragraphs: Les paragraphes originaux
        misinformations: Les fausses affirmations
        
    Returns:
        Un dictionnaire contenant le contenu du jeu et les infos sur les fausses affirmations
    """
    modified_paragraphs, positions = integrate_misinformation(paragraphs, misinformations)
    
    return {
        "content": "\n\n".join(modified_paragraphs),
        "misinformations": misinformations,
        "positions": positions,
        "total_false_statements": len(misinformations)
    }
