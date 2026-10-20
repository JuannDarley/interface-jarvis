#!/usr/bin/env python3

import json
import mimetypes
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse, unquote
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

mimetypes.init()

HOST = "0.0.0.0"
PORT = int(os.getenv("PORT", "8080"))

# =========================
# FISH AUDIO
# =========================

FISH_TTS_URL = "https://api.fish.audio/v1/tts"
FISH_MODEL = "s2.1-pro-free"
FISH_REFERENCE_ID = "d9a100f6d45f43dea41bd0c160d7e578"

# =========================
# GROQ
# =========================

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "openai/gpt-oss-120b"

# =========================
# ARQUIVOS
# =========================

BASE_DIR = Path(__file__).resolve().parent
INDEX_FILE = BASE_DIR / "index.html"


class JarvisServer(BaseHTTPRequestHandler):

    def _send_json(self, status, data):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")

        self.send_response(status)
        self.send_header(
            "Content-Type",
            "application/json; charset=utf-8"
        )
        self.send_header(
            "Content-Length",
            str(len(body))
        )
        self.send_header(
            "Access-Control-Allow-Origin",
            "*"
        )
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
        self.send_header(
            "Access-Control-Allow-Methods",
            "GET, POST, OPTIONS"
        )
        self.send_header(
            "Access-Control-Allow-Headers",
            "Content-Type"
        )
        self.end_headers()

    # =========================
    # GET
    # =========================

    @staticmethod
    def _get_content_type(file_path: Path) -> str:
        suffix = file_path.suffix.lower()
        custom_types = {
            ".css": "text/css; charset=utf-8",
            ".js": "application/javascript; charset=utf-8",
            ".mjs": "application/javascript; charset=utf-8",
            ".json": "application/json; charset=utf-8",
            ".html": "text/html; charset=utf-8",
            ".svg": "image/svg+xml",
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".gif": "image/gif",
            ".webp": "image/webp",
            ".ico": "image/x-icon",
            ".woff": "font/woff",
            ".woff2": "font/woff2",
            ".ttf": "font/ttf",
            ".otf": "font/otf",
            ".mp3": "audio/mpeg",
            ".wav": "audio/wav",
            ".txt": "text/plain; charset=utf-8",
        }
        if suffix in custom_types:
            return custom_types[suffix]

        guessed, _ = mimetypes.guess_type(str(file_path))
        if guessed:
            if guessed.startswith("text/"):
                return f"{guessed}; charset=utf-8"
            return guessed
        return "application/octet-stream"

    def serve_static_file(self, url_path: str):
        rel_path = url_path.lstrip("/")
        if not rel_path:
            self._send_json(404, {"error": "Arquivo não encontrado."})
            return

        try:
            target_file = (BASE_DIR / rel_path).resolve()
            relative_target = target_file.relative_to(BASE_DIR)
        except (ValueError, RuntimeError):
            self._send_json(403, {"error": "Acesso negado: fora do diretório permitido."})
            return

        # Bloqueio de arquivos e diretórios ocultos (.git, .env, etc.) e extensões restritas
        if any(part.startswith(".") for part in relative_target.parts) or \
           target_file.suffix in (".py", ".env", ".command", ".sh") or \
           ".bak" in target_file.name:
            self._send_json(403, {"error": "Acesso proibido."})
            return

        if not target_file.is_file():
            self._send_json(404, {"error": "Arquivo não encontrado."})
            return

        try:
            content_type = self._get_content_type(target_file)
            content = target_file.read_bytes()
            self._send_bytes(200, content_type, content)
        except Exception as exc:
            self._send_json(500, {"error": f"Erro ao ler arquivo estático: {str(exc)}"})

    def do_GET(self):
        url_path = unquote(urlparse(self.path).path)

        # Página principal
        if url_path in ("/", "/index.html"):
            try:
                self._send_bytes(
                    200,
                    "text/html; charset=utf-8",
                    INDEX_FILE.read_bytes()
                )
            except Exception as exc:
                self._send_json(
                    500,
                    {"error": str(exc)}
                )
            return

        # Health check
        if url_path == "/health":
            self._send_json(
                200,
                {"status": "ok"}
            )
            return

        # Arquivos estáticos (suporte a /css/, /js/, /assets/ e arquivos gerais do projeto)
        self.serve_static_file(url_path)

    # =========================
    # POST
    # =========================

    def do_POST(self):

        path = urlparse(self.path).path

        # =========================
        # GROQ / CHAT
        # =========================

        if path == "/api/chat":
            self.handle_chat()
            return

        # =========================
        # FISH AUDIO / TTS
        # =========================

        if path == "/api/tts":
            self.handle_tts()
            return

        self._send_json(
            404,
            {"error": "Rota não encontrada."}
        )

    # =========================
    # GROQ
    # =========================

    def handle_chat(self):

        api_key = os.getenv("GROQ_API_KEY", "").strip()

        if not api_key:
            self._send_json(
                500,
                {
                    "error": "GROQ_API_KEY não configurada."
                }
            )
            return

        # Ler corpo da requisição
        try:
            content_length = int(
                self.headers.get("Content-Length", "0")
            )

            raw_body = self.rfile.read(content_length)

            payload = json.loads(
                raw_body.decode("utf-8")
            )

        except Exception:
            self._send_json(
                400,
                {
                    "error": "JSON inválido."
                }
            )
            return

        # Mensagem enviada pelo navegador
        message = str(
            payload.get("message", "")
        ).strip()

        if not message:
            self._send_json(
                400,
                {
                    "error": "O campo 'message' é obrigatório."
                }
            )
            return

        # Prompt do JARVIS
        groq_payload = {
            "model": GROQ_MODEL,
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "Você é JARVIS, um assistente pessoal "
                        "inspirado no assistente do Homem de Ferro. "
                        "Responda em português do Brasil. "
                        "Seja inteligente, direto, educado e natural. "
                        "Não diga que você é o ChatGPT."
                    )
                },
                {
                    "role": "user",
                    "content": message[:10000]
                }
            ],
            "temperature": 0.7,
            "max_tokens": 1000
        }

        request = Request(
            GROQ_API_URL,
            data=json.dumps(
                groq_payload
            ).encode("utf-8"),
            method="POST",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "User-Agent": "JARVIS/1.0"
            }
        )

        try:

            with urlopen(
                request,
                timeout=60
            ) as response:

                response_body = response.read()

            groq_response = json.loads(
                response_body.decode("utf-8")
            )

            # Extrair resposta da Groq
            answer = (
                groq_response
                .get("choices", [{}])[0]
                .get("message", {})
                .get("content", "")
            )

            if not answer:
                self._send_json(
                    502,
                    {
                        "error": "A Groq não retornou uma resposta."
                    }
                )
                return

            self._send_json(
                200,
                {
                    "response": answer
                }
            )

        except HTTPError as exc:

            details = exc.read().decode(
                "utf-8",
                errors="replace"
            )

            self._send_json(
                exc.code,
                {
                    "error": "A Groq retornou um erro.",
                    "details": details
                }
            )

        except URLError as exc:

            self._send_json(
                502,
                {
                    "error": "Não foi possível conectar à Groq.",
                    "details": str(exc.reason)
                }
            )

        except Exception as exc:

            self._send_json(
                500,
                {
                    "error": "Erro interno no servidor.",
                    "details": str(exc)
                }
            )

    # =========================
    # FISH AUDIO
    # =========================

    def handle_tts(self):

        api_key = os.getenv(
            "FISH_API_KEY",
            ""
        ).strip()

        if not api_key:

            self._send_json(
                500,
                {
                    "error": "FISH_API_KEY não configurada."
                }
            )

            return

        try:

            content_length = int(
                self.headers.get(
                    "Content-Length",
                    "0"
                )
            )

            payload = json.loads(
                self.rfile
                .read(content_length)
                .decode("utf-8")
            )

            text = str(
                payload.get("text", "")
            ).strip()

        except Exception:

            self._send_json(
                400,
                {
                    "error": "JSON inválido."
                }
            )

            return

        if not text:

            self._send_json(
                400,
                {
                    "error": "O campo 'text' é obrigatório."
                }
            )

            return

        fish_payload = {
            "text": text[:5000],
            "reference_id": FISH_REFERENCE_ID,
            "format": "mp3"
        }

        request = Request(
            FISH_TTS_URL,
            data=json.dumps(
                fish_payload
            ).encode("utf-8"),
            method="POST",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "model": FISH_MODEL,
                "User-Agent": "Jarvis-Local-TTS/1.0"
            }
        )

        try:

            with urlopen(
                request,
                timeout=60
            ) as response:

                audio = response.read()

            self._send_bytes(
                200,
                "audio/mpeg",
                audio
            )

        except HTTPError as exc:

            details = exc.read().decode(
                "utf-8",
                errors="replace"
            )

            self._send_json(
                exc.code,
                {
                    "error": "Fish Audio retornou um erro.",
                    "details": details
                }
            )

        except URLError as exc:

            self._send_json(
                502,
                {
                    "error": "Não foi possível conectar ao Fish Audio.",
                    "details": str(exc.reason)
                }
            )

        except Exception as exc:

            self._send_json(
                500,
                {
                    "error": "Erro interno no servidor TTS.",
                    "details": str(exc)
                }
            )


# =========================
# SERVIDOR
# =========================

def main():

    print()
    print("========================================")
    print("       JARVIS - SERVIDOR LOCAL")
    print("========================================")
    print(f"URL: http://localhost:{PORT}")
    print("Chat: Groq")
    print(f"Modelo: {GROQ_MODEL}")
    print("TTS: Fish Audio")
    print(f"Voz: {FISH_REFERENCE_ID}")
    print("========================================")
    print()

    server = ThreadingHTTPServer(
        (HOST, PORT),
        JarvisServer
    )

    try:

        server.serve_forever()

    except KeyboardInterrupt:

        print("\nServidor encerrado.")

    finally:

        server.server_close()


if __name__ == "__main__":
    main()