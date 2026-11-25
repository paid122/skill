#!/bin/bash
# AUREUS QUANT launcher for macOS. Double-click (or: bash start_mac.command).
cd "$(dirname "$0")" || exit 1
PY=""
for c in python3.13 python3.12 python3.11 python3.10 python3; do
  if command -v "$c" >/dev/null 2>&1 && "$c" -c 'import sys; sys.exit(0 if sys.version_info >= (3,10) else 1)' 2>/dev/null; then PY="$c"; break; fi
done
if [ -z "$PY" ]; then
  echo "Python 3.10 or newer is required. Install it from https://www.python.org/downloads/macos/ then run this again."
  read -r -p "Press Enter to close."; exit 1
fi
if [ ! -d .venv ]; then
  echo "First run: creating a private Python environment (one-time, ~2 minutes)..."
  "$PY" -m venv .venv || exit 1
fi
source .venv/bin/activate
python -m pip install -q --upgrade pip
python -m pip install -q -r requirements.txt || { echo "Package install failed."; read -r -p "Press Enter to close."; exit 1; }
PORT=${PORT:-8001}
echo ""
echo "AUREUS QUANT is starting on http://localhost:$PORT  — keep this window open (close it to stop)."
( sleep 3; open "http://localhost:$PORT" ) &
python -m uvicorn aureus.api.app:app --port "$PORT"
