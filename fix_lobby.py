import os
import re

filepath = "frontend/src/components/lobby.jsx"
with open(filepath, "r") as file:
    content = file.read()

# Add imports if not exist
if "import { WaitingScreen" not in content:
    content = "import { WaitingScreen } from './waiting-screen.jsx';\nimport { LobbyChat } from './chat.jsx';\n" + content

# Replace window.WaitingScreen with WaitingScreen
content = content.replace("<window.WaitingScreen", "<WaitingScreen")
content = content.replace("<window.LobbyChat", "<LobbyChat")

# Remove window.Lobby = Lobby
content = content.replace("window.Lobby = Lobby;", "")

with open(filepath, "w") as file:
    file.write(content)

ws_filepath = "frontend/src/components/waiting-screen.jsx"
with open(ws_filepath, "r") as file:
    ws_content = file.read()
ws_content = ws_content.replace("window.WaitingScreen = WaitingScreen;", "")
with open(ws_filepath, "w") as file:
    file.write(ws_content)

print("Fixed components")
