'use strict';

const http = require('http');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const { DatabaseSync, backup } = require('node:sqlite');

process.umask(0o077);

const PORT = Number(process.env.PORT || 8080);
const DB_PATH = process.env.DB_PATH || '/data/fasttrack.db';
const BACKUP_DIR = process.env.BACKUP_DIR || '/backups';
const LEGACY_DATA_DIR = process.env.LEGACY_DATA_DIR || '/data/app_data';
const VERSION = process.env.FASTTRACK_VERSION || '2.2.0';
const SESSION_TTL_HOURS = Math.max(1, Math.min(168, Number(process.env.SESSION_TTL_HOURS || 12)));
const STATIC_DIR = path.join(__dirname, '..', 'public');
const COOKIE_NAME_SECURE = '__Host-fasttrack_session';
const COOKIE_NAME_HTTP = 'fasttrack_session';
const MAX_BODY = 5 * 1024 * 1024;

const THEMES = new Set([
  'system','light','dark','midnight','oled','slate','blue','indigo','purple','pink','rose','red','orange','amber',
  'green','emerald','teal','cyan','ocean','nord','dracula','solarized-light','solarized-dark','gruvbox-dark','monokai','high-contrast'
]);
const LAYOUTS = new Set(['classic','sidebar','compact-sidebar','wide','focus','floating','dense','bottom-dock','split','zen']);

let db;
const loginAttempts = new Map();

function isoNow() { return new Date().toISOString(); }
function id() { return crypto.randomUUID(); }
function cleanText(value, max = 5000) { return String(value ?? '').slice(0, max); }
function finite(value, min = -Infinity, max = Infinity) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) throw new Error('Invalid numeric value');
  return n;
}
function validDate(value) {
  const text = String(value || '');
  if (!text || Number.isNaN(new Date(text).getTime())) throw new Error('Invalid date/time');
  return text;
}

function initDb() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true, mode: 0o700 });
  fs.mkdirSync(BACKUP_DIR, { recursive: true, mode: 0o700 });
  db = new DatabaseSync(DB_PATH, { timeout: 5000, defensive: true, enableForeignKeyConstraints: true, allowExtension: false });
  db.exec(`
    PRAGMA journal_mode=WAL;
    PRAGMA synchronous=NORMAL;
    PRAGMA foreign_keys=ON;
    PRAGMA busy_timeout=5000;
    PRAGMA trusted_schema=OFF;

    CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT;
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE COLLATE NOCASE,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT,
      is_admin INTEGER NOT NULL DEFAULT 0 CHECK(is_admin IN (0,1)),
      avatar TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_login TEXT
    ) STRICT;
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      session_id TEXT NOT NULL UNIQUE,
      user_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      last_accessed TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      user_agent TEXT NOT NULL DEFAULT '',
      ip_address TEXT NOT NULL DEFAULT '',
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    ) STRICT;
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_exp ON sessions(expires_at);
    CREATE TABLE IF NOT EXISTS fasts (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, start_time TEXT NOT NULL, end_time TEXT NOT NULL,
      duration REAL NOT NULL, notes TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    ) STRICT;
    CREATE INDEX IF NOT EXISTS idx_fasts_user_start ON fasts(user_id,start_time DESC);
    CREATE TABLE IF NOT EXISTS weights (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, weight REAL NOT NULL, bmi REAL NOT NULL,
      unit TEXT NOT NULL CHECK(unit IN ('kg','lb')), date TEXT NOT NULL, created_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    ) STRICT;
    CREATE INDEX IF NOT EXISTS idx_weights_user_date ON weights(user_id,date DESC);
    CREATE TABLE IF NOT EXISTS supplements (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, category TEXT NOT NULL DEFAULT 'Custom',
      supplement_type TEXT NOT NULL DEFAULT 'Custom Supplement', name TEXT NOT NULL, brand TEXT NOT NULL DEFAULT '',
      form TEXT NOT NULL DEFAULT '', quantity REAL NOT NULL, unit TEXT NOT NULL, time TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    ) STRICT;
    CREATE INDEX IF NOT EXISTS idx_supp_user_time ON supplements(user_id,time DESC);
    CREATE TABLE IF NOT EXISTS profiles (
      user_id TEXT PRIMARY KEY, age REAL, gender TEXT, height REAL, height_unit TEXT,
      current_weight REAL, weight_unit TEXT, goal_weight REAL, activity_level TEXT,
      extra_json TEXT NOT NULL DEFAULT '{}', updated_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    ) STRICT;
    CREATE TABLE IF NOT EXISTS timers (
      user_id TEXT PRIMARY KEY, start_time TEXT NOT NULL, notes TEXT NOT NULL DEFAULT '',
      is_paused INTEGER NOT NULL DEFAULT 0 CHECK(is_paused IN (0,1)), paused_at TEXT,
      created_at TEXT NOT NULL, updated_at TEXT,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    ) STRICT;
    CREATE TABLE IF NOT EXISTS user_preferences (
      user_id TEXT PRIMARY KEY, theme TEXT NOT NULL DEFAULT 'system', layout TEXT NOT NULL DEFAULT 'classic',
      updated_at TEXT NOT NULL, FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    ) STRICT;
  `);
  setMeta('schema_version', '4');
  try { fs.chmodSync(DB_PATH, 0o600); } catch {}
}

