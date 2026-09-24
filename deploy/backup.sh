#!/usr/bin/env bash
# Creates a consistent online backup of the database and copies it to ./backups on the host.
set -euo pipefail
cd "$(dirname "$0")/.."
STAMP=$(date +%Y-%m-%dT%H-%M)
docker compose exec -T app node dist/server/backup.js "/app/data/backups/resumescreen-${STAMP}.db"
mkdir -p backups
docker compose cp "app:/app/data/backups/resumescreen-${STAMP}.db" "backups/resumescreen-${STAMP}.db"
chmod 600 "backups/resumescreen-${STAMP}.db"
echo "Saved backups/resumescreen-${STAMP}.db"
