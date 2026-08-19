"""Uvicorn entrypoint. Everything real lives under `src/`."""
from src.app import create_app
from src.realtime.room import rooms   # re-exported: the tests reach into the registry

app = create_app()
