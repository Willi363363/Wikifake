import socket
import threading
import sys
from rich.console import Console
from rich.panel import Panel
from rich.prompt import Prompt
from rich.table import Table
from bs4 import BeautifulSoup

from .protocol import send_message, receive_message

console = Console()

class MultiplayerClient:
    def __init__(self, name: str, host: str, port: int):
        self.name = name
        self.host = host
        self.port = port
        self.sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.running = False
        
    def connect(self):
        try:
            self.sock.connect((self.host, self.port))
            self.running = True
            
            # Send join
            send_message(self.sock, {
                "type": "join",
                "name": self.name
            })
            
            # Wait for accept
            msg = receive_message(self.sock)
            if msg and msg.get("type") == "join_accept":
                console.print(f"[green]Connecté au salon : {msg['room_code']}[/green]")
            else:
                console.print("[red]Échec de la connexion au salon.[/red]")
                return
                
            # Start listener thread
            listener = threading.Thread(target=self.listen_to_server, daemon=True)
            listener.start()
            
            # Keep main thread alive
            while self.running:
                import time
                time.sleep(0.5)
                
        except Exception as e:
            console.print(f"[red]Erreur de connexion: {e}[/red]")
            
    def listen_to_server(self):
        try:
            while self.running:
                msg = receive_message(self.sock)
                if not msg:
                    console.print("[red]Déconnecté du serveur.[/red]")
                    self.running = False
                    break
                    
                self.handle_server_message(msg)
        except Exception as e:
            console.print(f"[red]Erreur d'écoute: {e}[/red]")
            self.running = False
            
    def handle_server_message(self, msg: dict):
        msg_type = msg.get("type")
        
        if msg_type == "lobby_update":
            players = msg.get("players", [])
            console.print(f"\n[cyan]Joueurs dans le lobby: {', '.join(players)}[/cyan]")
            
        elif msg_type == "game_start":
            self.play_game(msg)
            
        elif msg_type == "answer_result":
            console.print(Panel.fit(
                f"[green]Score obtenu: {msg['score']} points ![/green]\n"
                f"Bonnes réponses: {msg['correct']}\n"
                f"Fausses alertes: {msg['false_positives']}\n"
                f"Temps: {msg['time']} secondes",
                title="Résultats", border_style="green"
            ))
            
        elif msg_type == "game_end":
            self.show_leaderboard(msg["leaderboard"])

    def play_game(self, game_data: dict):
        console.clear()
        console.print(Panel(f"[bold cyan]La partie commence ! Thème : {game_data['topic']}[/bold cyan]"))
        console.print(f"[yellow]Il y a {game_data['total_fakes']} fausses informations cachées. Trouvez-les vite ![/yellow]\n")
        
        # Display the text by parsing the HTML
        soup = BeautifulSoup(game_data["html"], "html.parser")
        paragraphs = soup.find_all("p")
        
        for idx, p in enumerate(paragraphs, 1):
            text = p.get_text().strip()
            if text:
                console.print(f"[bold cyan][{idx}][/bold cyan] {text}\n")
                
        # Ask for input
        while True:
            try:
                answer = Prompt.ask("Entrez les numéros des paragraphes faux (séparés par des virgules)")
                if not answer.strip():
                    continue
                indices = [int(x.strip()) for x in answer.split(",")]
                break
            except ValueError:
                console.print("[red]Format invalide. Exemple: 2, 5, 7[/red]")
                
        # Send to server
        send_message(self.sock, {
            "type": "submit_answer",
            "answers": indices
        })
        console.print("[yellow]En attente des autres joueurs...[/yellow]")
        
    def show_leaderboard(self, leaderboard: list):
        table = Table(title="🏆 Classement Final 🏆")
        table.add_column("Position", justify="right", style="cyan")
        table.add_column("Joueur", style="magenta")
        table.add_column("Score", justify="right", style="green")
        
        for idx, player in enumerate(leaderboard, 1):
            table.add_row(str(idx), player["name"], str(player["score"]))
            
        console.print(table)
        console.print("\n[yellow]Retour au lobby. En attente du lancement d'une nouvelle partie par l'hôte...[/yellow]")
