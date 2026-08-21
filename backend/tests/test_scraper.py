"""Extraction des paragraphes d'une page Wikipedia.

Non-régression : `get_wikipedia_content` concaténait
`find_all('p', recursive=False)` et `find_all('p')`. Le second contenant déjà
les enfants directs, tout paragraphe de premier niveau était collecté deux
fois — doublons dans l'article et index décalés par rapport au document.
"""
from bs4 import BeautifulSoup

from src.core.scraper import (
    clean_paragraph_text,
    collect_content_paragraphs,
    extract_paragraphs,
)

LONG = "Une phrase factuelle assez longue pour passer le filtre de taille. " * 2

HTML = f"""
<div id="bodyContent">
  <p>{LONG}A</p>
  <section><p>{LONG}B</p></section>
  <p>Trop court.</p>
  <p>{LONG}C</p>
</div>
"""


def _container(html: str = HTML):
    return BeautifulSoup(html, "html.parser").find(id="bodyContent")


def test_no_duplicates():
    paragraphs = collect_content_paragraphs(_container())
    texts = [p.get_text(strip=True) for p in paragraphs]
    assert len(texts) == len(set(texts))
    assert len(texts) == 3


def test_document_order_is_preserved():
    texts = [p.get_text(strip=True) for p in collect_content_paragraphs(_container())]
    assert [t[-1] for t in texts] == ["A", "B", "C"]


def test_nested_paragraphs_are_collected_once():
    html = f'<div id="bodyContent"><p>{LONG}A</p><div><p>{LONG}A</p></div></div>'
    # Deux balises, un seul texte : Wikipedia sert parfois le même paragraphe
    # en variante mobile/desktop.
    assert len(collect_content_paragraphs(_container(html))) == 1


def test_short_paragraphs_are_dropped():
    texts = [p.get_text(strip=True) for p in collect_content_paragraphs(_container())]
    assert all("Trop court" not in t for t in texts)


def test_extract_paragraphs_keeps_index_alignment():
    """`extract_paragraphs()[i]` doit toujours correspondre à
    `raw_paragraphs[i]` : `positions` s'appuie sur cette parité."""
    raw = collect_content_paragraphs(_container())
    extracted = extract_paragraphs({"raw_paragraphs": raw})
    assert len(extracted) == len(raw)
    assert extracted[1].endswith("B")


def test_extract_paragraphs_without_data():
    assert extract_paragraphs({}) == []


# --- Non-régression : plus d'effet de bord sur la soup -----------------------

def test_extract_paragraphs_does_not_touch_the_document():
    """`extract_paragraphs` réécrivait chaque `tag.string` pour insérer des
    espaces, modifiant la soup que l'appelant réutilise ensuite pour produire
    le HTML de l'article."""
    soup = BeautifulSoup(
        f'<div id="bodyContent"><p>{LONG}<b>gras</b> suite</p></div>', "html.parser"
    )
    raw = collect_content_paragraphs(soup.find(id="bodyContent"))
    before = str(soup)

    extract_paragraphs({"raw_paragraphs": raw})

    assert str(soup) == before


def test_inline_tags_do_not_glue_words():
    soup = BeautifulSoup(
        '<div id="bodyContent"><p>' + LONG + 'un<b>deux</b>trois</p></div>', "html.parser"
    )
    raw = collect_content_paragraphs(soup.find(id="bodyContent"))
    text = extract_paragraphs({"raw_paragraphs": raw})[0]
    assert "un deux trois" in text
    assert "undeuxtrois" not in text


def test_punctuation_stays_attached():
    soup = BeautifulSoup(
        '<div id="bodyContent"><p>' + LONG + 'Paris <b>1889</b> .</p></div>', "html.parser"
    )
    raw = collect_content_paragraphs(soup.find(id="bodyContent"))
    text = extract_paragraphs({"raw_paragraphs": raw})[0]
    assert "1889." in text


def test_clean_paragraph_text():
    assert clean_paragraph_text("Paris   est   la capitale .") == "Paris est la capitale."
    assert clean_paragraph_text("a\xa0b") == "a b"
    assert clean_paragraph_text("  bords  ") == "bords"
