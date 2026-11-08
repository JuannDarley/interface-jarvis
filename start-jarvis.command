#!/bin/bash
cd "$(dirname "$0")"
export HOST="${HOST:-127.0.0.1}"

if [ -z "$GROQ_API_KEY" ]; then
  echo "Informe sua chave da Groq (necessária para conversar):"
  read -s GROQ_API_KEY
  echo
  export GROQ_API_KEY
fi

if [ -z "$FISH_API_KEY" ]; then
  echo "Informe sua chave do Fish Audio (necessária para voz):"
  read -s FISH_API_KEY
  echo
  export FISH_API_KEY
fi

python3 server.py
