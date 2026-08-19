import os
import re

components_dir = "frontend/src/components"
for f in os.listdir(components_dir):
    if not f.endswith(".jsx"):
        continue
    filepath = os.path.join(components_dir, f)
    with open(filepath, "r") as file:
        content = file.read()
    
    # Remove const { ... } = React;
    content = re.sub(r"^const\s+\{([^}]+)\}\s*=\s*React;\n?", "", content, flags=re.MULTILINE)
    
    with open(filepath, "w") as file:
        file.write(content)
print("Removed React destructuring")
