from __future__ import annotations

import threading
import tempfile
import webbrowser
from functools import partial
from http.server import SimpleHTTPRequestHandler
from pathlib import Path
from socketserver import ThreadingTCPServer

from .html_render import render_wiki_page

_ACTIVE_SERVERS: list[ThreadingTCPServer] = []


def build_game_html(game_data: dict) -> str:
    """Retourne directement le HTML généré."""
    return game_data["html"]


def write_game_html(game_data: dict, output_dir: str | None = None) -> Path:
    base_dir = Path(output_dir) if output_dir else Path(tempfile.gettempdir()) / "fake_news_hunter"
    base_dir.mkdir(parents=True, exist_ok=True)

    safe_topic = "".join(character.lower() if character.isalnum() else "-" for character in game_data["topic"]).strip("-")
    html_path = base_dir / f"{safe_topic or 'article'}-fake-wikipedia.html"
    html_path.write_text(build_game_html(game_data), encoding="utf-8")
    return html_path


class QuietHTTPRequestHandler(SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass
    
    def log_request(self, code='-', size='-'):
        pass
    
    def log_error(self, format, *args):
        pass

def _start_local_server(directory: Path) -> tuple[ThreadingTCPServer, int]:
    handler = partial(QuietHTTPRequestHandler, directory=str(directory))
    server = ThreadingTCPServer(("127.0.0.1", 0), handler)
    server.daemon_threads = True

    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    _ACTIVE_SERVERS.append(server)
    return server, server.server_address[1]


def open_game_html(game_data: dict) -> Path:
    html_path = write_game_html(game_data)
    server, port = _start_local_server(html_path.parent)
    page_url = f"http://127.0.0.1:{port}/{html_path.name}"
    webbrowser.open_new_tab(page_url)
    return html_path