"""Item catalog and the periodic distribution loop."""
import asyncio
import random

from .broadcast import broadcast
from .room import rooms

# Points retirés par SCORE_STEAL. Défini ici, à côté de la description de
# l'item qui l'annonce ("Vole 50 pts à un joueur").
STEAL_AMOUNT = 50

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


async def item_distribution_loop(room_code: str) -> None:
    """Distributes one random item to each player every 30 seconds (up to 9 times).

    Sleeps FIRST so the opening 30 seconds of a round stay item-free, then
    bails out silently if the room disappeared or the round already ended.
    """
    try:
        for minute in range(1, 10):
            await asyncio.sleep(30)
            if room_code not in rooms or rooms[room_code].state != "playing":
                break
            room = rooms[room_code]
            distribution = {}
            for pname in list(room.players.keys()):
                item = random.choice(ITEMS)
                instance = {**item, "instance_id": f"{pname}_{minute}_{item['id']}"}
                room.players[pname].items.append(instance)
                distribution[pname] = instance
            await broadcast(room_code, {
                "type": "items_distributed",
                "minute": minute,
                "items": distribution,
            })
    except asyncio.CancelledError:
        pass