function setMeta(key, value) {
  db.prepare('INSERT INTO meta(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key, String(value));
}
function getMeta(key) { return db.prepare('SELECT value FROM meta WHERE key=?').get(key)?.value ?? null; }

function publicUser(row) {
  return row ? {
    id: row.id, username: row.username, email: row.email, isAdmin: row.is_admin === 1,
    avatar: row.avatar || null, createdAt: row.created_at, updatedAt: row.updated_at, lastLogin: row.last_login || null
  } : null;
}

function parseStoredHash(stored) {
  if (!stored || !stored.startsWith('scrypt$')) return null;
  const [, salt, hash] = stored.split('$');
  if (!salt || !hash) return null;
  return { salt, hash };
}
function scrypt(password, salt) {
  return new Promise((resolve, reject) => crypto.scrypt(password, salt, 64, { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (err, key) => err ? reject(err) : resolve(key)));
}
async function hashPassword(password) {
  if (typeof password !== 'string' || password.length < 15 || Buffer.byteLength(password, 'utf8') > 128) {
    throw new Error('Password must be 15-128 UTF-8 bytes long');
  }
  const salt = crypto.randomBytes(16).toString('base64url');
  const key = await scrypt(password, salt);
  return `scrypt$${salt}$${key.toString('base64url')}`;
}
async function verifyPassword(password, stored) {
  const parsed = parseStoredHash(stored);
  if (!parsed) {
    await scrypt(String(password || 'invalid'), 'fasttrack-dummy-salt');
    return false;
  }
  const actual = await scrypt(String(password || ''), parsed.salt);
  const expected = Buffer.from(parsed.hash, 'base64url');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function parseCookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const idx = part.indexOf('='); if (idx < 1) continue;
    const k = part.slice(0, idx).trim(); const v = part.slice(idx + 1).trim();
    try { out[k] = decodeURIComponent(v); } catch { out[k] = v; }
  }
  return out;
}
function isHttps(req) {
  return String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';
}
function sessionToken(req) {
  const cookies = parseCookies(req);
  return cookies[COOKIE_NAME_SECURE] || cookies[COOKIE_NAME_HTTP] || null;
}
function sessionHash(token) { return crypto.createHash('sha256').update(token).digest('hex'); }
function setSessionCookie(req, res, token) {
  const secure = isHttps(req);
  const name = secure ? COOKIE_NAME_SECURE : COOKIE_NAME_HTTP;
  const attrs = [`${name}=${encodeURIComponent(token)}`, 'Path=/', 'HttpOnly', 'SameSite=Strict', `Max-Age=${SESSION_TTL_HOURS * 3600}`];
  if (secure) attrs.push('Secure');
  res.setHeader('Set-Cookie', attrs.join('; '));
}
function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', [
    `${COOKIE_NAME_HTTP}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`,
    `${COOKIE_NAME_SECURE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`
  ]);
}
function authenticate(req) {
  const token = sessionToken(req); if (!token) return null;
  const h = sessionHash(token);
  const s = db.prepare('SELECT * FROM sessions WHERE token_hash=?').get(h);
  if (!s || Date.parse(s.expires_at) <= Date.now()) { if (s) db.prepare('DELETE FROM sessions WHERE token_hash=?').run(h); return null; }
  const u = db.prepare('SELECT * FROM users WHERE id=?').get(s.user_id);
  if (!u) return null;
  if (Date.now() - Date.parse(s.last_accessed) > 5 * 60 * 1000) db.prepare('UPDATE sessions SET last_accessed=? WHERE token_hash=?').run(isoNow(), h);
  return { user: publicUser(u), token, tokenHash: h };
}

