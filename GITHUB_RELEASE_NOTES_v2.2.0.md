# FastTrack v2.2.0

FastTrack v2.2 is the largest application update so far: fasting, bodyweight, health profiles, a 276-item supplement catalog, 26 themes, 10 layouts, secure multi-user server sessions, SQLite persistence and verified backups are now packaged as one complete standalone repository.

## New in v2.2

### Comprehensive supplement tracker
- 276 searchable vitamin/supplement types.
- Broad categories covering vitamins, minerals, herbs, amino acids, antioxidants, gut health, proteins, sports supplements, omega oils, mushrooms, sleep, longevity and more.
- Product, brand, form, dose, unit, time and notes.
- Custom Supplement fallback.
- Quick-log recent supplements.
- Searchable supplement history.

### Appearance
- 26 themes.
- 10 layouts.
- Preferences saved to the user's account and synced across computers.

### Persistence
- SQLite database at `/data/fasttrack.db`.
- Legacy JSON migration.
- Automatic verified SQLite backups.
- Import/export and fasting CSV export.

### Security
- Long-password scrypt hashing.
- HttpOnly server-side session cookies.
- Session hashes stored in SQLite instead of reusable browser tokens.
- Login throttling.
- Cross-site write protection.
- Admin safety controls.
- Read-only/non-root Docker runtime.

### Deployment
- One Dockerfile.
- One compose file.
- No runtime npm dependencies.
- No frontend build step.
- amd64/arm64 GitHub Actions container build.

See README.md for the complete installation and user guide.
