#!/bin/sh
# Starts a local DefraDB node for FinShield development.
# Reads DEFRA_BIN from the environment or the repo .env; falls back to `defradb` on PATH.
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Pull DEFRA_BIN from .env if not already set (expands $HOME/~ in the value)
if [ -z "$DEFRA_BIN" ] && [ -f "$ROOT/.env" ]; then
  RAW=$(grep '^DEFRA_BIN=' "$ROOT/.env" | tail -1 | cut -d= -f2-)
  [ -n "$RAW" ] && DEFRA_BIN=$(eval echo "$RAW")
fi

BIN="${DEFRA_BIN:-defradb}"
if [ ! -x "$BIN" ] && ! command -v "$BIN" >/dev/null 2>&1; then
  echo "defradb binary not found. Set DEFRA_BIN in .env or put defradb on PATH." >&2
  echo "e.g. DEFRA_BIN=\$HOME/Developer/defras/v1.0.0/defradb" >&2
  exit 1
fi
# --no-telemetry: silences OTLP export errors when no local collector is running
exec "$BIN" start --no-keyring --no-telemetry --rootdir "$ROOT/.defra"
