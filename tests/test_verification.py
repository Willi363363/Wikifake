import pytest
from src.backend.core.verification import check_answer, get_feedback

def test_check_answer_perfect_score():
    user_answers = [1, 3]
    correct_positions = [
        {"paragraph_index": 1, "false_statement": "A"},
        {"paragraph_index": 3, "false_statement": "B"}
    ]
    result = check_answer(user_answers, correct_positions)
    assert result["score"] == 100
    assert result["total_correct"] == 2
    assert result["total_target"] == 2
    assert len(result["false_positives"]) == 0
    assert len(result["missed"]) == 0

def test_check_answer_partial_score():
    user_answers = [1]
    correct_positions = [
        {"paragraph_index": 1, "false_statement": "A"},
        {"paragraph_index": 3, "false_statement": "B"}
    ]
    result = check_answer(user_answers, correct_positions)
    assert result["score"] == 50
    assert result["total_correct"] == 1
    assert result["total_target"] == 2
    assert result["missed"] == [3]

def test_check_answer_false_positives():
    user_answers = [1, 2, 4]
    correct_positions = [
        {"paragraph_index": 1, "false_statement": "A"},
        {"paragraph_index": 3, "false_statement": "B"}
    ]
    result = check_answer(user_answers, correct_positions)
    assert result["score"] == 50
    assert result["total_correct"] == 1
    assert result["false_positives"] == [2, 4]
    assert result["missed"] == [3]

def test_check_answer_zero_target():
    user_answers = [1]
    correct_positions = []
    result = check_answer(user_answers, correct_positions)
    assert result["score"] == 0
    assert result["false_positives"] == [1]

def test_get_feedback_all_found():
    result = {
        "correct_found": [1],
        "false_positives": [],
        "missed": [],
        "score": 100,
        "total_correct": 1,
        "total_target": 1
    }
    positions = [{"paragraph_index": 1, "false_statement": "A"}]
    feedback = get_feedback(result, positions)
    assert "100%" in feedback
    assert "Bien joué" in feedback
    assert "Attention" not in feedback

def test_get_feedback_missed_and_false_positive():
    result = {
        "correct_found": [],
        "false_positives": [2],
        "missed": [1],
        "score": 0,
        "total_correct": 0,
        "total_target": 1
    }
    positions = [{"paragraph_index": 1, "false_statement": "This is a very long statement that should be printed in the feedback"}]
    feedback = get_feedback(result, positions)
    assert "0%" in feedback
    assert "Attention" in feedback
    assert "manqué" in feedback
    assert "This is a very long statement" in feedback
