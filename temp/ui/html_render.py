"""Rendu HTML fidèle à Wikipédia pour le jeu de fausses informations."""

import html
import re


def render_wiki_page(game_data: dict) -> str:
    """Génère une page HTML avec le design de Wikipédia."""
    title = html.escape(game_data["topic"])
    summary = html.escape(game_data.get("summary", ""))
    source_url = html.escape(game_data.get("wikipedia_url", ""))
    content = game_data.get("content", "")
    paragraphs = [p.strip() for p in content.split("\n\n") if p.strip()]
    false_positions = {pos["paragraph_index"]: pos for pos in game_data.get("positions", [])}
    false_count = game_data.get("total_false_statements", len(false_positions))

    # Construire les paragraphes
    paragraphs_html = ""
    for index, paragraph in enumerate(paragraphs):
        text = html.escape(paragraph).replace("\n", "<br>")
        is_false = index in false_positions
        
        if is_false:
            # Marquer visiblement les fausses infos
            # Remplacer [FAUSSE INFO X] par une version surlignée
            text = re.sub(
                r'\[FAUSSE INFO\s+\d+\]',
                lambda m: f'<mark style="background-color: #fff3bf; color: #c33; padding: 2px 4px; font-weight: bold;">{m.group(0)}</mark>',
                text
            )
        
        paragraphs_html += f"        <p>{text}</p>\n"

    # Construire la sidebar avec les fausses infos
    false_infos_html = ""
    for idx, pos in enumerate(game_data.get("positions", []), 1):
        false_text = html.escape(pos['false_statement'][:100])
        false_infos_html += f"""        <li style="margin-bottom: 0.5em; padding: 0.5em; background-color: #f8f9fa; border-left: 3px solid #d04a2f;">
          <strong>#{idx} (para {pos['paragraph_index'] + 1}):</strong><br>
          <small>{false_text}...</small>
        </li>
"""

    return f"""<!DOCTYPE html>
<html lang="fr" dir="ltr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title} — Wikipédia</title>
    <style>
        * {{ margin: 0; padding: 0; border: 0; font-family: inherit; }}
        html {{ font-size: 100%; line-height: 1.6; }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
            background-color: #f8f9fa;
            color: #202122;
        }}
        a {{ color: #0645ad; text-decoration: none; }}
        a:visited {{ color: #0b0080; }}
        a:hover {{ text-decoration: underline; }}
        
        .mw-page {{ max-width: 100%; margin: 0; padding: 0; }}
        .mw-header {{
            background-color: #fff;
            border-bottom: 1px solid #a2a9b1;
            padding: 8px 20px;
        }}
        .mw-header-row {{
            max-width: 1320px;
            margin: 0 auto;
            display: flex;
            align-items: center;
            gap: 12px;
        }}
        .mw-logo {{
            font-size: 28px;
            font-weight: 600;
            color: #0645ad;
            line-height: 1;
        }}
        .mw-branding h1 {{
            font-size: 16px;
            margin: 0;
            font-weight: 600;
            color: #0645ad;
        }}
        .mw-branding p {{
            font-size: 11px;
            margin: 2px 0 0 0;
            color: #54595d;
        }}
        
        .mw-container {{
            max-width: 1320px;
            margin: 16px auto;
            padding: 0 20px;
            display: grid;
            grid-template-columns: 1fr 280px;
            gap: 20px;
        }}
        
        .mw-body {{
            background-color: #fff;
            border: 1px solid #a2a9b1;
            border-radius: 2px;
            padding: 20px;
        }}
        
        .mw-body h1 {{
            font-size: 1.8em;
            font-weight: 600;
            margin: 0 0 0.25em 0;
            border-bottom: 1px solid #a2a9b1;
            padding-bottom: 0.25em;
            line-height: 1.3;
        }}
        
        .mw-body h2 {{
            font-size: 1.3em;
            font-weight: 600;
            margin: 0.8em 0 0.25em 0;
            border-bottom: 1px solid #a2a9b1;
            padding-bottom: 0.25em;
        }}
        
        .mw-body p {{
            margin: 0.5em 0;
            line-height: 1.6;
            text-align: justify;
        }}
        
        .mw-body p:first-of-type {{
            font-style: italic;
            color: #54595d;
        }}
        
        .game-info {{
            background-color: #fff3bf;
            border: 1px solid #f0c36d;
            border-radius: 2px;
            padding: 12px;
            margin: 1em 0;
        }}
        .game-info h3 {{
            margin: 0 0 0.5em 0;
            font-weight: 600;
        }}
        .game-info ul {{
            margin: 0;
            padding-left: 1.5em;
        }}
        .game-info li {{ margin: 0.25em 0; }}
        
        .toc {{
            background-color: #f8f9fa;
            border: 1px solid #a2a9b1;
            border-radius: 2px;
            padding: 8px;
            margin: 12px 0 12px 12px;
            float: right;
            max-width: 250px;
        }}
        .toc h2 {{
            font-size: 1em;
            border: none;
            margin: 0 0 0.5em 0;
            padding: 0;
        }}
        .toc ul {{
            list-style: none;
            padding: 0;
            margin: 0;
        }}
        .toc li {{
            margin: 0.25em 0;
            padding-left: 1em;
        }}
        
        .mw-sidebar {{
            background-color: #fff;
            border: 1px solid #a2a9b1;
            border-radius: 2px;
            padding: 12px;
            position: sticky;
            top: 12px;
            height: fit-content;
            font-size: 0.9em;
        }}
        
        .mw-sidebar h2 {{
            font-size: 1.05em;
            font-weight: 600;
            border-bottom: 1px solid #a2a9b1;
            padding-bottom: 0.25em;
            margin: 0.75em 0 0.5em 0;
        }}
        .mw-sidebar h2:first-child {{
            margin-top: 0;
        }}
        
        .mw-sidebar ul {{
            list-style: none;
            padding: 0;
            margin: 0;
        }}
        
        .mw-sidebar li {{
            margin-bottom: 0.25em;
        }}
        
        .stat-box {{
            background-color: #f8f9fa;
            border: 1px solid #a2a9b1;
            border-radius: 2px;
            padding: 8px;
            margin: 0.5em 0;
        }}
        
        mark {{
            background-color: transparent;
        }}
        
        @media (max-width: 900px) {{
            .mw-container {{ grid-template-columns: 1fr; }}
            .mw-sidebar {{ position: static; }}
            .toc {{ float: none; max-width: 100%; }}
        }}
    </style>
</head>
<body>
    <div class="mw-page">
        <header class="mw-header">
            <div class="mw-header-row">
                <div class="mw-logo">W</div>
                <div class="mw-branding">
                    <h1>Wikipédia</h1>
                    <p>L'encyclopédie libre</p>
                </div>
            </div>
        </header>
        
        <div class="mw-container">
            <main class="mw-body">
                <h1>{title}</h1>
                
                <div class="game-info">
                    <h3>🎮 Jeu de détection de fausses informations</h3>
                    <ul>
                        <li>Cet article contient <strong>{false_count}</strong> fausse(s) affirmation(s)</li>
                        <li>Cherchez les <mark style="background: #fff3bf;">textes surlignés</mark></li>
                        <li>Reportez les numéros des paragraphes suspects</li>
                    </ul>
                </div>
                
                <div class="toc">
                    <h2>Sommaire</h2>
                    <ul>
                        <li><a href="#content">Contenu</a></li>
                    </ul>
                </div>
                
                <p>{summary}</p>
                
                <div id="content">
{paragraphs_html}
                </div>
            </main>
            
            <aside class="mw-sidebar">
                <h2>Infos</h2>
                <div class="stat-box">
                    <strong>Paragraphes:</strong> {len(paragraphs)}
                </div>
                <div class="stat-box">
                    <strong>Fausses infos:</strong> {false_count}
                </div>
                
                <h2>Fausses infos</h2>
                <ul>
{false_infos_html}
                </ul>
                
                <h2>Source</h2>
                <p><a href="{source_url}" target="_blank" rel="noreferrer">Article original Wikipédia</a></p>
            </aside>
        </div>
    </div>
</body>
</html>"""
