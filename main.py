#!/usr/bin/env python3
"""Lanceur de developpement.

Usage : `python main.py` (ou `make run`). En production, preferez :
    uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port 8000
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent / "backend"
sys.path.insert(0, str(BACKEND_DIR))


def main() -> None:
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=os.getenv("WIKIFAKE_HOST", "0.0.0.0"),
        port=int(os.getenv("WIKIFAKE_PORT", "8000")),
        reload=os.getenv("WIKIFAKE_RELOAD", "1") == "1",
        reload_dirs=[str(BACKEND_DIR)],
        app_dir=str(BACKEND_DIR),
    )


if __name__ == "__main__":
    main()
