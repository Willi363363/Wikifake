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

from src.core.agent import FakeNewsGame
from src.core.verification import check_answer
from typing import Optional

load_dotenv()
app = FastAPI()
game = FakeNewsGame()

GAME_DURATION = 300  # 5 minutes

ITEMS = [
    {"id": "HINT_LOCK",   "name": "Brouilleur",    "icon": "🔒", "description": "Bloque les hints d'un joueur pendant 20s",   "targetCount": 1},
    {"id": "FREEZE_TIME", "name": "Gel du temps",  "icon": "⏸",  "description": "Retire 10s au chrono d'un joueur",            "targetCount": 1},
    {"id": "SCORE_STEAL", "name": "Pillage",       "icon": "⚡",  "description": "Vole 50 pts à un joueur",                     "targetCount": 1},
    {"id": "EARTHQUAKE",  "name": "Séisme",        "icon": "🌋", "description": "Fait trembler l'écran d'un joueur (5s)",       "targetCount": 1},
    {"id": "BLACKOUT",    "name": "Censure CIA",   "icon": "⬛", "description": "Censure le texte d'un joueur (5s)",            "targetCount": 1},
    {"id": "BLUR",        "name": "Brouillard",    "icon": "👁",  "description": "Floute l'écran d'un joueur pendant 5s",       "targetCount": 1},
    {"id": "RICKROLL",    "name": "Pop-up Spam",   "icon": "🤡", "description": "Affiche un pop-up gênant à un joueur",         "targetCount": 1},
    {"id": "SCANNER",     "name": "Détecteur",     "icon": "🔎", "description": "Surligne un paragraphe contenant une erreur",  "targetCount": 0},
    {"id": "MIRROR",      "name": "Miroir",        "icon": "🪞", "description": "Inverse le texte de l'article (6s)",           "targetCount": 1},
    {"id": "TINY",        "name": "Loupe cassée",  "icon": "🔬", "description": "Rend le texte minuscule (8s)",                 "targetCount": 1},
    {"id": "SPIN",        "name": "Tournis",       "icon": "🌀", "description": "Fait tourner l'article (4s)",                  "targetCount": 1},
    {"id": "CONFETTI",    "name": "Fête surprise", "icon": "🎊", "description": "Explosion de confettis sur l'écran (6s)",      "targetCount": 1},
    {"id": "INVERT",      "name": "Négatif",       "icon": "🌑", "description": "Inverse les couleurs de l'écran (5s)",         "targetCount": 1},
]

AVAILABLE_COLORS = ["#e63946", "#f4a261", "#2a9d8f", "#264653", "#8338ec", "#ff006e", "#3a0ca3", "#fb5607"]

rooms = {}

class StartGameRequest(BaseModel):
    category: str

class SubmitAnswerRequest(BaseModel):
    paragraph_indices: list[int]

@app.get("/ping")
def ping():
    return {"status": "alive"}

@app.post("/api/game/start")
def start_game(req: StartGameRequest):
    game_data = game.start_game(req.category)
    if not game_data:
        raise HTTPException(status_code=400, detail="Mots-clés introuvables. Essayez une autre catégorie.")
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

async def item_distribution_loop(room_code: str):
    """Distributes one random item to each player every 30 seconds (up to 9 times)."""
    try:
        for minute in range(1, 10):
            await asyncio.sleep(30)
            if room_code not in rooms or rooms[room_code]["state"] != "playing":
                break
            room = rooms[room_code]
            distribution = {}
            for pname in list(room["players"].keys()):
                item = random.choice(ITEMS)
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

class CreateRoomRequest(BaseModel):
    max_rounds: int = 1

@app.post("/api/multiplayer/create")
def create_room(req: Optional[CreateRoomRequest] = None):
    code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
    max_rounds = req.max_rounds if req is not None else 1
    rooms[code] = {
        "players": {},
        "game_data": None,
        "state": "waiting",
        "start_time": 0,
        "item_task": None,
        "time_limit": GAME_DURATION,
        "max_rounds": max(1, min(max_rounds, 10)),
        "current_round": 0,
        "voting_themes": {},
        "between_rounds": False,
        "picking_theme": False,
    }
    return {"room_code": code}

