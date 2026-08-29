#!/bin/sh
set -eu

if [ ! -f .fasttrack-last-good ]; then
  echo "No .fasttrack-last-good commit was recorded."
  exit 1
fi

TARGET="$(cat .fasttrack-last-good)"

if [ -n "$(git status --porcelain)" ]; then
  echo "Rollback stopped: the Git working tree has uncommitted changes."
  exit 1
fi

echo "Rolling source back to $TARGET ..."
git reset --hard "$TARGET"

docker compose build
docker compose up -d --remove-orphans

echo "Source rollback complete."
echo "If the database itself also needs restoring, choose a verified file in ./backups"
echo "and run: ./scripts/restore.sh backups/<filename>.sqlite3"
