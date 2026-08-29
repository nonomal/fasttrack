# FastTrack v2.2

**FastTrack** is a self-hosted fasting, bodyweight, health and supplement tracker designed to keep your information on your own server and make it available from any computer you sign in from.

FastTrack v2.2 is a complete standalone application: the browser interface is served directly by a Node 24 backend using SQLite. There is no frontend build step and no runtime npm dependency tree.

## Highlights

- ⏱ **Live fasting timer** stored on the server
- 📅 **Manual fast entry** for past/completed fasts
- 📊 **Fasting statistics and charts**
- 🗂 **Fasting history** with deletion and export
- ⚖️ **Bodyweight tracking** with BMI calculation
- 🧍 **Health profile** with height, age, goal weight and units
- 💊 **Comprehensive supplement tracking**
- 🔎 **276 supplement/vitamin types** based on public supplement-category taxonomies, including the broad categories found on iHerb
- 🧪 Product, brand, form, dose, units, date/time and notes for supplements
- ⚡ **Quick log recent supplements**
- 🎨 **26 themes**
- 🧱 **10 application layouts**
- ☁️ Theme/layout preferences follow the user account to another computer
- 👥 **Secure multi-user accounts**
- 🛡 First registered account becomes administrator
- 🔐 Server-side sessions using HttpOnly cookies
- 💾 **SQLite persistence**
- 🔄 Automatic legacy JSON migration
- 🧰 Import/export tools
- 💿 **Automatic verified SQLite backups**
- ↩ Reliable upgrade, restore and rollback scripts
- 🐳 **One Dockerfile and one docker-compose.yml**
- 🏗 GitHub Actions build for amd64 and arm64
- 📱 Responsive desktop/mobile interface

---

## Quick start

### Requirements

- Docker
- Docker Compose v2
- Port `3004` available, or choose another port in `.env`

### 1. Clone the repository

```bash
git clone https://github.com/theqldcoalminer/fasttrack.git
cd fasttrack
```

### 2. Create your environment file

```bash
cp .env.example .env
```

The defaults are suitable for most local installations:

```text
FASTTRACK_PORT=3004
FASTTRACK_VERSION=2.2.0
SESSION_TTL_HOURS=12
BACKUPS_ENABLED=true
BACKUP_ON_START=true
BACKUP_INTERVAL_HOURS=24
BACKUP_RETENTION_DAYS=30
```

### 3. Create the backup directory

```bash
mkdir -p backups
```

### 4. Build and start FastTrack

```bash
docker compose up -d --build
```

### 5. Check it

```bash
docker compose ps
curl http://localhost:3004/health
```

Expected health response:

```json
{
  "status": "healthy",
  "version": "2.2.0",
  "timestamp": "2026-08-29T00:00:00.000Z"
}
```

Open FastTrack in a browser:

```text
http://YOUR-SERVER:3004
```

---

# How to use FastTrack

## 1. Create the first account

Open FastTrack and choose **Register**.

Enter:

- username;
- email address;
- password of at least 15 characters.

The **first account created becomes the administrator**. Additional accounts are normal users unless promoted by an administrator.

After registration, FastTrack creates a secure server-side session and logs you in.

## 2. Dashboard

The Dashboard shows a quick overview of:

- number of completed fasts;
- total fasting hours;
- longest fast;
- supplements logged today;
- current fasting timer;
- latest bodyweight;
- current theme/layout;
- recent fasts.

Use **Open timer** to jump directly to the fasting screen.

## 3. Start a live fast

Go to:

```text
Fast → Live fasting timer
```

Choose **Start fast now**.

The start time is saved to SQLite immediately. This means you can:

1. start a fast on one computer;
2. close the browser;
3. open FastTrack on another computer;
4. sign in to the same account;
5. continue seeing the active timer.

When finished, choose:

```text
Stop & save
```

FastTrack calculates the duration and moves the completed fast into fasting history.

Choose **Cancel** only if you want to discard the active timer without saving it as a completed fast.

## 4. Add a completed/past fast

Go to:

```text
Fast → Add a completed fast
```

Enter:

- start date/time;
- end date/time;
- optional notes.

FastTrack calculates the fasting duration automatically.

This is useful for entering fasting records from before you installed FastTrack.

## 5. Fasting statistics

Go to:

```text
Stats
```

You will see:

- total number of fasts;
- total fasting hours;
- average fasting duration;
- fasts during the last seven days;
- recent fasting-duration chart.

## 6. Fasting history

Go to:

```text
History
```

Each record shows:

- start time;
- end time;
- duration;
- notes.

Individual records can be deleted.

For a complete data export, use the **Data** page instead.

---

# Bodyweight and health tracking

## 7. Create your health profile

Go to:

```text
Health
```

The profile supports:

