#!/bin/sh
set -eu

BACKUP="${1:-}"
if [ -z "$BACKUP" ] || [ ! -f "$BACKUP" ]; then
  echo "Usage: ./scripts/restore.sh backups/fasttrack-....sqlite3"
  exit 1
fi
case "$BACKUP" in *.sqlite3) ;; *) echo "Expected a .sqlite3 backup file."; exit 1;; esac

ABS_BACKUP="$(cd "$(dirname "$BACKUP")" && pwd)/$(basename "$BACKUP")"

echo "Stopping FastTrack..."
docker compose stop fasttrack

echo "Saving current DB into fasttrack-backups first..."
docker run --rm \
  -v fasttrack-data:/data \
  -v fasttrack-backups:/backups \
  alpine:3.22 sh -eu -c '
    if [ -f /data/fasttrack.db ]; then
      cp /data/fasttrack.db "/backups/pre-restore-$(date +%Y%m%d-%H%M%S).sqlite3"
      chmod 600 /backups/pre-restore-*.sqlite3 2>/dev/null || true
    fi
  '

echo "Restoring $(basename "$ABS_BACKUP")..."
docker run --rm \
  -v fasttrack-data:/data \
  -v "$(dirname "$ABS_BACKUP"):/restore:ro" \
  alpine:3.22 sh -eu -c "
    rm -f /data/fasttrack.db /data/fasttrack.db-wal /data/fasttrack.db-shm
    cp '/restore/$(basename "$ABS_BACKUP")' /data/fasttrack.db
    chown 10001:10001 /data/fasttrack.db
    chmod 600 /data/fasttrack.db
  "

docker compose up -d fasttrack
echo "Restore complete."
