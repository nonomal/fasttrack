# Migrating to FastTrack v2.2

## Back up the old data volume first

```bash
docker run --rm \
  -v fasttrack-data:/data:ro \
  -v "$(pwd)":/backup \
  alpine:3.22 \
  tar czf /backup/fasttrack-pre-v22-volume.tar.gz -C /data .
```

## Start v2.2

```bash
mkdir -p backups
docker compose down
docker compose up -d --build
docker compose logs -f fasttrack
```

FastTrack checks `/data/app_data/users.json`. If legacy JSON exists and the new database contains no accounts, the migration imports:

- users;
- completed fasts;
- bodyweight;
- supplements;
- health profiles;
- active timers.

A copy of the old JSON tree is saved under `/data/migration-backups/` and the original JSON is left intact.

## Legacy passwords

Older releases used bcrypt, while this standalone v2.2 repository intentionally has no external runtime dependencies and uses Node's built-in scrypt.

A migrated user whose password hash begins with the old bcrypt format must reset their password:

```bash
docker compose exec \
  -e NEW_PASSWORD='a-long-unique-password' \
  fasttrack \
  node backend/scripts/reset-password.js USERNAME
```

This preserves the user's fasting, weight, supplement and profile data.

## Verify

```bash
curl http://localhost:3004/health
docker compose exec fasttrack ls -lh /data/fasttrack.db
ls -lh backups/
```

Then log into the same account from two computers and confirm that server data and appearance preferences match.