- age;
- gender;
- height;
- centimetres or inches;
- goal weight;
- kilograms or pounds.

Save the profile before recording weight so FastTrack can calculate BMI using your stored height.

## 8. Record bodyweight

On the Health page enter:

- weight;
- kg or lb;
- date and time.

FastTrack calculates BMI from your saved height and stores the weight record in SQLite.

The weight history table displays:

- date/time;
- bodyweight;
- unit;
- BMI.

---

# Supplement tracking

FastTrack v2.2 includes a broad searchable supplement catalog with **276 trackable types** covering common vitamins, minerals, amino acids, herbs, antioxidants, sports supplements, proteins, omega oils, mushrooms, gut-health products and many other categories.

The catalog was assembled from public supplement-category taxonomies, including categories visible on iHerb. FastTrack is **not affiliated with iHerb** and does not copy or sell iHerb products.

The catalog is a logging aid, not medical or dosing advice.

## 9. Find a supplement

Go to:

```text
Supplements
```

Use **Search catalog** and type, for example:

```text
Magnesium
Vitamin D
Vitamin B12
Creatine
NAC
Ashwagandha
Berberine
Omega-3
Fish Oil
Lion's Mane
NMN
Collagen
Probiotics
Whey Protein
```

You can also filter by category.

## 10. Supplement categories

The catalog includes groups such as:

- Vitamins
- Minerals
- Amino Acids
- Herbs
- Antioxidants
- Bone & Joint
- Brain & Cognitive
- Gut Health
- Omegas & Fish Oils
- Greens & Superfoods
- Hair, Skin & Nails
- Mushrooms
- Men's Health
- Women's Health
- Children's Health
- Sleep
- Protein
- Sports Performance
- Weight Management
- Detox & Cleanse
- Eye, Ear & Nose
- Bee Products
- Organ Meats
- Phospholipids
- Longevity compounds
- Custom supplements

Because the catalog includes **Custom Supplement**, you can record anything that is not yet included.

## 11. Log a supplement

Example:

```text
Category:         Minerals
Supplement type:  Magnesium
Product/name:     Magnesium Glycinate
Brand:            Example Brand
Form:             Capsule
Dose:             200
Unit:             mg
Date/time:        8:30 PM
Notes:            Evening dose
```

Supported forms include:

- capsule;
- tablet;
- softgel;
- gummy;
- powder;
- liquid;
- drops;
- spray;
- lozenge;
- chewable;
- sachet;
- ready-to-drink;
- food;
- other.

Common dose units include:

- mcg;
- mg;
- g;
- IU;
- mL;
- drops;
- capsules;
- tablets;
- softgels;
- gummies;
- scoops;
- servings;
- CFU;
- units.

## 12. Quick-log supplements

Frequently/recently used supplements appear under **Quick log recent**.

Selecting a recent entry creates a new intake record using the same:

- category;
- supplement type;
- product;
- brand;
- form;
- dose;
- unit;

with the current date/time.

This is useful for supplements taken every day.

## 13. Search supplement history

The supplement-history search matches:

- category;
- supplement type;
- product name;
- brand.

Individual supplement records can be deleted.

---

# Themes

FastTrack includes **26 themes**:

1. System
2. Light
3. Dark
4. Midnight
5. OLED Black
6. Slate
7. Blue
8. Indigo
9. Purple
10. Pink
11. Rose
12. Red
13. Orange
14. Amber
15. Green
16. Emerald
17. Teal
18. Cyan
19. Ocean
20. Nord
21. Dracula
22. Solarized Light
23. Solarized Dark
24. Gruvbox Dark
25. Monokai
26. High Contrast

## 14. Change theme

Go to:

```text
Settings → Appearance → Themes
```

Choose a theme card.

The change is applied immediately and saved to the server.

When you sign in to the same account on another computer, FastTrack loads the same theme from SQLite.

`System` follows the operating system's light/dark preference.

---

# Layouts

FastTrack provides **10 layouts**:

1. Classic
2. Sidebar
3. Compact Sidebar
4. Wide Dashboard
5. Focus
6. Floating
7. Dense
8. Bottom Dock
9. Split Header
10. Zen

## 15. Change layout

Go to:

```text
Settings → Appearance → Layouts
```

Examples:

### Classic
Traditional horizontal navigation at the top.

### Sidebar
Full vertical navigation rail for desktop use.

### Compact Sidebar
Narrow navigation rail that uses less screen space.

### Wide Dashboard
Uses more horizontal space on large monitors.

### Focus
Narrower centred workspace.

### Floating
Floating navigation/navigation-card appearance.

### Dense
Reduced spacing for information-heavy screens.

### Bottom Dock
Mobile-style navigation fixed near the bottom of the window.

### Split Header
Wider desktop-oriented header structure.

### Zen
Reduced visual chrome for a minimal interface.

