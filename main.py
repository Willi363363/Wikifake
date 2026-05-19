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

# Import logic
from src.backend.core.agent import FakeNewsGame
from src.backend.core.verification import check_answer

load_dotenv()
app = FastAPI()
game = FakeNewsGame()

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
@app.post("/api/multiplayer/create")
def create_room():
    code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
    rooms[code] = {
        "players": {},
        "game_data": None,
        "state": "waiting",
        "start_time": 0
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
                        "players": list(room["players"].keys())
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
                            
            elif data["type"] == "submit_answer" and room["state"] == "playing":
                indices = data.get("answers", [])
                hints_used = data.get("hintsUsed", 0)
                hint_penalty = data.get("hintPenalty", 0)
                time_taken = time.time() - room["start_time"]
                
                # Score logic
                result = check_answer(indices, room["game_data"]["positions"])
                tp = len(result["correct_found"])
                fp = len(result["false_positives"])
                
                time_remaining = max(0, 180 - time_taken)
                time_bonus = int(time_remaining * 0.5)
                
                base_score = tp * 150
                fp_penalty = fp * 80
                
                score = base_score - fp_penalty - hint_penalty + time_bonus
                
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
