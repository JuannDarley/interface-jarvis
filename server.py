#!/usr/bin/env python3

import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

HOST = "127.0.0.1"
PORT = 8080
FISH_TTS_URL = "https://api.fish.audio/v1/tts"
FISH_MODEL = "s2.1-pro-free"
FISH_REFERENCE_ID = "d9a100f6d45f43dea41bd0c160d7e578"

BASE_DIR = Path(__file__).resolve().parent
INDEX_FILE = BASE_DIR / "index.html"


class JarvisServer(BaseHTTPRequestHandler):

    def _send_json(self, status, data):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def _send_bytes(self, status, content_type, data):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        path = urlparse(self.path).path

        if path in ("/", "/index.html"):
            try:
                self._send_bytes(200, "text/html; charset=utf-8", INDEX_FILE.read_bytes())
            except Exception as exc:
                self._send_json(500, {"error": str(exc)})
            return

        if path == "/health":
            self._send_json(200, {"status": "ok"})
            return

        self._send_json(404, {"error": "Rota não encontrada."})

    def do_POST(self):
        if urlparse(self.path).path != "/api/tts":
            self._send_json(404, {"error": "Rota não encontrada."})
            return

        api_key = os.getenv("FISH_API_KEY", "").strip()
        if not api_key:
            self._send_json(500, {
                "error": "FISH_API_KEY não configurada."
            })
            return

        try:
            content_length = int(self.headers.get("Content-Length", "0"))
            payload = json.loads(self.rfile.read(content_length).decode("utf-8"))
            text = str(payload.get("text", "")).strip()
        except Exception:
            self._send_json(400, {"error": "JSON inválido."})
            return

        if not text:
            self._send_json(400, {"error": "O campo 'text' é obrigatório."})
            return

        fish_payload = {
            "text": text[:5000],
            "reference_id": FISH_REFERENCE_ID,
            "format": "mp3"
        }

        request = Request(
            FISH_TTS_URL,
            data=json.dumps(fish_payload).encode("utf-8"),
            method="POST",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "model": FISH_MODEL,
                "User-Agent": "Jarvis-Local-TTS/1.0"
            }
        )

        try:
            with urlopen(request, timeout=60) as response:
                audio = response.read()

            self._send_bytes(200, "audio/mpeg", audio)

        except HTTPError as exc:
            details = exc.read().decode("utf-8", errors="replace")
            self._send_json(exc.code, {
                "error": "Fish Audio retornou um erro.",
                "details": details
            })

        except URLError as exc:
            self._send_json(502, {
                "error": "Não foi possível conectar ao Fish Audio.",
                "details": str(exc.reason)
            })

        except Exception as exc:
            self._send_json(500, {
                "error": "Erro interno no servidor TTS.",
                "details": str(exc)
            })


def main():
    print()
    print("========================================")
    print("       JARVIS - SERVIDOR LOCAL")
    print("========================================")
    print(f"URL: http://localhost:{PORT}")
    print("TTS: Fish Audio")
    print(f"Voz: {FISH_REFERENCE_ID}")
    print("========================================")
    print()

    server = ThreadingHTTPServer((HOST, PORT), JarvisServer)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor encerrado.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
