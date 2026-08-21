"""Point d'entree de l'application FastAPI.

Ne contient que le cablage : configuration, cycle de vie, routes, frontend.
Toute la logique vit dans `app/game`, `app/rooms`, `app/ws`, `app/flags`.
"""

from __future__ import annotations

from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI

from . import __version__
from .config import get_settings
from .logging_config import get_logger, setup_logging


def create_app() -> FastAPI:
    load_dotenv()
    settings = get_settings()
    setup_logging(settings.log_level)
    log = get_logger(__name__)

    # Imports apres setup_logging pour que les modules recuperent le bon niveau.
    from .api import router
    from .api.static_files import mount_frontend
    from .rooms.items import catalogue
    from .rooms.store import get_room_store

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        store = get_room_store()
        store.start_reaper()
        log.info(
            "WikiFake %s demarre — %d items, LLM %s",
            __version__,
            len(catalogue()),
            "configure" if settings.llm_available else "NON configure",
        )
        if not settings.llm_available:
            log.warning(
                "OPENAI_API_KEY absente : la generation de parties echouera. "
                "Renseignez-la dans .env."
            )
        yield
        await store.stop_reaper()
        log.info("Arret propre")

    app = FastAPI(
        title="WikiFake",
        version=__version__,
        description="Jeu de detection de fausses informations dans des articles Wikipedia.",
        lifespan=lifespan,
    )

    app.include_router(router)
    # Monte en dernier : le catch-all SPA ne doit jamais masquer les routes API.
    mount_frontend(app)
    return app


app = create_app()
