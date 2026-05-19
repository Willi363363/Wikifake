import os
import uvicorn
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from dotenv import load_dotenv
import random
import string
import json
import time
import asyncio

# Import logic
from src.backend.core.agent import FakeNewsGame
from src.backend.core.verification import check_answer

load_dotenv()
app = FastAPI()
game = FakeNewsGame()

GAME_DURATION = 300  # 5 minutes

ITEMS = [
    {"id": "BLUR",        "name": "Brouillard",  "icon": "👁",  "description": "Floute l'écran d'un joueur pendant 5s",   "targetCount": 1, "weight": 10},
    {"id": "FREEZE_TIME", "name": "Gel du temps", "icon": "⏸",  "description": "Fige le chrono d'un joueur pendant 10s",  "targetCount": 1, "weight": 10},
    {"id": "SCORE_STEAL", "name": "Pillage",      "icon": "⚡",  "description": "Vole 50 pts à un joueur",                 "targetCount": 1, "weight": 8},
    {"id": "HINT_LOCK",   "name": "Brouilleur",   "icon": "🔒", "description": "Bloque les hints d'un joueur pendant 20s", "targetCount": 1, "weight": 8},
    {"id": "BLACKOUT",    "name": "Censure CIA",  "icon": "⬛", "description": "Censure le texte d'un joueur (5s)",        "targetCount": 1, "weight": 6},
    {"id": "EARTHQUAKE",  "name": "Séisme",       "icon": "🌋", "description": "Fait trembler l'écran d'un joueur (5s)",   "targetCount": 1, "weight": 6},
    {"id": "RICKROLL",    "name": "Pop-up Spam",  "icon": "🤡", "description": "Affiche un pop-up gênant à un joueur",     "targetCount": 1, "weight": 4},
    {"id": "SCANNER",     "name": "Détecteur",    "icon": "🔎", "description": "Surligne un paragraphe contenant une erreur", "targetCount": 0, "weight": 2},
]

# Global state for multiplayer rooms
rooms = {}

# Model for request
class StartGameRequest(BaseModel):
    category: str

class SubmitAnswerRequest(BaseModel):
    paragraph_indices: list[int]

@app.post("/api/game/start")
def start_game(req: StartGameRequest):
    game_data = game.start_game(req.category)
    if not game_data:
        raise HTTPException(status_code=400, detail="Mots-clés introuvables. Essayez une autre catégorie.")
    
    # Extract only needed data for the frontend
    return {
        "topic": game_data["topic"],
        "paragraphs": game_data["paragraphs"],
        "misinformations": game_data["misinformations"],
        "positions": game_data["positions"],
        "total_fakes": game_data["total_false_statements"],
        "wikipedia_url": game_data.get("wikipedia_url", "")
    }

@app.post("/api/game/submit")
def submit_answer(req: SubmitAnswerRequest):
    result = game.submit_answers(req.paragraph_indices)
    return result

# Multiplayer Endpoints
async def item_distribution_loop(room_code: str):
    """Distributes one random item to each player every 60 seconds, 4 times (minutes 1–4)."""
    try:
        for minute in range(1, 5):
            await asyncio.sleep(60)
            if room_code not in rooms or rooms[room_code]["state"] != "playing":
                break
            room = rooms[room_code]
            distribution = {}
            for pname in list(room["players"].keys()):
                weights = [i.get("weight", 10) for i in ITEMS]
                item = random.choices(ITEMS, weights=weights, k=1)[0]
                instance = {**item, "instance_id": f"{pname}_{minute}_{item['id']}"}
                room["players"][pname].setdefault("items", []).append(instance)
                distribution[pname] = instance
            await broadcast(room_code, {
                "type": "items_distributed",
                "minute": minute,
                "items": distribution,
            })
    except asyncio.CancelledError:
        pass


@app.post("/api/multiplayer/create")
def create_room():
    code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
    rooms[code] = {
        "players": {},
        "game_data": None,
        "state": "waiting",
        "start_time": 0,
        "item_task": None,
    }
    return {"room_code": code}

