from rich.console import Console
from rich.panel import Panel
from rich.prompt import Prompt
from rich.table import Table
from rich.text import Text

console = Console()


def print_header():
    console.print(Panel.fit(
        "[bold cyan]🎯 Fake News Hunter[/bold cyan]\n[dim]Trouvez les fausses informations cachées dans les articles Wikipedia[/dim]\n[dim]Tapez 'exit' pour quitter[/dim]",
        border_style="cyan"
    ))
    console.print()


def print_welcome():
    console.print(Panel(
        "[bold yellow]Bienvenue dans le jeu de détection de fausses informations![/bold yellow]\n\n"
        "Votre mission:\n"
        "1. Choisir une catégorie ou un sujet\n"
        "2. Lire attentivement le contenu\n"
        "3. Identifier les fausses affirmations\n"
        "4. Marquer les paragraphes suspects\n\n"
        "Bonne chance! 🕵️",
        border_style="yellow"
    ))
    console.print()


def print_loading():
    console.print("[cyan]⏳ Préparation du contenu...[/cyan]")


def print_game_content(game_data: dict):
    """Affiche le contenu du jeu"""
    console.print(Panel.fit(
        f"[bold green]Sujet: {game_data['topic']}[/bold green]",
        border_style="green"
    ))
    console.print()
    
    console.print("[bold]Consultez la page web qui vient de s'ouvrir ![/bold]")
    console.print()
    
    # Afficher les instructions
    console.print(Panel(
        f"[bold yellow]⚠️  Attention![/bold yellow]\n"
        f"[dim]Cet article contient {game_data['total_false_statements']} fausse(s) affirmation(s).[/dim]\n"
        f"[dim]Revenez ici avec les numéros des paragraphes correspondants (1, 2, 3...) ![/dim]",
        border_style="yellow"
    ))
    console.print()


def get_category_input() -> str:
    """Récupère le nom de la catégorie de l'utilisateur"""
    category = Prompt.ask("[cyan]Entrez une catégorie Wikipedia[/cyan]")
    return category


def get_answers() -> list:
    """Récupère les réponses de l'utilisateur"""
    console.print("\n[bold cyan]Entrez maintenant vos réponses:[/bold cyan]")
    console.print("[dim]Indiquez les numéros des paragraphes contenant des fausses infos (séparés par des espaces)[/dim]")
    console.print("[dim]Exemple: 1 3 5[/dim]")
    
    while True:
        try:
            response = Prompt.ask("[yellow]Votre réponse[/yellow]")
            if response.strip().lower() == "exit":
                return None
            
            indices = [int(x.strip()) for x in response.split() if x.strip()]
            if indices:
                return indices
            else:
                console.print("[red]Veuillez entrer au moins un numéro[/red]")
        except ValueError:
            console.print("[red]Format invalide. Entrez des nombres séparés par des espaces[/red]")


def print_results(feedback: str, correct_misinformations: list):
    """Affiche les résultats du jeu"""
    console.print(Panel(
        feedback,
        title="[green]📊 Résultats[/green]",
        border_style="green",
        padding=(1, 2)
    ))
    
    console.print()
    console.print("[bold cyan]Fausses affirmations du jeu:[/bold cyan]")
    for idx, mis in enumerate(correct_misinformations, 1):
        console.print(f"[red]{idx}. {mis}[/red]")
    
    console.print()


def print_error(message: str):
    console.print(Panel(
        f"[bold red]{message}[/bold red]",
        title="[red]⚠️  Erreur[/red]",
        border_style="red"
    ))


def print_goodbye():
    console.print(Panel.fit(
        "[dim]Merci d'avoir joué ! À bientôt 👋[/dim]",
        border_style="cyan"
    ))


def get_input() -> str:
    return Prompt.ask("[bold cyan]>[/bold cyan]")
