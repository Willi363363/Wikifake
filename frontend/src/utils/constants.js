export const GAME_DURATION = 300; // 5 minutes

export const ITEM_DEFS = {
  BLUR: { icon: "👁", name: "Brouillard", description: "Floute l'écran d'un joueur 5s", color: "#6b4e6f" },
  FREEZE_TIME: { icon: "⏸", name: "Gel du temps", description: "Retire 10s au chrono d'un joueur", color: "#1f3a5f" },
  SCORE_STEAL: { icon: "⚡", name: "Pillage", description: "Vole 50 pts à un joueur", color: "#8c6d36" },
  HINT_LOCK: { icon: "🔒", name: "Brouilleur", description: "Bloque les hints 20s", color: "#27272a" },
  BLACKOUT: { icon: "⬛", name: "Censure CIA", description: "Censure le texte d'un joueur 5s", color: "#18181b" },
  EARTHQUAKE: { icon: "🌋", name: "Séisme", description: "Fait trembler l'écran 5s", color: "#a64b48" },
  RICKROLL: { icon: "🤡", name: "Pop-up Spam", description: "Affiche un pop-up gênant", color: "#b58f3a" },
  SCANNER: { icon: "🔎", name: "Détecteur", description: "Surligne un paragraphe suspect", color: "#4a7a52", targetCount: 0 },
  MIRROR: { icon: "🪞", name: "Miroir", description: "Inverse le texte de l'article 6s", color: "#4a6b8c" },
  TINY: { icon: "🔬", name: "Loupe cassée", description: "Rend le texte minuscule 8s", color: "#7a5248" },
  SPIN: { icon: "🌀", name: "Tournis", description: "Fait tourner l'article 4s", color: "#4a6b8c" },
  CONFETTI: { icon: "🎊", name: "Fête surprise", description: "Explosion de confettis 6s", color: "#8c6d36" },
  INVERT: { icon: "🌑", name: "Négatif", description: "Inverse les couleurs 5s", color: "#27272a" },
};

export const TWEAK_DEFAULTS = {
  "mode": "normal",
  "difficulty": "medium",
  "multiplayer": true,
  "gameState": "playing",
  "showCursors": true,
  "accent": "teal",
  "sessionId": "A2-F1K9"
};

export const ACCENTS = {
  teal: { primary: "#1f574d", hover: "#174841", soft: "#e8f0ed", line: "rgba(31, 87, 77, 0.18)" },
  navy: { primary: "#1f3a5f", hover: "#162d4a", soft: "#e6ecf3", line: "rgba(31, 58, 95, 0.18)" },
  bronze: { primary: "#8c6d36", hover: "#735829", soft: "#f4ecdb", line: "rgba(140, 109, 54, 0.20)" },
  aubergine: { primary: "#6b4e6f", hover: "#553e58", soft: "#efe9f0", line: "rgba(107, 78, 111, 0.20)" },
  graphite: { primary: "#27272a", hover: "#18181b", soft: "#ececec", line: "rgba(39, 39, 42, 0.18)" },
};
