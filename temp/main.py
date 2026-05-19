from dotenv import load_dotenv
from chain import FakeNewsGame
from ui import (print_header, print_welcome, print_loading, print_game_content, 
                get_category_input, print_error, print_goodbye, console,
                open_game_html, print_solutions)
import time


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
        
        # Afficher le contenu du jeu et la page
        print_game_content(game_content)
        open_game_html(game_content)
        
        # Demander si continuer
        console.print()
        time.sleep(1)
        print_solutions(game_content)
        play_again = console.input("[cyan]Voulez-vous générer un autre article avec des fausses informations ? (oui/non)[/cyan] ").strip().lower()
        if play_again not in ["oui", "o", "yes", "y"]:
            print_goodbye()
            break
        game.reset_game()
        console.print("\n" * 2)


if __name__ == "__main__":
    main_game_loop()
