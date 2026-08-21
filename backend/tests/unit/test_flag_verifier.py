"""Normalisation des verdicts de signalement."""

from unittest.mock import patch

from app.flags.models import FlagRecord, FlagReport
from app.flags.verifier import FALLBACK_VERDICT, verify


def _report() -> FlagReport:
    return FlagReport(
        flagged_claim="La tour Eiffel mesure 1000 metres.",
        proposed_correction="Elle mesure 330 metres.",
    )


@patch("app.flags.verifier.run_json_chain", return_value=None)
def test_llm_failure_falls_back(_mock):
    assert verify(_report(), "") == FALLBACK_VERDICT


@patch(
    "app.flags.verifier.run_json_chain",
    return_value={
        "verdict": "n_importe_quoi",
        "confidence": 500,
        "reasoning": "  ok  ",
        "sources_found": ["a", "b", "c", "d"],
        "recommendation": "invalide",
    },
)
def test_invalid_fields_are_normalised(_mock):
    result = verify(_report(), "contexte")
    assert result["verdict"] == "uncertain"
    assert result["confidence"] == 100
    assert result["reasoning"] == "ok"
    assert result["sources_found"] == ["a", "b", "c"]
    assert result["recommendation"] == "needs_more_info"


@patch(
    "app.flags.verifier.run_json_chain",
    return_value={
        "verdict": "likely_valid",
        "confidence": 88,
        "reasoning": "La source confirme.",
        "sources_found": ["extrait"],
        "recommendation": "approve_for_review",
    },
)
def test_valid_verdict_passes_through(_mock):
    result = verify(_report(), "contexte")
    assert result["verdict"] == "likely_valid"
    assert result["confidence"] == 88


def test_timestamp_is_timezone_aware():
    stamp = FlagRecord.now_iso()
    assert stamp.endswith("+00:00")
