#!/usr/bin/env bash
# Starts ResumeScreen AI locally on http://localhost:8080 (data in ./data).
# Uses Node.js 24+ from PATH; set NODE_BIN to use a specific binary.
set -euo pipefail
cd "$(dirname "$0")"
NODE="${NODE_BIN:-node}"
if ! command -v "$NODE" >/dev/null; then
  echo "Node.js 24+ is required. Install it from https://nodejs.org and run this script again." >&2
  exit 1
fi
[ -d node_modules ] || npm ci
[ -f dist/server/index.js ] || npm run build
echo "Starting ResumeScreen AI on http://localhost:8080 (Ctrl-C to stop)"
DATA_DIR=./data PORT="${PORT:-8080}" exec "$NODE" --env-file-if-exists=.env dist/server/index.js
