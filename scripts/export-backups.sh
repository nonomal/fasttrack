#!/bin/sh
set -eu

DEST="${1:-./backups}"
mkdir -p "$DEST"
ABS_DEST="$(cd "$DEST" && pwd)"
UID_NOW="$(id -u)"
GID_NOW="$(id -g)"

docker run --rm \
  -v fasttrack-backups:/source:ro \
  -v "$ABS_DEST:/dest" \
  alpine:3.22 sh -eu -c "cp -a /source/. /dest/; chown -R $UID_NOW:$GID_NOW /dest"

echo "Backups copied to: $ABS_DEST"
