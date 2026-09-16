#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BIN="$ROOT/bin"
export SYSLAB_BIN="$BIN"
export SYSLAB_ADDR="${SYSLAB_ADDR:-:8080}"
export SYSLAB_CORS="${SYSLAB_CORS:-http://localhost:5174}"

make -C "$ROOT" build-experiments build-agent web-install

cleanup() {
  if [[ -n "${AGENT_PID:-}" ]]; then
    kill "$AGENT_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

"$BIN/agent" &
AGENT_PID=$!
sleep 0.3
if ! kill -0 "$AGENT_PID" 2>/dev/null; then
  echo "agent failed to start; see prior logs" >&2
  exit 1
fi
echo "agent pid=$AGENT_PID on $SYSLAB_ADDR"
echo "web  → http://localhost:5174"
cd "$ROOT/apps/web" && npm run dev
