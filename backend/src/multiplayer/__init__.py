import socket
from rich.console import Console
from rich.panel import Panel
from rich.prompt import Prompt
import threading
import time

from .server import MultiplayerServer
from .client import MultiplayerClient

console = Console()

def find_server_by_code(code: str, timeout=3.0) -> str:
    console.print(f"[cyan]Recherche de la salle {code} sur le réseau local...[/cyan]")
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
    sock.settimeout(timeout)
    
    try:
        # Broadcast discovery message
        msg = f"FIND_ROOM:{code}".encode('utf-8')
        sock.sendto(msg, ('<broadcast>', 5556))
        
        while True:
            data, addr = sock.recvfrom(1024)
            response = data.decode('utf-8')
            if response.startswith("ROOM_FOUND:"):
                port = int(response.split(":")[1])
                return addr[0], port
    except socket.timeout:
        return None, None
    except Exception as e:
        console.print(f"[red]Erreur de découverte: {e}[/red]")
        return None, None
    finally:
        sock.close()


def start_multiplayer_menu():
    console.print(Panel.fit("[bold magenta]🌐 Mode Multijoueur[/bold magenta]", border_style="magenta"))
    console.print("1. Créer une salle (Hôte)")
    console.print("2. Rejoindre une salle")
    console.print("3. Retour au menu principal")
    
    choice = Prompt.ask("Choisissez une option", choices=["1", "2", "3"])
    
    if choice == "1":
        # Démarrer le serveur dans un thread
        server = MultiplayerServer()
        
        name = Prompt.ask("Entrez votre pseudo")
        
        # Le serveur tourne et affiche son menu hôte
        # Pour que l'hôte puisse jouer, il connecte aussi un client en local
        client = MultiplayerClient(name, "127.0.0.1", 5555)
        
        server.start() # start the background thread, wait wait
        # Actually server.start() is blocking on host_menu. 
        # So we should run the server in a thread.
        server_thread = threading.Thread(target=server.start, daemon=True)
        server_thread.start()
        
        # Wait a bit for server to bind
        time.sleep(0.5)
        
        client.connect()
        
    elif choice == "2":
        name = Prompt.ask("Entrez votre pseudo")
        code = Prompt.ask("Entrez le code de la salle")
        
        host_ip, port = find_server_by_code(code.upper())
        if host_ip:
            console.print(f"[green]Salle trouvée à l'adresse {host_ip}:{port}[/green]")
            client = MultiplayerClient(name, host_ip, port)
            client.connect()
        else:
            console.print("[red]Salle introuvable ou code incorrect.[/red]")
            
    elif choice == "3":
        return
