"""Serve the built Vite frontend (frontend/dist).

The dist folder only exists after `npm run build`, so a fresh clone (or CI
without a node toolchain) would otherwise crash at startup when StaticFiles
validates its directory. In that case we mount nothing and serve a small
placeholder page instead — its <title> still starts with "Wikifake" so the
smoke test on GET / stays green.
"""
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles

# backend/src/api/static_files.py -> repo root, independent of the process cwd
_REPO_ROOT = Path(__file__).resolve().parents[3]
DIST_DIR = _REPO_ROOT / "frontend" / "dist"

_MISSING_BUILD_PAGE = """<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Wikifake — build du frontend manquant</title>
</head>
<body>
  <h1>Wikifake</h1>
  <p>Le frontend n'a pas encore été compilé (<code>frontend/dist/</code> est absent).</p>
  <p>Lancez <code>npm ci &amp;&amp; npm run build</code> dans <code>frontend/</code> puis redémarrez le serveur.</p>
</body>
</html>"""


def mount_static(app: FastAPI) -> None:
    """Register GET / and the static mount on `app`.

    Must be called AFTER the API routers are included: the catch-all mount on
    "/" would otherwise shadow every route registered later.
    """
    index_file = DIST_DIR / "index.html"

    if index_file.is_file():
        @app.get("/")
        def index():
            return FileResponse(index_file)

        app.mount("/", StaticFiles(directory=DIST_DIR), name="static")
    else:
        @app.get("/")
        def index():
            return HTMLResponse(_MISSING_BUILD_PAGE)