function secHeaders(res, authRoute = false) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'");
  if (authRoute) res.setHeader('Cache-Control', 'no-store');
}
function json(res, status, body, authRoute = false) {
  secHeaders(res, authRoute); res.statusCode = status; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(body));
}
async function readJson(req) {
  let size = 0, chunks = [];
  for await (const chunk of req) { size += chunk.length; if (size > MAX_BODY) throw Object.assign(new Error('Request too large'), { status: 413 }); chunks.push(chunk); }
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw Object.assign(new Error('Invalid JSON'), { status: 400 }); }
}
function checkOrigin(req) {
  if (!['POST','PUT','PATCH','DELETE'].includes(req.method)) return true;
  if (req.headers['sec-fetch-site'] === 'cross-site') return false;
  const origin = req.headers.origin; if (!origin) return true;
  try {
    const o = new URL(origin);
    const forwardedHost = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
    return o.host === forwardedHost;
  } catch { return false; }
}
function rateKey(req, login = '') { return `${req.socket.remoteAddress || 'unknown'}|${String(login).toLowerCase()}`; }
function loginAllowed(key) {
  const now = Date.now(); const row = loginAttempts.get(key);
  if (!row || row.until <= now) { loginAttempts.set(key, { count: 0, until: now + 15 * 60 * 1000 }); return true; }
  return row.count < 8;
}
function loginFail(key) { const r = loginAttempts.get(key) || { count: 0, until: Date.now() + 15 * 60 * 1000 }; r.count++; loginAttempts.set(key, r); }
function loginClear(key) { loginAttempts.delete(key); }
function delayFailure() { return new Promise(r => setTimeout(r, crypto.randomInt(350, 601))); }

async function createSession(req, userRow) {
  const raw = crypto.randomBytes(32).toString('base64url');
  const now = new Date();
  db.prepare(`INSERT INTO sessions(token_hash,session_id,user_id,created_at,last_accessed,expires_at,user_agent,ip_address) VALUES(?,?,?,?,?,?,?,?)`).run(
    sessionHash(raw), id(), userRow.id, now.toISOString(), now.toISOString(), new Date(now.getTime()+SESSION_TTL_HOURS*3600000).toISOString(), cleanText(req.headers['user-agent'],300), cleanText(req.socket.remoteAddress,100)
  );
  return raw;
}

async function migrateLegacy() {
  if (getMeta('legacy_json_migrated') === '1') return;
  const usersFile = path.join(LEGACY_DATA_DIR, 'users.json');
  if (!fs.existsSync(usersFile)) { setMeta('legacy_json_migrated','1'); return; }
  if (Number(db.prepare('SELECT COUNT(*) count FROM users').get().count) > 0) { setMeta('legacy_json_migrated','1'); return; }
  try {
    const backupDir = path.join(path.dirname(DB_PATH), 'migration-backups', `legacy-${new Date().toISOString().replace(/[:.]/g,'-')}`);
    await fsp.mkdir(path.dirname(backupDir), { recursive:true, mode:0o700 }); await fsp.cp(LEGACY_DATA_DIR, backupDir, {recursive:true});
    const users = JSON.parse(await fsp.readFile(usersFile,'utf8'));
    const oldSanitize = u => String(u).replace(/[^a-zA-Z0-9_-]/g,'_');
    for (const raw of Array.isArray(users)?users:[]) {
      if (!raw?.id || !raw?.username || !raw?.email) continue;
      db.prepare(`INSERT OR IGNORE INTO users(id,username,email,password_hash,is_admin,avatar,created_at,updated_at,last_login) VALUES(?,?,?,?,?,?,?,?,?)`).run(
        String(raw.id), String(raw.username), String(raw.email).toLowerCase(), raw.passwordHash || null, raw.isAdmin?1:0, raw.avatar||null,
        String(raw.createdAt||isoNow()), String(raw.updatedAt||raw.createdAt||isoNow()), raw.lastLogin||null
      );
      const dir = path.join(LEGACY_DATA_DIR,'users',oldSanitize(raw.username));
      const readArray = async f => { try { const x=JSON.parse(await fsp.readFile(path.join(dir,f),'utf8')); return Array.isArray(x)?x:[]; } catch { return []; } };
      for (const f of await readArray('fasts.json')) db.prepare(`INSERT OR IGNORE INTO fasts(id,user_id,start_time,end_time,duration,notes,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)`).run(String(f.id||id()),String(raw.id),String(f.startTime),String(f.endTime),Number(f.duration)||0,cleanText(f.notes),String(f.createdAt||isoNow()),f.updatedAt||null);
      for (const w of await readArray('weights.json')) db.prepare(`INSERT OR IGNORE INTO weights(id,user_id,weight,bmi,unit,date,created_at) VALUES(?,?,?,?,?,?,?)`).run(String(w.id||id()),String(raw.id),Number(w.weight)||0,Number(w.bmi)||0,w.unit==='lb'?'lb':'kg',String(w.date||isoNow()),String(w.createdAt||isoNow()));
      for (const s of await readArray('supplements.json')) db.prepare(`INSERT OR IGNORE INTO supplements(id,user_id,category,supplement_type,name,brand,form,quantity,unit,time,notes,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`).run(String(s.id||id()),String(raw.id),String(s.category||'Custom'),String(s.supplementType||s.type||'Custom Supplement'),String(s.name||'Supplement'),String(s.brand||''),String(s.form||''),Number(s.quantity)||0,String(s.unit||'mg'),String(s.time||isoNow()),cleanText(s.notes),String(s.createdAt||isoNow()));
      const profile=(await readArray('profile.json'))[0]; if(profile) saveProfile(String(raw.id),profile);
      const timer=(await readArray('timer.json'))[0]; if(timer) db.prepare(`INSERT OR REPLACE INTO timers(user_id,start_time,notes,is_paused,paused_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?)`).run(String(raw.id),String(timer.startTime),cleanText(timer.notes),timer.isPaused?1:0,timer.pausedAt||null,String(timer.createdAt||isoNow()),timer.updatedAt||null);
    }
    setMeta('legacy_json_migrated','1'); setMeta('legacy_json_backup',backupDir);
    console.log('Legacy JSON migration completed. Passwords using old bcrypt hashes need a reset in this dependency-free build.');
  } catch (e) { console.error('Legacy migration failed:',e); throw e; }
}