@app.websocket("/ws/{room_code}/{player_name}")
async def websocket_endpoint(websocket: WebSocket, room_code: str, player_name: str):
    await websocket.accept()
    if room_code not in rooms:
        await websocket.close(code=1008)
        return

    room = rooms[room_code]
    
    if player_name in room["players"]:
        room["players"][player_name]["socket"] = websocket
        room["players"][player_name]["connected"] = True
    else:
        used_colors = [p.get("color") for p in room["players"].values()]
        available = [c for c in AVAILABLE_COLORS if c not in used_colors]
        color = available[0] if available else random.choice(AVAILABLE_COLORS)
        
        room["players"][player_name] = {
            "socket": websocket,
            "score": 0,
            "answered": False,
            "results": None,
            "ready": False,
            "color": color,
            "connected": True
        }

    await broadcast_lobby(room_code)

    try:
        while True:
            data_str = await websocket.receive_text()
            data = json.loads(data_str)

            if data["type"] == "set_ready":
                room["players"][player_name]["ready"] = data.get("ready", True)
                if "with_items" in data:
                    room["with_items"] = data["with_items"]
                if "time_limit" in data:
                    room["time_limit"] = int(data["time_limit"])
                if "max_rounds" in data:
                    room["max_rounds"] = max(1, min(int(data["max_rounds"]), 10))
                await broadcast_lobby(room_code)

            elif data["type"] == "get_lobby":
                # Player is returning to the lobby after a game, refresh their state
                await broadcast_lobby(room_code)

            elif data["type"] == "force_start" and room["state"] == "waiting":
                if "with_items" in data:
                    room["with_items"] = data["with_items"]
                if "time_limit" in data:
                    room["time_limit"] = int(data["time_limit"])
                if "max_rounds" in data:
                    room["max_rounds"] = max(1, min(int(data["max_rounds"]), 10))
                await start_theme_voting(room_code)

            elif data["type"] == "submit_theme" and room["state"] == "theme_voting":
                theme = data.get("theme", "").strip()
                if theme:
                    room["voting_themes"][player_name] = theme
                    connected_players = [n for n, p in room["players"].items() if p.get("connected", True)]
                    submitted = list(room["voting_themes"].keys())
                    await broadcast(room_code, {
                        "type": "theme_vote_update",
                        "submitted": submitted,
                        "total": len(connected_players)
                    })
                    # If everyone voted, pick a random theme and start
                    if all(n in room["voting_themes"] for n in connected_players):
                        await pick_and_start(room_code)

            elif data["type"] == "force_pick" and room["state"] == "theme_voting":
                if room["voting_themes"]:
                    await pick_and_start(room_code)
                else:
                    await websocket.send_text(json.dumps({"type": "error", "message": "Personne n'a encore proposé de thème."}))

            elif data["type"] == "start_game" and room["state"] == "waiting":
                category = data.get("category")
                with_items = data.get("with_items", True)
                time_limit = int(data.get("time_limit", GAME_DURATION))
                room["with_items"] = with_items
                room["time_limit"] = time_limit

                game_data = game.start_game(category)
                if not game_data:
                    await websocket.send_text(json.dumps({"type": "error", "message": "Mot-clé introuvable."}))
                    continue

                room["game_data"] = game_data
                room["state"] = "playing"
                room["start_time"] = time.time()

                for p in room["players"].values():
                    p["score"] = 0
                    p["answered"] = False
                    p["results"] = None
                    p["items"] = []

                if room["item_task"] and not room["item_task"].done():
                    room["item_task"].cancel()
                if with_items:
                    room["item_task"] = asyncio.create_task(item_distribution_loop(room_code))

                await broadcast(room_code, {
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
                        "time_limit": time_limit,
                    }
                })

            elif data["type"] == "live_score" and room["state"] == "playing":
                await broadcast(room_code, {
                    "type": "live_score_update",
                    "player": player_name,
                    "score": data.get("score", 0)
                })

            elif data["type"] == "cursor" and room["state"] == "playing":
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

                result = check_answer(indices, room["game_data"]["positions"])
                tp = len(result["correct_found"])
                fp = len(result["false_positives"])

                time_remaining = max(0, room["time_limit"] - time_taken)
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

                all_answered = all(p["answered"] for p in room["players"].values())
                if all_answered:
                    # Ignore duplicate end-of-round processing while transitioning
                    if room.get("between_rounds") or room.get("picking_theme"):
                        continue

                    max_rounds = room.get("max_rounds", 1)
                    current_round = room.get("current_round", 0)
                    
                    if room["item_task"] and not room["item_task"].done():
                        room["item_task"].cancel()

                    round_leaderboard = [
                        {
                            "id": name,
                            "name": name,
                            "score": p["score"],
                            "color": p.get("color"),
                            "breakdown": p["results"],
                        }
                        for name, p in room["players"].items()
                    ]
                    round_leaderboard.sort(key=lambda x: x["score"], reverse=True)

                    for name, p in room["players"].items():
                        p["total_score"] = p.get("total_score", 0) + p["score"]

                    if current_round < max_rounds - 1:
                        next_round = current_round + 1
                        room["current_round"] = next_round
                        room["between_rounds"] = True

                        await broadcast(room_code, {
                            "type": "round_end",
                            "round": current_round + 1,
                            "max_rounds": max_rounds,
                            "leaderboard": round_leaderboard,
                            "next_round": next_round + 1,
                            "countdown": 5
                        })

                        # Inter-round flow:
                        # 1) show the round_end overlay for a short moment
                        # 2) open a theme voting phase for the next round
                        await asyncio.sleep(5)
                        if room_code in rooms and room.get("between_rounds"):
                            await start_theme_voting(room_code)
                    else:
                        room["state"] = "waiting"
                        room["current_round"] = 0
                        # Build final leaderboard BEFORE resetting total_score
                        final_leaderboard = [
                            {
                                "id": name,
                                "name": name,
                                "score": p.get("total_score", p["score"]),
                                "color": p.get("color"),
                                "breakdown": p["results"],
                            }
                            for name, p in room["players"].items()
                        ]
                        final_leaderboard.sort(key=lambda x: x["score"], reverse=True)
                        # Reset all players' ready state and scores for the next game
                        for p in room["players"].values():
                            p["ready"] = False
                            p["total_score"] = 0
                        await broadcast(room_code, {"type": "game_end", "leaderboard": final_leaderboard})
                else:
                    await broadcast_lobby(room_code)

    except WebSocketDisconnect:
        if player_name in room["players"]:
            del room["players"][player_name]
            await broadcast_lobby(room_code)
        if not room["players"]:
            if room.get("item_task") and not room["item_task"].done():
                room["item_task"].cancel()
            del rooms[room_code]

