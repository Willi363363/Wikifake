from .scraper import get_wikipedia_content, extract_paragraphs
from .misinformation import swap_paragraphs
from typing import Optional


class FakeNewsGame:
    """Génère une partie de détection de fausses informations.

    Sans état : `start_game` ne mémorise rien. Une seule instance était
    auparavant partagée par le mode solo et par toutes les salles, et son
    `self.current_game` était écrasé à chaque nouvelle partie.
    """

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
        
        return {
            "topic": wikipedia_data["title"],
            "html": final_html, # Le HTML prêt
            "misinformations": swaps,
            "positions": positions,
            "total_false_statements": len(positions),
            "paragraphs": modified_paragraphs,
            "wikipedia_url": wikipedia_data.get("url", "")
        }
