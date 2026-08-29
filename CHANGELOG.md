# Changelog

## 2.2.0

### Supplements
- Added a 276-item searchable vitamin/supplement catalog across broad supplement categories.
- Added category filtering and Custom Supplement fallback.
- Added product/name, brand, form, quantity, unit, exact date/time and notes.
- Added quick-log from recent supplements.
- Added today's supplement count and searchable history.
- Expanded SQLite supplement records with category, supplement type, brand and form.

### Complete standalone repository
- Consolidated FastTrack into one dependency-free Node 24 server plus static browser UI.
- Removed the requirement for a React/Tailwind production build step.
- Removed runtime npm dependencies.
- Added complete repository files suitable for clean GitHub upload.

## 2.1.0

### Appearance
- Replaced unreliable dynamic theme classes with a CSS-variable theme engine.
- Added 26 themes including System, OLED, Nord, Dracula, Solarized, Gruvbox and Monokai.
- Added 10 application layouts including Sidebar, Bottom Dock, Focus, Wide, Dense and Zen.
- Added SQLite-backed account appearance preferences so theme/layout follow the user to another computer.

## 2.0.0

### Persistence and deployment
- Replaced per-user JSON as the primary storage layer with SQLite.
- Added one-time legacy JSON import.
- Added verified automatic SQLite backups.
- Consolidated deployment into one Dockerfile and one docker-compose.yml.
- Added upgrade, rollback and restore workflows.
- Added GitHub Actions multi-architecture container builds.

### Security
- Removed the old browser localStorage JWT authentication model.
- Added opaque HttpOnly server-side sessions.
- Removed default `admin/admin123` behavior.
- Removed profile-field privilege escalation.
- Added stronger password policy, login throttling and cross-site request protections.
- Added stricter browser security headers and non-root container execution.