Layouts are stored per user in SQLite and follow the account to another computer.

---

# Account and security

## 16. Edit your account

Go to:

```text
Settings → Account
```

You can change:

- username;
- email address.

Changing either login identity requires your current password.

## 17. Avatar

Settings supports PNG, JPEG and WebP avatars.

Keep avatar images reasonably small. The interface currently recommends less than about 1.8 MB.

## 18. Change password

Go to:

```text
Settings → Change password
```

Enter:

- current password;
- new password.

Changing the password revokes all sessions, including the current one.

## 19. Sign out all devices

Go to:

```text
Settings → Sessions → Sign out all devices
```

This removes every server-side session belonging to the account.

---

# Administrator tools

The first registered FastTrack account becomes an administrator.

Administrators get an additional:

```text
Admin
```

page.

Administrators can:

- list user accounts;
- promote a user to administrator;
- remove administrator access;
- delete other user accounts.

Safety rules prevent:

- changing your own administrator status from the admin panel;
- deleting your own account from the admin panel;
- demoting the final administrator.

---

# Data export and import

## 20. Export all account data

Go to:

```text
Data → Download JSON export
```

The export contains:

```text
fasts
weights
supplements
profile
preferences
exportedAt
```

Use this for application-level portability.

## 21. Export fasting history as CSV

Go to:

```text
Data → CSV: fasting history
```

The CSV can be opened in Excel, LibreOffice or other spreadsheet software.

## 22. Import FastTrack JSON

Go to:

```text
Data → Import
```

Choose an exported FastTrack JSON file and select **Import selected file**.

Rows with matching IDs are not duplicated.

---

# Server storage

FastTrack v2.2 stores application data in:

```text
/data/fasttrack.db
```

inside the container.

Docker stores `/data` in the named volume:

```text
fasttrack-data
```

Replacing/recreating the FastTrack container therefore does not normally delete your database.

Do **not** run:

```bash
docker compose down -v
```

unless you intentionally want to remove the FastTrack Docker volume.

---

# Automatic backups

Backups are enabled by default.

Default settings:

```text
BACKUPS_ENABLED=true
BACKUP_ON_START=true
BACKUP_INTERVAL_HOURS=24
BACKUP_RETENTION_DAYS=30
```

Verified automatic backup files are written to the Docker volume:

```text
fasttrack-backups
```

To copy them to the host `./backups` directory, run:

```bash
./scripts/export-backups.sh
```

FastTrack uses SQLite's consistent backup API and validates backup copies with:

```sql
PRAGMA quick_check;
```

## 23. Create a backup immediately

```bash
./scripts/backup-now.sh
```

Export and list them:

```bash
./scripts/export-backups.sh
ls -lh backups/
```

## 24. Restore a backup

```bash
./scripts/restore.sh backups/fasttrack-....sqlite3
```

The restore script saves the current database before replacing it.

---

# Updating FastTrack

Use:

```bash
./scripts/upgrade.sh
```

The update workflow:

1. checks for uncommitted Git changes;
2. creates a verified database backup;
3. records the currently working commit;
4. performs `git pull --ff-only`;
5. rebuilds the Docker image;
6. restarts FastTrack;
7. waits for the Docker health check.

If the new version fails:

```bash
./scripts/rollback.sh
```

For a data rollback:

```bash
./scripts/restore.sh backups/<backup-file>.sqlite3
```

---

# Migrating from older FastTrack installations

Older versions of FastTrack stored data as JSON under:

```text
/data/app_data/
```

FastTrack v2.2 checks for the legacy structure during first startup.

If found, it:

1. creates the new SQLite database;
2. copies the old JSON tree into a migration-backup directory;
3. imports user accounts;
4. imports fasts;
5. imports weight records;
6. imports supplement records;
7. imports health profiles;
8. imports active timers;
9. leaves the original JSON files in place.

The snapshot is stored under:

```text
/data/migration-backups/
```

## Legacy password note

Very old FastTrack releases used bcrypt passwords and also contained a serialization bug that could omit password hashes from `users.json`.

This standalone v2.2 build uses Node's built-in **scrypt** password hashing and intentionally has no external bcrypt runtime dependency.

If a migrated legacy account cannot authenticate, reset it from the Docker host:

```bash
docker compose exec \
  -e NEW_PASSWORD='use-a-long-unique-password-here' \
  fasttrack \
  node backend/scripts/reset-password.js USERNAME
```

All data belonging to that user remains intact; only the password/session state changes.

---

# Security model

FastTrack v2.2 includes several protections that were missing from the original application.

## Passwords

New passwords use Node's built-in `crypto.scrypt()` password hashing with a unique random salt.

Minimum password length:

```text
15 characters
```

Use a long unique password/passphrase.

## Sessions

FastTrack does **not** store a browser authentication token in `localStorage`.

