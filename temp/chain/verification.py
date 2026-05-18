def check_answer(user_answers: list, correct_positions: list) -> dict:
    """
    Vérifie les réponses de l'utilisateur.
    
    Args:
        user_answers: Liste des indices des paragraphes que l'utilisateur pense contenir des fausses infos
        correct_positions: Liste des positions réelles des fausses infos
        
    Returns:
        Un dictionnaire avec le score et les détails
    """
    correct_indices = [pos["paragraph_index"] for pos in correct_positions]
    
    correct_found = []
    false_positives = []
    missed = []
    
    for answer in user_answers:
        if answer in correct_indices:
            correct_found.append(answer)
        else:
            false_positives.append(answer)
    
    for idx in correct_indices:
        if idx not in user_answers:
            missed.append(idx)
    
    total_correct = len(correct_found)
    total_target = len(correct_positions)
    
    score = (total_correct / total_target * 100) if total_target > 0 else 0
    
    return {
        "correct_found": correct_found,
        "false_positives": false_positives,
        "missed": missed,
        "score": score,
        "total_correct": total_correct,
        "total_target": total_target
    }


def get_feedback(check_result: dict, positions: list) -> str:
    """
    Génère un feedback détaillé sur les réponses.
    
    Args:
        check_result: Le résultat de la vérification
        positions: Les positions avec les détails des fausses infos
        
    Returns:
        Un string avec le feedback
    """
    feedback = f"\n📊 Résultats: {check_result['total_correct']}/{check_result['total_target']} trouvées (Score: {check_result['score']:.0f}%)\n"
    
    if check_result['correct_found']:
        feedback += f"\n✅ Bien joué ! Vous avez identifié {len(check_result['correct_found'])} fausse(s) information(s)"
    
    if check_result['false_positives']:
        feedback += f"\n❌ Attention: Vous avez marqué {len(check_result['false_positives'])} paragraphe(s) qui n'était (n')pas faux"
    
    if check_result['missed']:
        feedback += f"\n⚠️  Vous avez manqué {len(check_result['missed'])} fausse(s) information(s)"
        for pos in positions:
            if pos['paragraph_index'] in check_result['missed']:
                feedback += f"\n   • Paragraphe {pos['paragraph_index']}: \"{pos['false_statement'][:80]}...\""
    
    return feedback
