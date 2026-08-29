#!/bin/sh
set -eu

docker compose exec -T fasttrack node /app/backend/scripts/backup-now.js

echo "Backup is stored in Docker volume: fasttrack-backups"
echo "Run ./scripts/export-backups.sh to copy backups into ./backups on this host."
