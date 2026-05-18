from .scraper import get_wikipedia_content, extract_paragraphs
from .misinformation import generate_misinformation, create_game_content
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
        misinformations = generate_misinformation(wikipedia_data["text_content"], category)
        if not misinformations:
            return None
        
        # Modifier directement le DOM (soup)
        from bs4 import BeautifulSoup
        import random
        
        soup = wikipedia_data["soup"]
        raw_paragraphs = wikipedia_data["raw_paragraphs"]
        
        positions = []
        selected_indices = random.sample(range(len(raw_paragraphs)), min(len(misinformations), len(raw_paragraphs)))
        
        for idx, mis_info in enumerate(misinformations):
            if idx < len(selected_indices):
                para_idx = selected_indices[idx]
                p_tag = raw_paragraphs[para_idx]
                
                # Créer le tag visuel
                new_tag = soup.new_tag("span", style="background-color: #fff3bf; color: #c33; padding: 2px 4px; font-weight: bold; margin-left: 5px;")
                new_tag.string = f"[⚠️ FAUSSE INFO {idx+1}] {mis_info}"
                
                # L'ajouter à la fin du paragraphe
                p_tag.append(new_tag)
                
                positions.append({
                    "paragraph_index": para_idx,
                    "false_statement": mis_info,
                    "false_info_number": idx + 1
                })
        
        # Injection de la balise base pour conserver les styles
        head = soup.find('head')
        if head:
            base_tag = soup.new_tag("base", href=f"https://fr.wikipedia.org/wiki/{wikipedia_data['title']}")
            head.insert(0, base_tag)
            
            # Injection d'un petit panel de jeu
            style_tag = soup.new_tag("style")
            style_tag.string = """
            .game-panel {
                position: fixed; top: 10px; right: 10px; z-index: 99999;
                background: white; border: 2px solid #c33; padding: 15px;
                border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                max-width: 300px;
            }
            .game-panel h3 { margin-top: 0; color: #c33; }
            """
            head.append(style_tag)
            
        body = soup.find('body')
        if body:
            panel = soup.new_tag("div", attrs={"class": "game-panel"})
            panel_html = f"<h3>🎮 Hackathon GenAI</h3><p>Trouvez les fausses informations surlignées en jaune dans cet article et retenez leurs numéros !</p><p>Total: {len(positions)}</p>"
            panel.append(BeautifulSoup(panel_html, 'html.parser'))
            body.insert(0, panel)
            
        final_html = str(soup)
        
        self.current_game = {
            "topic": wikipedia_data["title"],
            "html": final_html, # Le HTML prêt
            "misinformations": misinformations,
            "positions": positions,
            "total_false_statements": len(positions),
            "original_paragraphs": paragraphs,
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