The browser receives an opaque random 256-bit server-side session cookie:

```text
HttpOnly
SameSite=Strict
Secure when HTTPS is detected
__Host-fasttrack_session when HTTPS is detected
```

SQLite stores only a SHA-256 hash of the session token.

## Login protection

The server applies failed-login throttling and randomized delay after authentication failures.

## Cross-site request protection

Mutating cross-site browser requests are rejected using origin/fetch-site checks, and session cookies use `SameSite=Strict`.

## Browser headers

FastTrack sends protections including:

- Content Security Policy;
- `X-Frame-Options: DENY`;
- `X-Content-Type-Options: nosniff`;
- restrictive referrer policy;
- restrictive permissions policy.

## Container hardening

The Docker container:

- runs as an unprivileged `fasttrack` user;
- uses a read-only root filesystem;
- uses `no-new-privileges`;
- stores writable application state only in `/data`, `/backups` and temporary memory.

For more detail see [SECURITY.md](SECURITY.md).

---

# HTTPS

If FastTrack is reachable from the public internet, put it behind HTTPS.

Suitable options include:

- Caddy;
- Traefik;
- nginx;
- Cloudflare Tunnel;
- another correctly configured TLS reverse proxy.

Do not expose password authentication to an untrusted/public network over plain HTTP.

FastTrack respects the reverse proxy's `X-Forwarded-Proto: https` header and uses its Secure `__Host-` cookie mode when HTTPS is detected.

---

# Docker architecture

FastTrack v2.2 deliberately has one simple runtime:

```text
Browser
   │
   ▼
FastTrack Node 24 server :8080
   ├── static HTML/CSS/JavaScript UI
   ├── authentication/session API
   ├── fasting API
   ├── health/weight API
   ├── supplement API
   ├── admin API
   └── SQLite
          │
          ▼
     /data/fasttrack.db
```

There is:

- one `Dockerfile`;
- one `docker-compose.yml`;
- no frontend compilation step;
- no production npm dependencies;
- no second database container.

---

# Repository layout

```text
fasttrack/
├── .github/
│   └── workflows/
│       └── container.yml
├── backend/
│   ├── server.js
│   └── scripts/
│       ├── backup-now.js
│       └── reset-password.js
├── public/
│   ├── index.html
│   ├── styles.css
│   ├── app.js
│   └── supplementCatalog.js
├── scripts/
│   ├── backup-now.sh
│   ├── export-backups.sh
│   ├── upgrade.sh
│   ├── rollback.sh
│   └── restore.sh
├── backups/
│   └── .gitkeep
├── .dockerignore
├── .env.example
├── .gitignore
├── CHANGELOG.md
├── Dockerfile
├── docker-compose.yml
├── LICENSE
├── MIGRATION.md
├── package.json
├── package-lock.json
├── README.md
├── SECURITY.md
└── VERSION
```

---

# Local development without Docker

FastTrack requires Node 24+ because it uses the built-in `node:sqlite` API.

No package installation is required.

```bash
mkdir -p .local-data backups

PORT=8080 \
DB_PATH="$PWD/.local-data/fasttrack.db" \
BACKUP_DIR="$PWD/backups" \
BACKUPS_ENABLED=false \
node backend/server.js
```

Then open:

```text
http://localhost:8080
```

Run source syntax checks:

```bash
npm run check
```

---

# GitHub container builds

The included GitHub Actions workflow builds multi-architecture images for:

```text
linux/amd64
linux/arm64
```

and can publish:

```text
ghcr.io/theqldcoalminer/fasttrack:latest
```

Pushing a tag such as:

```bash
git tag -a v2.2.0 -m "FastTrack v2.2.0"
git push origin v2.2.0
```

also produces a tagged container build through the workflow.

---

# Tested v2.2 functions

The complete v2.2 repository has been smoke-tested with a real SQLite database for:

- health endpoint;
- account registration;
- automatic first-account administrator role;
- authenticated session cookie;
- `GET /api/auth/me`;
- saving theme/layout preferences;
- saving a completed fast;
- saving a health profile;
- saving weight/BMI;
- saving a detailed Magnesium supplement entry;
- complete JSON export;
- consistent live SQLite backup;
- SQLite backup integrity verification.

---

# Supplement disclaimer

FastTrack is a tracking application, not a medical service.

The supplement catalog exists to make logging easier. Inclusion of a supplement does not mean FastTrack recommends taking it, and the application does not provide dose recommendations.

Consult an appropriate healthcare professional for decisions involving supplements, medication interactions, pregnancy, medical conditions, fasting safety or other health concerns.

FastTrack is not affiliated with iHerb.

---

# License

MIT. See [LICENSE](LICENSE).

---

**FastTrack** — self-hosted fasting, health and supplement tracking with data that follows your account instead of a particular browser.
