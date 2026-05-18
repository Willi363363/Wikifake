from dotenv import load_dotenv
from chain import FakeNewsGame
from ui import (print_header, print_welcome, print_loading, print_game_content, 
                get_category_input, get_answers, print_results, print_error, print_goodbye, console,
                open_game_html)


def main_game_loop():
    """Boucle principale du jeu"""
    load_dotenv()
    game = FakeNewsGame()
    
    print_header()
    print_welcome()
    
    while True:
        # Demander une catégorie
        category = get_category_input()
        
        if category.strip().lower() == "exit":
            print_goodbye()
            break
        
        if not category.strip():
            console.print("[red]Veuillez entrer une catégorie[/red]")
            continue
        
        # Charger le contenu
        print_loading()
        game_content = game.start_game(category)
        
        if not game_content:
            print_error(f"Impossible de trouver '{category}' sur Wikipedia. Essayez une autre catégorie.")
            continue
        
        # Afficher le contenu du jeu
        print_game_content(game_content)
        html_path = open_game_html(game_content)
        console.print(f"[dim]Version HTML ouverte: {html_path}[/dim]")
        
        # Récupérer les réponses
        user_answers = get_answers()
        
        if user_answers is None:
            print_goodbye()
            break
        
        # Vérifier les réponses
        result = game.submit_answers(user_answers)
        
        if "error" in result:
            print_error(result["error"])
            continue
        
        # Afficher les résultats
        print_results(result["feedback"], result["correct_misinformations"])
        
        # Demander si continuer
        console.print()
        play_again = console.input("[cyan]Voulez-vous jouer encore? (oui/non)[/cyan] ").strip().lower()
        if play_again not in ["oui", "o", "yes", "y"]:
            print_goodbye()
            break
        
        game.reset_game()
        console.print("\n" * 2)


if __name__ == "__main__":
    main_game_loop()
