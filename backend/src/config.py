"""Centralized configuration constants for the WikiFake backend."""
from __future__ import annotations

from typing import Any

# ── Game timing ──────────────────────────────────────────────────────────
GAME_DURATION: int = 300  # 5 minutes

# ── Item distribution ────────────────────────────────────────────────────
MAX_ITEM_ROUNDS: int = 9
ITEM_INTERVAL_SECONDS: int = 30

# ── Player colors ────────────────────────────────────────────────────────
AVAILABLE_COLORS: list[str] = [
    "#e63946", "#f4a261", "#2a9d8f", "#264653",
    "#8338ec", "#ff006e", "#3a0ca3", "#fb5607",
]

# ── Fallback themes (used when voting yields no results) ─────────────────
FALLBACK_THEMES: list[str] = [
    "Paris", "Chat", "Chocolat", "Football", "Soleil",
    "Lune", "Château", "Pizza", "Japon", "Cinéma",
]

# ── Game items ───────────────────────────────────────────────────────────
ITEMS: list[dict[str, Any]] = [
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