@app.websocket("/ws/{room_code}/{player_name}")
async def websocket_endpoint(websocket: WebSocket, room_code: str, player_name: str):
    await websocket.accept()
    if room_code not in rooms:
        await websocket.close(code=1008)
        return
        
    room = rooms[room_code]
    room["players"][player_name] = {
        "socket": websocket,
        "score": 0,
        "answered": False,
        "results": None
    }
    
    # Broadcast join
    await broadcast_lobby(room_code)
    
    try:
        while True:
            data_str = await websocket.receive_text()
            data = json.loads(data_str)
            
            if data["type"] == "start_game" and room["state"] == "waiting":
                category = data.get("category")
                with_items = data.get("with_items", True)
                room["with_items"] = with_items
                # Generate game
                game_data = game.start_game(category)
                if not game_data:
                    await websocket.send_text(json.dumps({"type": "error", "message": "Mot-clé introuvable."}))
                    continue
                
                room["game_data"] = game_data
                room["state"] = "playing"
                room["start_time"] = time.time()
                
                # Reset players
                for p in room["players"].values():
                    p["score"] = 0
                    p["answered"] = False
                    p["results"] = None
                    p["items"] = []

                # Start item distribution task (only if items mode is on)
                if room["item_task"] and not room["item_task"].done():
                    room["item_task"].cancel()
                if with_items:
                    room["item_task"] = asyncio.create_task(item_distribution_loop(room_code))
                
                # Broadcast start
                payload = {
                    "type": "game_start",
                    "data": {
                        "topic": game_data["topic"],
                        "paragraphs": game_data["paragraphs"],
                        "misinformations": game_data["misinformations"],
                        "positions": game_data["positions"],
                        "total_fakes": game_data["total_false_statements"],
                        "wikipedia_url": game_data.get("wikipedia_url", ""),
                        "players": list(room["players"].keys()),
                        "with_items": with_items,
                    }
                }
                await broadcast(room_code, payload)
                
            elif data["type"] == "live_score" and room["state"] == "playing":
                await broadcast(room_code, {
                    "type": "live_score_update",
                    "player": player_name,
                    "score": data.get("score", 0)
                })
                
            elif data["type"] == "cursor" and room["state"] == "playing":
                # Broadcast cursor to everyone EXCEPT the sender
                msg_str = json.dumps({
                    "type": "cursor_update",
                    "player": player_name,
                    "x": data.get("x", 0),
                    "y": data.get("y", 0)
                })
                for name, p in room["players"].items():
                    if name != player_name:
                        try:
                            await p["socket"].send_text(msg_str)
                        except:
                            pass
                            
            elif data["type"] == "use_item" and room["state"] == "playing":
                instance_id = data.get("instance_id")
                targets = data.get("targets", [])
                player_items = room["players"][player_name].get("items", [])
                item_used = None
                for i, it in enumerate(player_items):
                    if it["instance_id"] == instance_id:
                        item_used = player_items.pop(i)
                        break
                if item_used:
                    for target in targets:
                        if target in room["players"]:
                            try:
                                await room["players"][target]["socket"].send_text(json.dumps({
                                    "type": "item_effect",
                                    "item_id": item_used["id"],
                                    "item_name": item_used["name"],
                                    "item_icon": item_used["icon"],
                                    "from": player_name,
                                }))
                            except:
                                pass
                    await broadcast(room_code, {
                        "type": "item_used",
                        "player": player_name,
                        "item_id": item_used["id"],
                        "item_name": item_used["name"],
                        "item_icon": item_used["icon"],
                        "targets": targets,
                    })

            elif data["type"] == "unsubmit_answer" and room["state"] == "playing":
                room["players"][player_name]["answered"] = False
                await broadcast_lobby(room_code)

            elif data["type"] == "submit_answer" and room["state"] == "playing":
                indices = data.get("answers", [])
                hints_used = data.get("hintsUsed", 0)
                hint_penalty = data.get("hintPenalty", 0)
                score_stolen = data.get("scoreStolen", 0)
                time_taken = time.time() - room["start_time"]

                # Score logic
                result = check_answer(indices, room["game_data"]["positions"])
                tp = len(result["correct_found"])
                fp = len(result["false_positives"])

                time_remaining = max(0, GAME_DURATION - time_taken)
                time_bonus = int(time_remaining * 0.5)

                base_score = tp * 150
                fp_penalty = fp * 80

                score = base_score - fp_penalty - hint_penalty - score_stolen + time_bonus

                room["players"][player_name]["answered"] = True
                room["players"][player_name]["score"] = score
                room["players"][player_name]["results"] = {
                    "tp": tp,
                    "fp": fp,
                    "timeBonus": time_bonus,
                    "hintsUsed": hints_used,
                    "hintPenalty": hint_penalty
                }

                # Check if everyone answered
                all_answered = all(p["answered"] for p in room["players"].values())
                if all_answered:
                    room["state"] = "waiting"
                    if room["item_task"] and not room["item_task"].done():
                        room["item_task"].cancel()
                    leaderboard = [
                        {
                            "id": name,
                            "name": name,
                            "score": p["score"],
                            "breakdown": {
                                "tp": p["results"]["tp"],
                                "fp": p["results"]["fp"],
                                "timeBonus": p["results"]["timeBonus"],
                                "hintsUsed": p["results"]["hintsUsed"],
                                "hintPenalty": p["results"]["hintPenalty"]
                            }
                        }
                        for name, p in room["players"].items()
                    ]
                    leaderboard.sort(key=lambda x: x["score"], reverse=True)
                    await broadcast(room_code, {"type": "game_end", "leaderboard": leaderboard})
                else:
                    await broadcast_lobby(room_code) # just to update answered status

    except WebSocketDisconnect:
        if player_name in room["players"]:
            del room["players"][player_name]
            await broadcast_lobby(room_code)

        if not room["players"]:
            if room.get("item_task") and not room["item_task"].done():
                room["item_task"].cancel()
            del rooms[room_code]

async def broadcast_lobby(room_code: str):
    if room_code not in rooms: return
    room = rooms[room_code]
    players_data = [{"name": name, "answered": p["answered"]} for name, p in room["players"].items()]
    await broadcast(room_code, {"type": "lobby_update", "players": players_data})

async def broadcast(room_code: str, message: dict):
    if room_code not in rooms: return
    msg_str = json.dumps(message)
    for p in rooms[room_code]["players"].values():
        try:
            await p["socket"].send_text(msg_str)
        except:
            pass


# Serve the static files from the interface directory
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
INTERFACE_DIR = os.path.join(BASE_DIR, "src", "frontend")

@app.get("/")
def index():
    return FileResponse(os.path.join(INTERFACE_DIR, "WikiFake.html"))

# Serve public assets (images, etc.)
PUBLIC_DIR = os.path.join(BASE_DIR, "src", "public")
app.mount("/public", StaticFiles(directory=PUBLIC_DIR), name="public")

app.mount("/", StaticFiles(directory=INTERFACE_DIR), name="static")

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
