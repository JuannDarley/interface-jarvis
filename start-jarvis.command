#!/bin/bash
set -e

INTERFACE_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$INTERFACE_DIR/../jarvis" && pwd)"
FACE_FRONTEND_DIR="$(cd "$INTERFACE_DIR/../face-unlock-frontend" && pwd)"
FACE_API_DIR="$(cd "$INTERFACE_DIR/../face-unlock" && pwd)"
FACE_PYTHON="$FACE_API_DIR/.venv/bin/python"

echo "=========================================================="
echo "          INICIALIZANDO ECOSSISTEMA JARVIS 2.0            "
echo "=========================================================="

if [ ! -x "$PROJECT_DIR/mvnw" ]; then
  echo "❌ Não encontrei o backend Java em: $PROJECT_DIR"
  exit 1
fi
if [ ! -x "$FACE_PYTHON" ]; then
  echo "❌ Não encontrei o ambiente Python da API facial em: $FACE_API_DIR/.venv"
  exit 1
fi

FACE_API_PID=""
if curl -fsS --max-time 2 http://127.0.0.1:8000/health >/dev/null 2>&1; then
  echo "✓ Reconhecimento facial já está ativo em http://127.0.0.1:8000"
else
  echo "→ Iniciando API de Reconhecimento Facial (Python na porta 8000)..."
  (cd "$FACE_API_DIR" && "$FACE_PYTHON" -m uvicorn face_unlock.api:app --host 127.0.0.1 --port 8000 >/dev/null 2>&1) &
  FACE_API_PID=$!

  # Aguarda a API facial ficar pronta
  for i in {1..30}; do
    if curl -fsS --max-time 1 http://127.0.0.1:8000/health >/dev/null 2>&1; then
      echo "✓ Reconhecimento facial pronto!"
      break
    fi
    sleep 0.5
  done
fi

cleanup() {
  echo ""
  echo "Encerrando serviços..."
  if [ -n "$FACE_API_PID" ]; then
    kill "$FACE_API_PID" 2>/dev/null || true
    echo "✓ Servidor de reconhecimento facial encerrado."
  fi
}
trap cleanup EXIT INT TERM

export JARVIS_FRONTEND_PATH="$INTERFACE_DIR"
export JARVIS_FRONTEND_ENABLED=true
export JARVIS_FACE_FRONTEND_PATH="$FACE_FRONTEND_DIR"
export JARVIS_FACE_ENABLED=true
export FACE_UNLOCK_API_URL="http://127.0.0.1:8000"

# Monitor em segundo plano para abrir o navegador assim que o JARVIS subir
(
  for i in {1..40}; do
    if curl -fsS --max-time 1 http://127.0.0.1:8080/health >/dev/null 2>&1; then
      sleep 0.5
      echo ""
      echo "=========================================================="
      echo "  JARVIS ONLINE! Acessando http://localhost:8080         "
      echo "=========================================================="
      open "http://localhost:8080"
      break
    fi
    sleep 1
  done
) &

echo "→ Iniciando Backend JARVIS (Spring Boot na porta 8080)..."
zsh -ic 'cd "$1" && ./mvnw spring-boot:run' jarvis "$PROJECT_DIR"