function saveProfile(userId, p) {
  const extra = { ...p }; for (const k of ['age','gender','height','heightUnit','currentWeight','weightUnit','goalWeight','activityLevel','updatedAt']) delete extra[k];
  db.prepare(`INSERT INTO profiles(user_id,age,gender,height,height_unit,current_weight,weight_unit,goal_weight,activity_level,extra_json,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET age=excluded.age,gender=excluded.gender,height=excluded.height,height_unit=excluded.height_unit,current_weight=excluded.current_weight,weight_unit=excluded.weight_unit,goal_weight=excluded.goal_weight,activity_level=excluded.activity_level,extra_json=excluded.extra_json,updated_at=excluded.updated_at`).run(
    userId,p.age??null,p.gender??null,p.height??null,p.heightUnit??null,p.currentWeight??null,p.weightUnit??null,p.goalWeight??null,p.activityLevel??null,JSON.stringify(extra),isoNow()
  );
}
function getProfile(userId) {
  const r=db.prepare('SELECT * FROM profiles WHERE user_id=?').get(userId); if(!r)return null; let extra={}; try{extra=JSON.parse(r.extra_json||'{}')}catch{}
  return {...extra,age:r.age,gender:r.gender,height:r.height,heightUnit:r.height_unit,currentWeight:r.current_weight,weightUnit:r.weight_unit,goalWeight:r.goal_weight,activityLevel:r.activity_level,updatedAt:r.updated_at};
}

async function backupNow(reason='scheduled') {
  const stamp = new Date().toISOString().replace(/[:.]/g,'-'); const tmp=path.join(BACKUP_DIR,`fasttrack-${stamp}.sqlite3.tmp`); const final=tmp.replace(/\.tmp$/,'');
  await backup(db,tmp,{rate:100}); const check=new DatabaseSync(tmp,{readOnly:true,allowExtension:false}); const result=Object.values(check.prepare('PRAGMA quick_check').get())[0]; check.close();
  if(result!=='ok') { await fsp.unlink(tmp).catch(()=>{}); throw new Error(`Backup verification failed: ${result}`); }
  await fsp.rename(tmp,final); await fsp.chmod(final,0o600).catch(()=>{}); setMeta('last_backup_at',isoNow()); setMeta('last_backup_reason',reason); await rotateBackups(); return final;
}
async function rotateBackups(){ const days=Math.max(1,Number(process.env.BACKUP_RETENTION_DAYS||30)); const cutoff=Date.now()-days*86400000; for(const e of await fsp.readdir(BACKUP_DIR,{withFileTypes:true}).catch(()=>[])){ if(e.isFile()&&e.name.endsWith('.sqlite3')){ const p=path.join(BACKUP_DIR,e.name); const s=await fsp.stat(p).catch(()=>null); if(s&&s.mtimeMs<cutoff) await fsp.unlink(p).catch(()=>{}); } } }
function startBackupLoop(){ if(String(process.env.BACKUPS_ENABLED||'true')==='false')return; const hours=Math.max(1,Number(process.env.BACKUP_INTERVAL_HOURS||24)); setInterval(()=>backupNow('scheduled').then(p=>console.log('Backup:',p)).catch(console.error),hours*3600000).unref(); if(String(process.env.BACKUP_ON_START||'true')!=='false') setTimeout(()=>backupNow('startup').catch(console.error),5000).unref(); }

function getFasts(userId){ return db.prepare('SELECT id,start_time startTime,end_time endTime,duration,notes,created_at createdAt,updated_at updatedAt FROM fasts WHERE user_id=? ORDER BY start_time DESC').all(userId); }
function getWeights(userId){ return db.prepare('SELECT id,weight,bmi,unit,date,created_at createdAt FROM weights WHERE user_id=? ORDER BY date DESC').all(userId); }
function getSupplements(userId){ return db.prepare('SELECT id,category,supplement_type supplementType,name,brand,form,quantity,unit,time,notes,created_at createdAt FROM supplements WHERE user_id=? ORDER BY time DESC').all(userId); }

