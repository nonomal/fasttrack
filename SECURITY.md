# FastTrack Security

FastTrack v2.2 is designed for self-hosted use. No internet-facing authentication system can truthfully be called bulletproof, but the current architecture removes the highest-risk weaknesses present in early FastTrack versions.

## Authentication

- Passwords are hashed with Node's built-in `crypto.scrypt()` and a unique random salt.
- Password minimum is 15 characters.
- Session identifiers are random 256-bit values.
- The browser receives the session only in an HttpOnly cookie.
- Session tokens are not placed in `localStorage`.
- SQLite stores only SHA-256 hashes of session tokens.
- Default session lifetime is 12 hours.
- Password changes revoke all sessions.
- Users can explicitly sign out all devices.

## Authorization

- User-data APIs always use the authenticated session user ID; clients cannot choose another user's ID.
- Profile updates cannot set `isAdmin`, roles, permissions or password hashes.
- Username/email changes require the current password.
- Admin actions require an administrator session.
- Administrators cannot delete themselves from the admin panel.
- Administrators cannot demote the final administrator.

## Login protection

- Failed-login attempts are throttled.
- Failed authentication uses randomized delay.
- Unknown users still perform a scrypt calculation to reduce simple timing differences.

## Browser request protections

- SameSite=Strict session cookies.
- Secure `__Host-` session cookie when HTTPS is detected.
- Cross-site mutating requests are rejected.
- CSP restricts scripts, frames, objects, form actions and network connections.
- Clickjacking is blocked with `X-Frame-Options: DENY` and CSP `frame-ancestors 'none'`.
- MIME sniffing is disabled.
- Referrer and browser permissions policies are restrictive.

## Container protections

- Application runs as an unprivileged user.
- Docker root filesystem is read-only.
- `no-new-privileges` is enabled.
- Writable state is isolated to the database volume, backup mount and tmpfs.

## Database and backups

- SQLite foreign keys are enabled.
- WAL journaling is enabled.
- `trusted_schema` is disabled.
- Backup files are created using SQLite's backup API.
- Backups are verified with `PRAGMA quick_check` before acceptance.

## HTTPS

Use HTTPS for any untrusted/public network deployment. A reverse proxy should pass `X-Forwarded-Proto: https` so FastTrack uses its Secure `__Host-` cookie mode.

## Reporting a vulnerability

Do not publish authentication secrets or private user data in a public issue. Provide the smallest reproducible description needed to understand the vulnerability.
