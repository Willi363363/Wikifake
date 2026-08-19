import os
import re

components_dir = "frontend/src/components"
for f in os.listdir(components_dir):
    if not f.endswith(".jsx"):
        continue
    filepath = os.path.join(components_dir, f)
    with open(filepath, "r") as file:
        content = file.read()
    
    # Add imports
    if "import React" not in content:
        content = "import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';\n" + content
        
    # Naively export all functions that start with a capital letter (React components)
    content = re.sub(r"^function ([A-Z][a-zA-Z0-9_]*)", r"export function \1", content, flags=re.MULTILINE)
    
    with open(filepath, "w") as file:
        file.write(content)
print("Fixed components")