async function handleApi(req,res,url) {
  const p=url.pathname;
  if (!checkOrigin(req)) return json(res,403,{error:'Cross-site request blocked'},true);

  if (p==='/health' && req.method==='GET') { const ok=Object.values(db.prepare('PRAGMA quick_check').get())[0]==='ok'; return json(res,ok?200:503,{status:ok?'healthy':'unhealthy',version:VERSION,timestamp:isoNow()}); }

  if (p==='/api/auth/register' && req.method==='POST') {
    const b=await readJson(req); const username=cleanText(b.username,64).trim(); const email=cleanText(b.email,254).trim().toLowerCase();
    if(!/^[A-Za-z0-9_.-]{3,64}$/.test(username) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json(res,400,{error:'Enter a valid username and email'},true);
    if(b.password!==b.confirmPassword) return json(res,400,{error:'Passwords do not match'},true);
    if(db.prepare('SELECT 1 FROM users WHERE username=? COLLATE NOCASE OR email=? COLLATE NOCASE').get(username,email)) return json(res,400,{error:'Unable to create account with those details'},true);
    const now=isoNow(); const userId=id(); const hash=await hashPassword(b.password); const admin=Number(db.prepare('SELECT COUNT(*) c FROM users').get().c)===0?1:0;
    db.prepare('INSERT INTO users(id,username,email,password_hash,is_admin,avatar,created_at,updated_at,last_login) VALUES(?,?,?,?,?,?,?,?,?)').run(userId,username,email,hash,admin,null,now,now,now);
    const row=db.prepare('SELECT * FROM users WHERE id=?').get(userId); const token=await createSession(req,row); setSessionCookie(req,res,token); return json(res,201,{user:publicUser(row),message:'Account created'},true);
  }

  if (p==='/api/auth/login' && req.method==='POST') {
    const b=await readJson(req); const login=cleanText(b.username,254).trim().toLowerCase(); const key=rateKey(req,login);
    if(!loginAllowed(key)){ await delayFailure(); return json(res,429,{error:'Too many login attempts. Try again later.'},true); }
    const row=db.prepare('SELECT * FROM users WHERE username=? COLLATE NOCASE OR email=? COLLATE NOCASE LIMIT 1').get(login,login); const ok=await verifyPassword(b.password,row?.password_hash);
    if(!row||!ok){ loginFail(key); await delayFailure(); return json(res,401,{error:'Invalid username or password'},true); }
    loginClear(key); db.prepare('UPDATE users SET last_login=?,updated_at=? WHERE id=?').run(isoNow(),row.updated_at||isoNow(),row.id); const fresh=db.prepare('SELECT * FROM users WHERE id=?').get(row.id); const token=await createSession(req,fresh); setSessionCookie(req,res,token); return json(res,200,{user:publicUser(fresh),message:'Login successful'},true);
  }

  const auth=authenticate(req);
  if (p==='/api/auth/logout' && req.method==='POST') { if(auth)db.prepare('DELETE FROM sessions WHERE token_hash=?').run(auth.tokenHash); clearSessionCookie(res); return json(res,200,{message:'Logged out'},true); }
  if (!auth) return json(res,401,{error:'Authentication required'},true);
  const user=auth.user;

  if ((p==='/api/auth/me'||p==='/api/auth/validate') && req.method==='GET') return json(res,200,p.endsWith('validate')?{valid:true,user}:{user},true);
  if(p==='/api/auth/logout-all'&&req.method==='POST'){ const c=Number(db.prepare('DELETE FROM sessions WHERE user_id=?').run(user.id).changes); clearSessionCookie(res); return json(res,200,{message:'All sessions ended',count:c},true); }
  if(p==='/api/auth/sessions'&&req.method==='GET') return json(res,200,db.prepare('SELECT session_id sessionId,created_at createdAt,last_accessed lastAccessed,expires_at expiresAt,user_agent userAgent,ip_address ipAddress FROM sessions WHERE user_id=? AND expires_at>? ORDER BY last_accessed DESC').all(user.id,isoNow()),true);
  if(p==='/api/auth/profile'&&req.method==='PUT'){
    const b=await readJson(req); if(['isAdmin','role','permissions','passwordHash'].some(k=>k in b))return json(res,400,{error:'Forbidden profile field'},true);
    const current=db.prepare('SELECT * FROM users WHERE id=?').get(user.id); const nextUser=b.username!==undefined?cleanText(b.username,64).trim():current.username; const nextEmail=b.email!==undefined?cleanText(b.email,254).trim().toLowerCase():current.email;
    if((nextUser!==current.username||nextEmail!==current.email)&&!await verifyPassword(b.currentPassword,current.password_hash)){await delayFailure();return json(res,400,{error:'Current password is required and must be correct'},true);}
    if(!/^[A-Za-z0-9_.-]{3,64}$/.test(nextUser)||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail))return json(res,400,{error:'Invalid username or email'},true);
    const avatar=b.avatar===undefined?current.avatar:b.avatar; if(avatar!==null&&(!String(avatar).startsWith('data:image/')||String(avatar).length>2500000))return json(res,400,{error:'Avatar is invalid or too large'},true);
    try{db.prepare('UPDATE users SET username=?,email=?,avatar=?,updated_at=? WHERE id=?').run(nextUser,nextEmail,avatar||null,isoNow(),user.id);}catch{return json(res,400,{error:'Username or email is already in use'},true);}
    return json(res,200,{user:publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(user.id)),message:'Profile updated'},true);
  }
  if(p==='/api/auth/password'&&req.method==='PUT'){
    const b=await readJson(req); const current=db.prepare('SELECT * FROM users WHERE id=?').get(user.id); if(!await verifyPassword(b.currentPassword,current.password_hash)){await delayFailure();return json(res,400,{error:'Current password is incorrect'},true);}
    const hash=await hashPassword(b.newPassword); db.prepare('UPDATE users SET password_hash=?,updated_at=? WHERE id=?').run(hash,isoNow(),user.id); db.prepare('DELETE FROM sessions WHERE user_id=?').run(user.id); clearSessionCookie(res); return json(res,200,{message:'Password changed; sign in again'},true);
  }

  if(p==='/api/preferences'&&req.method==='GET'){ const r=db.prepare('SELECT theme,layout,updated_at updatedAt FROM user_preferences WHERE user_id=?').get(user.id)||{theme:'system',layout:'classic',updatedAt:null}; return json(res,200,r); }
  if(p==='/api/preferences'&&req.method==='PUT'){ const b=await readJson(req); if(!THEMES.has(b.theme)||!LAYOUTS.has(b.layout))return json(res,400,{error:'Unsupported appearance option'}); db.prepare('INSERT INTO user_preferences(user_id,theme,layout,updated_at) VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET theme=excluded.theme,layout=excluded.layout,updated_at=excluded.updated_at').run(user.id,b.theme,b.layout,isoNow()); return json(res,200,{theme:b.theme,layout:b.layout,updatedAt:isoNow()}); }

  if(p==='/api/fasts'&&req.method==='GET') return json(res,200,getFasts(user.id));
  if(p==='/api/fasts'&&req.method==='POST'){ const b=await readJson(req); const start=validDate(b.startTime),end=validDate(b.endTime),duration=b.duration===undefined?(Date.parse(end)-Date.parse(start))/3600000:finite(b.duration,0,8760); const row={id:id(),startTime:start,endTime:end,duration,notes:cleanText(b.notes),createdAt:isoNow()}; db.prepare('INSERT INTO fasts(id,user_id,start_time,end_time,duration,notes,created_at) VALUES(?,?,?,?,?,?,?)').run(row.id,user.id,start,end,duration,row.notes,row.createdAt); return json(res,201,row); }
  let m=p.match(/^\/api\/fasts\/([^/]+)$/); if(m&&req.method==='PUT'){ const old=db.prepare('SELECT * FROM fasts WHERE id=? AND user_id=?').get(m[1],user.id); if(!old)return json(res,404,{error:'Fast not found'}); const b=await readJson(req); const start=b.startTime?validDate(b.startTime):old.start_time,end=b.endTime?validDate(b.endTime):old.end_time,duration=b.duration!==undefined?finite(b.duration,0,8760):(Date.parse(end)-Date.parse(start))/3600000,notes=b.notes!==undefined?cleanText(b.notes):old.notes; db.prepare('UPDATE fasts SET start_time=?,end_time=?,duration=?,notes=?,updated_at=? WHERE id=? AND user_id=?').run(start,end,duration,notes,isoNow(),m[1],user.id); return json(res,200,getFasts(user.id).find(x=>x.id===m[1])); }
  if(m&&req.method==='DELETE'){ db.prepare('DELETE FROM fasts WHERE id=? AND user_id=?').run(m[1],user.id); return json(res,200,{success:true}); }

  if(p==='/api/weights'&&req.method==='GET') return json(res,200,getWeights(user.id));
  if(p==='/api/weights'&&req.method==='POST'){ const b=await readJson(req); const row={id:id(),weight:finite(b.weight,1,1000),bmi:finite(b.bmi,1,200),unit:b.unit==='lb'?'lb':'kg',date:b.date?validDate(b.date):isoNow(),createdAt:isoNow()}; db.prepare('INSERT INTO weights(id,user_id,weight,bmi,unit,date,created_at) VALUES(?,?,?,?,?,?,?)').run(row.id,user.id,row.weight,row.bmi,row.unit,row.date,row.createdAt); return json(res,201,row); }
  m=p.match(/^\/api\/weights\/([^/]+)$/); if(m&&req.method==='DELETE'){db.prepare('DELETE FROM weights WHERE id=? AND user_id=?').run(m[1],user.id);return json(res,200,{success:true});}

  if(p==='/api/supplements'&&req.method==='GET') return json(res,200,getSupplements(user.id));
  if(p==='/api/supplements'&&req.method==='POST'){ const b=await readJson(req); const row={id:id(),category:cleanText(b.category,100)||'Custom',supplementType:cleanText(b.supplementType,160)||'Custom Supplement',name:cleanText(b.name,200)||cleanText(b.supplementType,160)||'Supplement',brand:cleanText(b.brand,120),form:cleanText(b.form,60),quantity:finite(b.quantity,0,1000000),unit:cleanText(b.unit,40)||'mg',time:b.time?validDate(b.time):isoNow(),notes:cleanText(b.notes),createdAt:isoNow()}; db.prepare('INSERT INTO supplements(id,user_id,category,supplement_type,name,brand,form,quantity,unit,time,notes,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run(row.id,user.id,row.category,row.supplementType,row.name,row.brand,row.form,row.quantity,row.unit,row.time,row.notes,row.createdAt); return json(res,201,row); }
  m=p.match(/^\/api\/supplements\/([^/]+)$/); if(m&&req.method==='DELETE'){db.prepare('DELETE FROM supplements WHERE id=? AND user_id=?').run(m[1],user.id);return json(res,200,{success:true});}

  if(p==='/api/profile'&&req.method==='GET') return json(res,200,getProfile(user.id));
  if(p==='/api/profile'&&req.method==='POST'){ const b=await readJson(req); for(const k of ['isAdmin','password','passwordHash','userId'])delete b[k]; saveProfile(user.id,b); return json(res,200,getProfile(user.id)); }

  if(p==='/api/timer'&&req.method==='GET'){ const r=db.prepare('SELECT start_time startTime,notes,is_paused isPaused,paused_at pausedAt,created_at createdAt,updated_at updatedAt FROM timers WHERE user_id=?').get(user.id); if(r)r.isPaused=Boolean(r.isPaused); return json(res,200,r||null); }
  if(p==='/api/timer'&&req.method==='POST'){ const b=await readJson(req); const row={startTime:validDate(b.startTime||isoNow()),notes:cleanText(b.notes),isPaused:false,pausedAt:null,createdAt:isoNow(),updatedAt:null}; db.prepare('INSERT OR REPLACE INTO timers(user_id,start_time,notes,is_paused,paused_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?)').run(user.id,row.startTime,row.notes,0,null,row.createdAt,null); return json(res,200,row); }
  if(p==='/api/timer'&&req.method==='PUT'){ const old=db.prepare('SELECT * FROM timers WHERE user_id=?').get(user.id); if(!old)return json(res,404,{error:'No active timer'}); const b=await readJson(req); const paused=b.isPaused===undefined?Boolean(old.is_paused):Boolean(b.isPaused),pausedAt=b.pausedAt===undefined?old.paused_at:(b.pausedAt?validDate(b.pausedAt):null),notes=b.notes===undefined?old.notes:cleanText(b.notes); db.prepare('UPDATE timers SET notes=?,is_paused=?,paused_at=?,updated_at=? WHERE user_id=?').run(notes,paused?1:0,pausedAt,isoNow(),user.id); return json(res,200,{startTime:old.start_time,notes,isPaused:paused,pausedAt,createdAt:old.created_at,updatedAt:isoNow()}); }
  if(p==='/api/timer'&&req.method==='DELETE'){db.prepare('DELETE FROM timers WHERE user_id=?').run(user.id);return json(res,200,{success:true});}

  if(p==='/api/export'&&req.method==='GET') return json(res,200,{fasts:getFasts(user.id),weights:getWeights(user.id),supplements:getSupplements(user.id),profile:getProfile(user.id),preferences:db.prepare('SELECT theme,layout FROM user_preferences WHERE user_id=?').get(user.id)||{theme:'system',layout:'classic'},exportedAt:isoNow()});
  if(p==='/api/import'&&req.method==='POST'){ const b=await readJson(req); db.exec('BEGIN IMMEDIATE'); try{ for(const f of b.fasts||[])db.prepare('INSERT OR IGNORE INTO fasts(id,user_id,start_time,end_time,duration,notes,created_at) VALUES(?,?,?,?,?,?,?)').run(String(f.id||id()),user.id,validDate(f.startTime),validDate(f.endTime),finite(f.duration,0,8760),cleanText(f.notes),String(f.createdAt||isoNow())); for(const w of b.weights||[])db.prepare('INSERT OR IGNORE INTO weights(id,user_id,weight,bmi,unit,date,created_at) VALUES(?,?,?,?,?,?,?)').run(String(w.id||id()),user.id,finite(w.weight,1,1000),finite(w.bmi,1,200),w.unit==='lb'?'lb':'kg',validDate(w.date||isoNow()),String(w.createdAt||isoNow())); for(const s of b.supplements||[])db.prepare('INSERT OR IGNORE INTO supplements(id,user_id,category,supplement_type,name,brand,form,quantity,unit,time,notes,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run(String(s.id||id()),user.id,cleanText(s.category,100)||'Custom',cleanText(s.supplementType,160)||'Custom Supplement',cleanText(s.name,200)||'Supplement',cleanText(s.brand,120),cleanText(s.form,60),finite(s.quantity,0,1000000),cleanText(s.unit,40)||'mg',validDate(s.time||isoNow()),cleanText(s.notes),String(s.createdAt||isoNow())); if(b.profile)saveProfile(user.id,b.profile); db.exec('COMMIT'); return json(res,200,{success:true}); }catch(e){db.exec('ROLLBACK');throw e;} }

  if(p==='/api/admin/users'&&req.method==='GET'){ if(!user.isAdmin)return json(res,403,{error:'Administrator required'}); return json(res,200,db.prepare('SELECT * FROM users ORDER BY created_at').all().map(publicUser)); }
  if(p==='/api/admin/stats'&&req.method==='GET'){ if(!user.isAdmin)return json(res,403,{error:'Administrator required'}); return json(res,200,{users:Number(db.prepare('SELECT COUNT(*) c FROM users').get().c),admins:Number(db.prepare('SELECT COUNT(*) c FROM users WHERE is_admin=1').get().c),sessions:Number(db.prepare('SELECT COUNT(*) c FROM sessions WHERE expires_at>?').get(isoNow()).c)}); }
  m=p.match(/^\/api\/admin\/users\/([^/]+)\/admin$/); if(m&&req.method==='PUT'){ if(!user.isAdmin)return json(res,403,{error:'Administrator required'}); if(m[1]===user.id)return json(res,400,{error:'Cannot change your own admin status'}); const target=db.prepare('SELECT * FROM users WHERE id=?').get(m[1]); if(!target)return json(res,404,{error:'User not found'}); if(target.is_admin&&Number(db.prepare('SELECT COUNT(*) c FROM users WHERE is_admin=1').get().c)<=1)return json(res,400,{error:'Cannot demote final administrator'}); db.prepare('UPDATE users SET is_admin=?,updated_at=? WHERE id=?').run(target.is_admin?0:1,isoNow(),m[1]); return json(res,200,{user:publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(m[1]))}); }
  m=p.match(/^\/api\/admin\/users\/([^/]+)$/); if(m&&req.method==='DELETE'){ if(!user.isAdmin)return json(res,403,{error:'Administrator required'}); if(m[1]===user.id)return json(res,400,{error:'Cannot delete your own account'}); db.prepare('DELETE FROM users WHERE id=?').run(m[1]); return json(res,200,{success:true}); }

  return json(res,404,{error:'API route not found'});
}

const MIME={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.ico':'image/x-icon'};
async function serveStatic(req,res,url){
  let rel=decodeURIComponent(url.pathname); if(rel==='/'||!path.extname(rel))rel='/index.html'; const target=path.resolve(STATIC_DIR,'.'+rel); if(!target.startsWith(path.resolve(STATIC_DIR)))return json(res,403,{error:'Forbidden'});
  try{ const data=await fsp.readFile(target); secHeaders(res); res.statusCode=200; res.setHeader('Content-Type',MIME[path.extname(target)]||'application/octet-stream'); res.setHeader('Cache-Control',path.basename(target)==='index.html'?'no-store':'public, max-age=3600'); res.end(data); }catch{ if(rel!=='/index.html'){ try{ const data=await fsp.readFile(path.join(STATIC_DIR,'index.html')); secHeaders(res); res.statusCode=200; res.setHeader('Content-Type','text/html; charset=utf-8'); return res.end(data);}catch{} } json(res,404,{error:'Not found'}); }
}

async function main(){
  initDb(); await migrateLegacy(); db.prepare('DELETE FROM sessions WHERE expires_at<=?').run(isoNow()); startBackupLoop();
  const server=http.createServer(async(req,res)=>{ try{ const url=new URL(req.url,`http://${req.headers.host||'localhost'}`); if(url.pathname==='/health'||url.pathname.startsWith('/api/'))await handleApi(req,res,url); else await serveStatic(req,res,url); }catch(e){ console.error(e); json(res,e.status||400,{error:e.status?e.message:'Request failed'}); } });
  server.listen(PORT,'0.0.0.0',()=>console.log(`FastTrack ${VERSION} listening on :${PORT}`));
  const stop=()=>server.close(()=>{try{db.exec('PRAGMA wal_checkpoint(TRUNCATE)');db.close()}catch{}process.exit(0)}); process.on('SIGTERM',stop); process.on('SIGINT',stop);
}
main().catch(e=>{console.error(e);process.exit(1)});