async def broadcast_lobby(room_code: str):
    if room_code not in rooms:
        return
    room = rooms[room_code]
    players_data = [{"name": name, "answered": p.get("answered", False), "ready": p.get("ready", False), "color": p.get("color")} for name, p in room["players"].items()]
    await broadcast(room_code, {"type": "lobby_update", "players": players_data})

async def broadcast(room_code: str, message: dict):
    if room_code not in rooms:
        return
    msg_str = json.dumps(message)
    for p in rooms[room_code]["players"].values():
        try:
            await p["socket"].send_text(msg_str)
        except:
            pass

async def start_theme_voting(room_code: str):
    room = rooms[room_code]
    if room["state"] == "theme_voting":
        return
    room["state"] = "theme_voting"
    room["voting_themes"] = {}
    
    current_round = room.get("current_round", 0)
    max_rounds = room.get("max_rounds", 1)
    
    await broadcast(room_code, {
        "type": "theme_vote_start",
        "round": current_round + 1,
        "max_rounds": max_rounds
    })

async def pick_and_start(room_code: str, use_votes: bool = True):
    room = rooms[room_code]
    if room.get("picking_theme"):
        return
    room["picking_theme"] = True
    fallback_themes = ["Paris", "Chat", "Chocolat", "Football", "Soleil", "Lune", "Château", "Pizza", "Japon", "Cinéma"]

    if use_votes:
        themes = list(room["voting_themes"].values())
        available_themes = list(set(themes))
        random.shuffle(available_themes)
        all_candidates = available_themes + fallback_themes
        first_candidate = all_candidates[0] if all_candidates else "Général"
        proposers = [n for n, t in room["voting_themes"].items() if t == first_candidate]
        proposer_name = proposers[0] if proposers else "Système"
        all_themes_dict = room["voting_themes"]
    else:
        all_candidates = fallback_themes
        first_candidate = all_candidates[0] if all_candidates else "Général"
        proposer_name = "Système"
        all_themes_dict = {}

    # Step 1: immediately pick a candidate theme and broadcast it
    await broadcast(room_code, {
        "type": "theme_selected",
        "theme": first_candidate,
        "proposer": proposer_name,
        "all_themes": all_themes_dict,
        "loading": True  # signal the frontend to show the waiting screen immediately
    })

    # Step 2: generate the game data in a background thread so WebSocket stays alive
    import asyncio

    def generate_game():
        for theme in all_candidates:
            data = game.start_game(theme)
            if data:
                if use_votes:
                    p_list = [n for n, t in room["voting_themes"].items() if t == theme]
                    p = p_list[0] if p_list else "Système"
                else:
                    p = "Système"
                return theme, p, data
        return None, None, None

    chosen, proposer, game_data = await asyncio.to_thread(generate_game)

    if not game_data:
        room["picking_theme"] = False
        await broadcast(room_code, {"type": "error", "message": "Erreur critique : Impossible de charger un sujet Wikipédia."})
        room["state"] = "waiting"
        room["between_rounds"] = False
        await broadcast_lobby(room_code)
        return

    try:
        await start_game_in_room(room_code, chosen, is_new_round=(room.get("current_round", 0) > 0), preloaded_game_data=game_data)
    finally:
        room["picking_theme"] = False

