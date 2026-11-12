#!/bin/bash
set -e

INTERFACE_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$INTERFACE_DIR/../jarvis" && pwd)"
FACE_FRONTEND_DIR="$(cd "$INTERFACE_DIR/../face-unlock-frontend" && pwd)"
FACE_API_DIR="$(cd "$INTERFACE_DIR/../face-unlock" && pwd)"
FACE_PYTHON="$FACE_API_DIR/.venv/bin/python"

if [ ! -x "$PROJECT_DIR/mvnw" ]; then
  echo "Não encontrei o backend Java em: $PROJECT_DIR"
  exit 1
fi
if [ ! -x "$FACE_PYTHON" ]; then
  echo "Não encontrei o ambiente Python da API facial em: $FACE_API_DIR/.venv"
  exit 1
fi

FACE_API_PID=""
if ! curl -fsS --max-time 2 http://127.0.0.1:8000/health >/dev/null 2>&1; then
  cd "$FACE_API_DIR"
  "$FACE_PYTHON" -m uvicorn face_unlock.api:app --host 127.0.0.1 --port 8000 &
  FACE_API_PID=$!
fi

cleanup() {
  if [ -n "$FACE_API_PID" ]; then
    kill "$FACE_API_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

export JARVIS_FRONTEND_PATH="$INTERFACE_DIR"
export JARVIS_FRONTEND_ENABLED=true
export JARVIS_FACE_FRONTEND_PATH="$FACE_FRONTEND_DIR"
export JARVIS_FACE_ENABLED=true
export FACE_UNLOCK_API_URL="http://127.0.0.1:8000"

zsh -ic 'cd "$1" && ./mvnw spring-boot:run' jarvis "$PROJECT_DIR"
