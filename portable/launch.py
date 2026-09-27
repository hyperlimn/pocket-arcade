"""Serve the bundled static site on loopback; Python 3 standard library only."""

from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import sys
import webbrowser


SITE = Path(__file__).resolve().parent / "site"
PORT = 8765


class Handler(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map,
                      ".webmanifest": "application/manifest+json"}

    def end_headers(self):
        # Recheck the worker on each launch after an edition is replaced.
        if self.path.split("?", 1)[0] == "/sw.js":
            self.send_header("Cache-Control", "no-cache")
        super().end_headers()


if not (SITE / "index.html").is_file():
    sys.exit("Missing site/index.html. Keep the package together and run launch.py from it.")

try:
    server = ThreadingHTTPServer(("127.0.0.1", PORT), partial(Handler, directory=str(SITE)))
except OSError as error:
    sys.exit(f"Cannot start on 127.0.0.1:{PORT}: {error}")

url = f"http://127.0.0.1:{PORT}/"
print(f"Pocket Arcade: {url}\nPress Ctrl+C to stop.", flush=True)
webbrowser.open(url)
try:
    server.serve_forever()
except KeyboardInterrupt:
    pass
finally:
    server.server_close()
