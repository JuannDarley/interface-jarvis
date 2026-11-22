#!/bin/bash
set -e

INTERFACE_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$INTERFACE_DIR/../jarvis" && pwd)"
# The normal launcher opens the native app. Web development is explicit opt-in.
if [ "${1:-}" != "--web-dev" ]; then
  APP_PATH="${JARVIS_DESKTOP_APP_PATH:-$PROJECT_DIR/desktop/dist/mac-arm64/JARVIS.app}"
  APP_BINARY="$APP_PATH/Contents/MacOS/JARVIS"
  if [ ! -x "$APP_BINARY" ]; then
    echo "Não encontrei o aplicativo JARVIS atualizado. Gere ou abra a versão macOS do projeto."
    exit 1
  fi
  echo "Abrindo o aplicativo JARVIS. Ctrl+C encerra esta sessão e libera a câmera."
  exec "$APP_BINARY"
fi

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

# Detecta uma instância existente antes de iniciar qualquer serviço.
if lsof -nP -iTCP:8080 -sTCP:LISTEN >/dev/null 2>&1; then
  if curl -fsS --max-time 3 http://127.0.0.1:8080/api/status 2>/dev/null |
      grep -Eq '"aplicacao"[[:space:]]*:[[:space:]]*"JARVIS"'; then
    echo "✓ JARVIS já está ativo. Abrindo http://localhost:8080"
    open "http://localhost:8080"
    exit 0
  fi
  echo "❌ A porta 8080 está ocupada por um serviço que não foi identificado como JARVIS."
  echo "Encerre esse serviço e execute o inicializador novamente."
  exit 1
fi

FACE_API_PID=""
BROWSER_MONITOR_PID=""
BACKEND_PID=""
CLEANED_UP=false

# Signal only the process trees belonging to this launch, never all Python processes.
stop_tree() {
  local target="$1" child
  [ -n "$target" ] || return 0
  for child in $(pgrep -P "$target" 2>/dev/null || true); do
    stop_tree "$child"
  done
  kill -TERM "$target" 2>/dev/null || true
}
cleanup() {
  [ "$CLEANED_UP" = false ] || return 0
  CLEANED_UP=true
  trap '' INT TERM
  echo ""
  echo "Encerrando Jarvis e liberando a câmera..."
  for target in "$BROWSER_MONITOR_PID" "$BACKEND_PID" "$FACE_API_PID"; do
    stop_tree "$target"
  done
  # Uvicorn receives SIGTERM, runs its lifespan cleanup and calls camera.release().
  for i in {1..50}; do
    [ -n "$FACE_API_PID" ] && kill -0 "$FACE_API_PID" 2>/dev/null || break
    sleep 0.1
  done
  if [ -n "$FACE_API_PID" ]; then
    kill -KILL "$FACE_API_PID" 2>/dev/null || true
    wait "$FACE_API_PID" 2>/dev/null || true
  fi
  echo "✓ Reconhecimento facial encerrado; câmera liberada."
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

if curl -fsS --max-time 2 http://127.0.0.1:8000/health >/dev/null 2>&1; then
  existing_pid=$(lsof -t -nP -iTCP:8000 -sTCP:LISTEN | head -1)
  if ps -p "$existing_pid" -o command= | grep -Fq 'uvicorn face_unlock.api:app'; then
    FACE_API_PID="$existing_pid"
    echo "✓ API facial existente vinculada a esta sessão; será encerrada ao sair."
  else
    echo "❌ A porta 8000 está ocupada por outro serviço."
    exit 1
  fi
else
  echo "→ Iniciando API de Reconhecimento Facial (Python na porta 8000)..."
  (cd "$FACE_API_DIR" && exec "$FACE_PYTHON" -m uvicorn face_unlock.api:app --host 127.0.0.1 --port 8000 >/dev/null 2>&1) &
  FACE_API_PID=$!
  FACE_READY=false
  for i in {1..30}; do
    if curl -fsS --max-time 1 http://127.0.0.1:8000/health >/dev/null 2>&1; then
      FACE_READY=true
      echo "✓ Reconhecimento facial pronto!"
      break
    fi
    kill -0 "$FACE_API_PID" 2>/dev/null || break
    sleep 0.5
  done
  if [ "$FACE_READY" != true ]; then
    echo "❌ A API facial não iniciou. Encerrando os serviços desta sessão."
    exit 1
  fi
fi

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
BROWSER_MONITOR_PID=$!

echo "→ Iniciando Backend JARVIS (Spring Boot na porta 8080)..."
zsh -ic 'cd "$1" && exec ./mvnw spring-boot:run' jarvis "$PROJECT_DIR" &
BACKEND_PID=$!
wait "$BACKEND_PID"
