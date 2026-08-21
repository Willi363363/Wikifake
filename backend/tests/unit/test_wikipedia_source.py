"""Extraction de paragraphes : non-regression du bug de duplication.

L'ancien scraper faisait `find_all('p', recursive=False) + find_all('p')`,
ce qui dupliquait chaque paragraphe de premier niveau.
"""

from app.game.wikipedia_source import clean_paragraph_text, extract_paragraphs

LONG = "Un contenu factuel suffisamment long pour passer le filtre de taille. " * 3

HTML = f"""
<html><body><div id="bodyContent">
  <p>{LONG}A</p>
  <div class="section"><p>{LONG}B</p></div>
  <p>Trop court.</p>
  <table class="infobox"><tr><td><p>{LONG}INFOBOX</p></td></tr></table>
  <div class="reflist"><p>{LONG}REF</p></div>
  <p>{LONG}C</p>
</div></body></html>
"""


def test_no_duplicate_paragraphs():
    paragraphs = extract_paragraphs(HTML, min_chars=50)
    assert len(paragraphs) == len(set(paragraphs))
    assert len(paragraphs) == 3


def test_order_is_document_order():
    paragraphs = extract_paragraphs(HTML, min_chars=50)
    assert paragraphs[0].endswith("A")
    assert paragraphs[1].endswith("B")
    assert paragraphs[2].endswith("C")


def test_short_and_boilerplate_paragraphs_are_dropped():
    paragraphs = extract_paragraphs(HTML, min_chars=50)
    joined = " ".join(paragraphs)
    assert "Trop court" not in joined
    assert "INFOBOX" not in joined
    assert "REF" not in joined


def test_min_chars_is_respected():
    assert extract_paragraphs(HTML, min_chars=100_000) == []


def test_clean_paragraph_text():
    assert clean_paragraph_text("Paris [1] est   la capitale .") == "Paris est la capitale."
    assert clean_paragraph_text("a\xa0b") == "a b"
    assert clean_paragraph_text("  espaces  ") == "espaces"


def test_missing_container_falls_back_to_whole_document():
    html = f"<html><body><p>{LONG}Z</p></body></html>"
    assert len(extract_paragraphs(html, min_chars=50)) == 1
