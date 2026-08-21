"""Service du frontend construit (`frontend/dist`).

Ne monte plus les sources : seul le bundle Vite est expose (§6.4). Si le
build n'existe pas, une page d'aide explicite est servie au lieu d'un 404
incomprehensible.
"""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles

from ..config import get_settings
from ..logging_config import get_logger

log = get_logger(__name__)

_MISSING_BUILD_PAGE = """<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><title>WikiFake — build manquant</title>
<style>
 body{font:15px/1.6 system-ui,sans-serif;background:#f6f4ef;color:#18181b;
      display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0}
 main{max-width:560px;padding:36px;background:#fff;border:1px solid #e4e4e7;border-radius:16px}
 h1{font-size:20px;margin:0 0 12px} code{background:#f4f4f5;padding:2px 6px;border-radius:4px}
 pre{background:#18181b;color:#fafafa;padding:14px 16px;border-radius:10px;overflow-x:auto}
</style></head>
<body><main>
<h1>Le frontend n'est pas encore construit</h1>
<p>Le serveur tourne, mais <code>frontend/dist</code> est absent. Construisez
l'interface :</p>
<pre>make frontend-build   # ou : cd frontend &amp;&amp; npm install &amp;&amp; npm run build</pre>
<p>Pour developper avec rechargement a chaud :</p>
<pre>make dev              # backend + serveur Vite</pre>
</main></body></html>
"""


def mount_frontend(app: FastAPI) -> None:
    dist = get_settings().paths.frontend_dist
    index = dist / "index.html"

    if not index.exists():
        log.warning("Frontend non construit (%s absent) — page d'aide servie", index)

        @app.get("/", include_in_schema=False)
        def missing_build() -> HTMLResponse:
            return HTMLResponse(_MISSING_BUILD_PAGE, status_code=503)

        return

    # Monte APRES les routes API : le catch-all ne peut donc pas les masquer.
    # `html=True` sert index.html a la racine et sur les repertoires ; une URL
    # inexistante renvoie bien un 404 (l'interface n'utilise pas de routeur
    # cote client, il n'y a donc pas de route profonde a rattraper).
    app.mount("/", StaticFiles(directory=str(dist), html=True), name="frontend")
    log.info("Frontend servi depuis %s", dist)
