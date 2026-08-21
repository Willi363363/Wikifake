from .scraper import get_wikipedia_content, extract_paragraphs
from .misinformation import swap_paragraphs
from .verification import check_answer, get_feedback
from typing import Optional


class FakeNewsGame:
    """Gère le jeu de détection de fausses informations"""
    
    def __init__(self):
        self.current_game = None
        self.current_topic = None
    
    def start_game(self, category: str) -> Optional[dict]:
        """
        Démarre une nouvelle partie du jeu.
        
        Args:
            category: La catégorie/sujet Wikipedia
            
        Returns:
            Le contenu du jeu ou None si échec
        """
        # Scraper Wikipedia
        wikipedia_data = get_wikipedia_content(category)
        if not wikipedia_data:
            return None
        
        self.current_topic = wikipedia_data["title"]
        
        # Extraire les paragraphes
        paragraphs = extract_paragraphs(wikipedia_data)
        if len(paragraphs) < 2:
            return None
        
        # Générer les fausses infos
        modified_paragraphs, swaps = swap_paragraphs(paragraphs, wikipedia_data["title"])
        if not swaps:
            return None
        
        # Répercuter les faux dans le DOM et construire la vérité terrain.
        #
        # `swap_paragraphs` renvoie déjà l'index du paragraphe qu'il a modifié
        # (`paragraph_index`, base 0 dans `paragraphs`). Cet index est la seule
        # source de vérité : le réattribuer ferait noter le joueur sur un
        # paragraphe qui n'a pas été altéré.
        soup = wikipedia_data["soup"]
        raw_paragraphs = wikipedia_data["raw_paragraphs"]

        positions = []
        for number, swap in enumerate(sorted(swaps, key=lambda s: s["paragraph_index"]), start=1):
            para_idx = swap["paragraph_index"]

            if para_idx < len(raw_paragraphs):
                # Remplacer le contenu du vrai paragraphe par le faux généré par l'IA
                p_tag = raw_paragraphs[para_idx]
                p_tag.clear()
                p_tag.append(soup.new_string(swap["swapped_text"]))

            positions.append({
                # Base 1 : c'est ce que le client renvoie quand il clique.
                "paragraph_index": para_idx + 1,
                "false_statement": swap["swapped_text"],
                "false_info_number": number,
                "explanation": swap.get("explanation", "Explication manquante."),
                "hint": swap.get("hint", "Vérifiez cette information.")
            })
        
        # Injection de la balise base pour conserver les styles
        head = soup.find('head')
        if head:
            base_tag = soup.new_tag("base", href=f"https://fr.wikipedia.org/wiki/{wikipedia_data['title']}")
            head.insert(0, base_tag)
            
        final_html = str(soup)
        
        self.current_game = {
            "topic": wikipedia_data["title"],
            "html": final_html, # Le HTML prêt
            "misinformations": swaps,
            "positions": positions,
            "total_false_statements": len(positions),
            "paragraphs": modified_paragraphs,
            "wikipedia_url": wikipedia_data.get("url", "")
        }
        
        return self.current_game
    
    def submit_answers(self, paragraph_indices: list) -> dict:
        """
        Soumet les réponses et obtient le feedback.
        
        Args:
            paragraph_indices: Les indices des paragraphes identifiés comme faux
            
        Returns:
            Le résultat avec feedback
        """
        if not self.current_game:
            return {"error": "Aucune partie en cours"}
        
        result = check_answer(paragraph_indices, self.current_game["positions"])
        feedback = get_feedback(result, self.current_game["positions"])
        
        return {
            "check_result": result,
            "feedback": feedback,
            "correct_misinformations": self.current_game["misinformations"]
        }
    
    def get_current_game(self) -> Optional[dict]:
        """Retourne le contenu du jeu actuel"""
        return self.current_game
    
    def reset_game(self):
        """Réinitialise le jeu"""
        self.current_game = None
        self.current_topic = None
