"""Modeles de donnees d'une partie.

Une seule convention d'indexation dans tout le projet :
`Paragraph.index` est **1-base** et sert d'identifiant unique de paragraphe,
du backend jusqu'au clic du joueur. Il n'y a plus aucune conversion
0-base/1-base implicite nulle part.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class Fake:
    """Une fausse information injectee dans un paragraphe."""

    paragraph_index: int  # 1-base, correspond a Paragraph.index
    original_text: str
    text: str  # le paragraphe modifie
    explanation: str
    hint: str

    def to_public_dict(self) -> dict:
        """Vue envoyee au client (identique pour tous les joueurs)."""
        return {
            "paragraph_index": self.paragraph_index,
            "text": self.text,
            "explanation": self.explanation,
            "hint": self.hint,
        }


@dataclass(frozen=True)
class Paragraph:
    """Un paragraphe d'article, potentiellement falsifie."""

    index: int  # 1-base
    text: str
    is_fake: bool = False

    def to_public_dict(self) -> dict:
        # `is_fake` n'est PAS envoye au client : ce serait la solution du jeu.
        return {"index": self.index, "text": self.text}


@dataclass(frozen=True)
class SourceArticle:
    """Article Wikipedia brut, avant falsification."""

    title: str
    url: str
    paragraphs: list[str]  # textes nettoyes, ordre d'apparition


@dataclass(frozen=True)
class GameData:
    """Etat immuable d'une partie generee."""

    topic: str
    wikipedia_url: str
    paragraphs: list[Paragraph]
    fakes: list[Fake] = field(default_factory=list)

    @property
    def total_fakes(self) -> int:
        return len(self.fakes)

    @property
    def fake_indices(self) -> set[int]:
        """Indices 1-base des paragraphes reellement falsifies."""
        return {f.paragraph_index for f in self.fakes}

    def to_public_dict(self) -> dict:
        """Payload envoye au client AU DEMARRAGE.

        Ne contient NI les indices des paragraphes falsifies, NI les
        explications, NI les indices textuels : la solution ne quitte le
        serveur qu'a la fin de la partie (`solution()`) ou a la demande
        explicite d'un indice (qui coute des points).
        """
        return {
            "topic": self.topic,
            "wikipedia_url": self.wikipedia_url,
            "paragraphs": [p.to_public_dict() for p in self.paragraphs],
            "total_fakes": self.total_fakes,
        }

    def solution(self) -> list[dict]:
        """Correction complete, envoyee uniquement en fin de partie."""
        return [
            fake.to_public_dict() for fake in sorted(self.fakes, key=lambda f: f.paragraph_index)
        ]
