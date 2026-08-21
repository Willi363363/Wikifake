"""Limitation de debit minimaliste, en memoire.

Protege les routes qui declenchent des appels LLM payants (§6.5). Suffisant
pour un deploiement mono-process ; a remplacer par Redis si le service est
repliqué.
"""

from __future__ import annotations

import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request, status

from ..config import get_settings
from ..logging_config import get_logger

log = get_logger(__name__)

_HITS: dict[str, deque[float]] = defaultdict(deque)


def reset() -> None:
    _HITS.clear()


def _client_key(request: Request, bucket: str) -> str:
    host = request.client.host if request.client else "unknown"
    return f"{bucket}:{host}"


def rate_limiter(bucket: str):
    """Fabrique une dependance FastAPI pour un compartiment donne."""

    async def dependency(request: Request) -> None:
        cfg = get_settings().rate_limit
        if not cfg.enabled:
            return
        key = _client_key(request, bucket)
        now = time.time()
        hits = _HITS[key]
        while hits and now - hits[0] > cfg.window_s:
            hits.popleft()
        if len(hits) >= cfg.max_calls:
            retry_after = int(cfg.window_s - (now - hits[0])) + 1
            log.warning("Debit depasse pour %s", key)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Trop de requetes, patientez un instant.",
                headers={"Retry-After": str(retry_after)},
            )
        hits.append(now)

    return dependency
