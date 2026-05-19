import socket
import threading
import time
import random
import string
from src.core.agent import FakeNewsGame
from src.core.verification import check_answer
from .protocol import send_message, receive_message

class MultiplayerServer:
    def __init__(self, host='0.0.0.0', port=5555):
        self.host = host
        self.port = port
        self.server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.server_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self.server_socket.bind((self.host, self.port))
        self.server_socket.listen(10)
        
        self.clients = {}  # {client_socket: {"name": str, "address": tuple, "score": int, "answered": bool}}
        self.game = FakeNewsGame()
        
        self.game_state = "waiting" # waiting, playing, finished
        self.current_game_data = None
        self.game_start_time = 0
        
        self.room_code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
        
        self.running = True
        self.discovery_thread = threading.Thread(target=self.udp_discovery, daemon=True)
        self.discovery_thread.start()

    def udp_discovery(self):
        """Answers to UDP broadcast packets so clients can discover the room by its code."""
        udp_sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        udp_sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        udp_sock.bind(('0.0.0.0', 5556))
        while self.running:
            try:
                data, addr = udp_sock.recvfrom(1024)
                message = data.decode('utf-8')
                if message.startswith("FIND_ROOM:"):
                    code = message.split(":")[1]
                    if code == self.room_code:
                        udp_sock.sendto(b"ROOM_FOUND:" + str(self.port).encode('utf-8'), addr)
            except Exception as e:
                pass
        udp_sock.close()
        
    def start(self):
        print(f"Serveur démarré sur {self.host}:{self.port}")
        print(f"Code de la salle: {self.room_code}")
        
        accept_thread = threading.Thread(target=self.accept_clients, daemon=True)
        accept_thread.start()
        
        self.host_menu()
        
    def host_menu(self):
        while self.running:
            if self.game_state == "waiting":
                print("\nOptions de l'Hôte:")
                print("1. Démarrer la partie")
                print("2. Fermer le serveur")
                choice = input("> ")
                
                if choice == "1":
                    self.start_game()
                elif choice == "2":
                    self.running = False
                    print("Fermeture...")
                    break
            else:
                time.sleep(1)

    def accept_clients(self):
        while self.running:
            try:
                client_sock, addr = self.server_socket.accept()
                
                # Receive join request
                msg = receive_message(client_sock)
                if msg and msg.get("type") == "join":
                    name = msg.get("name", "Anonyme")
                    self.clients[client_sock] = {
                        "name": name,
                        "address": addr,
                        "score": 0,
                        "answered": False
                    }
                    print(f"\n[+] {name} ({addr[0]}) a rejoint la salle.")
                    
                    send_message(client_sock, {
                        "type": "join_accept",
                        "room_code": self.room_code
                    })
                    
                    self.broadcast_lobby_state()
                    
                    # Handle client
                    threading.Thread(target=self.handle_client, args=(client_sock,), daemon=True).start()
                else:
                    client_sock.close()
            except Exception:
                if self.running:
                    print("Erreur acceptation client")
                    
    def broadcast_lobby_state(self):
        names = [c["name"] for c in self.clients.values()]
        for sock in self.clients:
            send_message(sock, {
                "type": "lobby_update",
                "players": names
            })

    def handle_client(self, client_sock):
        try:
            while self.running:
                msg = receive_message(client_sock)
                if not msg:
                    break
                
                if msg["type"] == "submit_answer" and self.game_state == "playing":
                    self.process_answer(client_sock, msg["answers"])
                    
        except Exception:
            pass
        finally:
            if client_sock in self.clients:
                name = self.clients[client_sock]["name"]
                print(f"\n[-] {name} s'est déconnecté.")
                del self.clients[client_sock]
                client_sock.close()
                if self.game_state == "waiting":
                    self.broadcast_lobby_state()

    def start_game(self):
        category = input("Entrez une catégorie Wikipédia pour jouer: ")
        print(f"Création du jeu avec la catégorie '{category}'...")
        
        game_data = self.game.start_game(category)
        if not game_data:
            print("Erreur: Impossible de générer la partie. Essayez un autre mot-clé.")
            return
            
        self.current_game_data = game_data
        self.game_state = "playing"
        self.game_start_time = time.time()
        
        # Reset player states
        for c in self.clients.values():
            c["score"] = 0
            c["answered"] = False
            
        # Send game data to everyone
        for sock in self.clients:
            send_message(sock, {
                "type": "game_start",
                "topic": game_data["topic"],
                "html": game_data["html"],
                "total_fakes": game_data["total_false_statements"]
            })
            
        print("La partie a commencé !")

    def process_answer(self, client_sock, answers):
        if client_sock not in self.clients:
            return
            
        client = self.clients[client_sock]
        if client["answered"]:
            return
            
        time_taken = time.time() - self.game_start_time
        result = check_answer(answers, self.current_game_data["positions"])
        
        # Calculate score
        correct_count = len(result["correct_found"])
        incorrect_count = len(result["false_positives"])
        
        # 1000 base pts per correct, -100 per false positive, -5 pts per second taken
        score = (correct_count * 1000) - (incorrect_count * 100) - int(time_taken * 5)
        if score < 0: score = 0
        if correct_count == 0: score = 0
        
        client["score"] = score
        client["answered"] = True
        
        send_message(client_sock, {
            "type": "answer_result",
            "score": score,
            "correct": correct_count,
            "false_positives": incorrect_count,
            "time": round(time_taken, 1)
        })
        
        self.check_game_end()
        
    def check_game_end(self):
        all_answered = all(c["answered"] for c in self.clients.values())
        if all_answered:
            print("\nTous les joueurs ont répondu. Fin de la partie !")
            self.game_state = "waiting"
            
            # Prepare leaderboard
            leaderboard = [{"name": c["name"], "score": c["score"]} for c in self.clients.values()]
            leaderboard.sort(key=lambda x: x["score"], reverse=True)
            
            for sock in self.clients:
                send_message(sock, {
                    "type": "game_end",
                    "leaderboard": leaderboard
                })
