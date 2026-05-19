import os
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from dotenv import load_dotenv

# Import logic
from src.backend.core.agent import FakeNewsGame

load_dotenv()
app = FastAPI()
game = FakeNewsGame()

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

# Serve the static files from the interface directory
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
INTERFACE_DIR = os.path.join(BASE_DIR, "src", "frontend")

@app.get("/")
def index():
    return FileResponse(os.path.join(INTERFACE_DIR, "WikiFake.html"))

app.mount("/", StaticFiles(directory=INTERFACE_DIR), name="static")

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
