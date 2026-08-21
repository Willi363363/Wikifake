"""Compteurs d'usage du modèle.

Chaque partie consomme des appels au modèle, donc de l'argent. Sans mesure,
impossible de savoir si un modèle publicitaire tient : le seul calcul qui
compte est `revenu_par_partie` contre `coût_par_partie`, et le second était
invisible.

Ces compteurs sont en mémoire et remis à zéro au redémarrage : ils servent à
mesurer un ordre de grandeur, pas à faire de la comptabilité. Ils sont exposés
par `GET /api/usage`.
"""
import threading
from dataclasses import asdict, dataclass, field

from src.log import get_logger

log = get_logger(__name__)


@dataclass
class Counter:
    """Compteurs d'un type d'appel (choix de sujet, falsification…)."""
    calls: int = 0
    failures: int = 0
    prompt_chars: int = 0
    output_chars: int = 0
    input_tokens: int = 0
    output_tokens: int = 0


@dataclass
class Usage:
    """Agrégat global, par type d'appel."""
    games_generated: int = 0
    games_served_from_cache: int = 0
    by_kind: dict[str, Counter] = field(default_factory=dict)

    def kind(self, name: str) -> Counter:
        return self.by_kind.setdefault(name, Counter())


_lock = threading.Lock()
_usage = Usage()


def record_call(kind: str, prompt: str, output: str, usage_metadata: dict | None = None,
                failed: bool = False) -> None:
    """Enregistre un appel au modèle.

    `usage_metadata` vient de la réponse du modèle quand elle l'expose ; sinon
    on retombe sur le nombre de caractères, qui reste un proxy utilisable pour
    comparer des ordres de grandeur.
    """
    with _lock:
        counter = _usage.kind(kind)
        counter.calls += 1
        if failed:
            counter.failures += 1
        counter.prompt_chars += len(prompt or "")
        counter.output_chars += len(output or "")
        if usage_metadata:
            counter.input_tokens += int(usage_metadata.get("input_tokens", 0) or 0)
            counter.output_tokens += int(usage_metadata.get("output_tokens", 0) or 0)


def record_game(from_cache: bool) -> None:
    with _lock:
        if from_cache:
            _usage.games_served_from_cache += 1
        else:
            _usage.games_generated += 1


def snapshot() -> dict:
    """Vue lisible, avec le coût moyen par partie réellement générée."""
    with _lock:
        data = asdict(_usage)
        generated = _usage.games_generated
        total_in = sum(c.input_tokens for c in _usage.by_kind.values())
        total_out = sum(c.output_tokens for c in _usage.by_kind.values())
        total_calls = sum(c.calls for c in _usage.by_kind.values())
        served = generated + _usage.games_served_from_cache

    data["totals"] = {
        "llm_calls": total_calls,
        "input_tokens": total_in,
        "output_tokens": total_out,
    }
    data["per_generated_game"] = {
        "llm_calls": round(total_calls / generated, 2) if generated else 0,
        "input_tokens": round(total_in / generated, 1) if generated else 0,
        "output_tokens": round(total_out / generated, 1) if generated else 0,
    }
    data["cache_hit_rate"] = (
        round(_usage.games_served_from_cache / served, 3) if served else 0
    )
    return data


def reset() -> None:
    """Remise à zéro (tests)."""
    global _usage
    with _lock:
        _usage = Usage()
