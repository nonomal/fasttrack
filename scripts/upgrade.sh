#!/bin/sh
set -eu

if [ -n "$(git status --porcelain)" ]; then
  echo "Upgrade stopped: the Git working tree has uncommitted changes."
  echo "Commit or stash them first so rollback is safe."
  exit 1
fi

OLD_COMMIT="$(git rev-parse HEAD)"
printf '%s\n' "$OLD_COMMIT" > .fasttrack-last-good

echo "Creating verified backup before upgrade..."
./scripts/backup-now.sh

echo "Pulling repository updates..."
git pull --ff-only

echo "Rebuilding FastTrack..."
docker compose build --pull

echo "Starting upgraded container..."
docker compose up -d --remove-orphans

echo "Waiting for health check..."
i=0
while [ "$i" -lt 30 ]; do
  STATUS="$(docker inspect --format='{{.State.Health.Status}}' fasttrack 2>/dev/null || true)"
  if [ "$STATUS" = "healthy" ]; then
    echo "FastTrack upgrade completed successfully."
    exit 0
  fi
  if [ "$STATUS" = "unhealthy" ]; then
    break
  fi
  i=$((i + 1))
  sleep 2
done

echo "Upgrade health check failed."
echo "Run: ./scripts/rollback.sh"
exit 1