async def start_game_in_room(room_code: str, category: str, is_new_round: bool = False, preloaded_game_data=None):
    room = rooms[room_code]
    game_data = preloaded_game_data or game.start_game(category)
    if not game_data:
        return False
    
    room["game_data"] = game_data
    room["state"] = "playing"
    room["between_rounds"] = False
    room["start_time"] = time.time()
    
    for p in room["players"].values():
        p["score"] = 0
        p["answered"] = False
        p["results"] = None
        p["ready"] = False
        p["items"] = []
    
    if room.get("item_task") and not room["item_task"].done():
        room["item_task"].cancel()
    if room.get("with_items", True):
        room["item_task"] = asyncio.create_task(item_distribution_loop(room_code))
    
    current_round = room.get("current_round", 0)
    max_rounds = room.get("max_rounds", 1)
    
    event_type = "round_start" if is_new_round else "game_start"
    payload = {
        "type": event_type,
        "round": current_round + 1,
        "max_rounds": max_rounds,
        "data": {
            "topic": game_data["topic"],
            "paragraphs": game_data["paragraphs"],
            "misinformations": game_data["misinformations"],
            "positions": game_data["positions"],
            "total_fakes": game_data["total_false_statements"],
            "wikipedia_url": game_data.get("wikipedia_url", ""),
            "players": [{"name": n, "color": p.get("color")} for n, p in room["players"].items()],
            "with_items": room.get("with_items", True),
            "time_limit": room.get("time_limit", GAME_DURATION),
        }
    }
    await broadcast(room_code, payload)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INTERFACE_DIR = os.path.join(BASE_DIR, "frontend", "src")
PUBLIC_DIR = os.path.join(BASE_DIR, "frontend", "public")

@app.get("/")
def index():
    return FileResponse(os.path.join(INTERFACE_DIR, "WikiFake.html"))

app.mount("/public", StaticFiles(directory=PUBLIC_DIR), name="public")
app.mount("/", StaticFiles(directory=INTERFACE_DIR), name="static")
