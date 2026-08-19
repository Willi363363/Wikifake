import os
import re

filepath = "frontend/src/data/article-data.jsx"
with open(filepath, "r") as file:
    content = file.read()

# Add exports to consts
content = re.sub(r"^const (WIKIFAKE_[A-Z_]+)", r"export const \1", content, flags=re.MULTILINE)

with open(filepath, "w") as file:
    file.write(content)
print("Fixed data")
