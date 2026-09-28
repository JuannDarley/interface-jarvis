#!/bin/bash
cd "$(dirname "$0")"

if [ -z "$FISH_API_KEY" ]; then
  echo "Informe sua chave da Fish Audio:"
  read -s FISH_API_KEY
  echo
  export FISH_API_KEY
fi

python3 server.py
