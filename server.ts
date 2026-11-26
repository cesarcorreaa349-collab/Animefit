import express from 'express';
import crypto from 'crypto';
import fs from 'fs';
import http from 'http';
import os from 'os';
import path from 'path';
import { WebSocket, WebSocketServer } from 'ws';
import { CHARACTERS } from './src/data/characters.ts';
import { SEED_GROUPS, SEED_USERS } from './src/data/exercises.ts';
import type { CommunityGroup, Routine, UserProfile } from './src/types/animefit.ts';

const PORT = Number(process.env.PORT || 3000);
const CWD_DATA_FILE = path.join(process.cwd(), '.animefit_db.json');
const TMP_DATA_FILE = path.join(os.tmpdir(), '.animefit_db.json');
const CWD_SESSIONS_FILE = path.join(process.cwd(), '.animefit_sessions.json');
const TMP_SESSIONS_FILE = path.join(os.tmpdir(), '.animefit_sessions.json');

function resolveWritableFilePath(preferred: string, fallback: string): string {
  try {
    const dir = path.dirname(preferred);
    fs.accessSync(dir, fs.constants.W_OK);
    if (fs.existsSync(preferred)) {
      fs.accessSync(preferred, fs.constants.W_OK);
    }
    return preferred;
  } catch {
    return fallback;
  }
}

const DATA_FILE = resolveWritableFilePath(CWD_DATA_FILE, TMP_DATA_FILE);
const SESSIONS_FILE = resolveWritableFilePath(CWD_SESSIONS_FILE, TMP_SESSIONS_FILE);
const SESSION_COOKIE = 'animefit_sid';
const EXCLUSIVE_GOKU_EMAIL = 'cesarcorreaa349@gmail.com';

interface DbUserRecord {
  username: string;
  email: string;
  pass?: string;
  passHash?: string;
  charId: string;
  xp: number;
  workoutsDone: number;
  prs: Record<string, number>;
  history: unknown[];
  friends: string[];
  groups: string[];
  customExercises: unknown[];
  routines: Routine[];
  storyRoutineId?: string;
  pvpWins?: number;
  pvpLosses?: number;
  story?: unknown;
  profileSetup?: unknown;
  wellness?: unknown;
  [key: string]: unknown;
}

interface DbShape {
  users: Record<string, DbUserRecord>;
  groups: CommunityGroup[];
  activeWorkouts: Record<string, unknown>;
}

interface SessionRecord {
  username: string;
  createdAt: number;
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${derived}`;
}

function verifyPassword(
  password: string,
  passHash?: string,
  legacyPlain?: string
): { valid: boolean; needsUpgrade: boolean } {
  if (typeof passHash === 'string' && passHash.startsWith('scrypt:')) {
    const parts = passHash.split(':');
    if (parts.length !== 3) return { valid: false, needsUpgrade: false };
    const [, salt, expectedHex] = parts;
    try {
      const derived = crypto.scryptSync(password, salt, 64);
      const expected = Buffer.from(expectedHex, 'hex');
      if (derived.length !== expected.length) {
        return { valid: false, needsUpgrade: false };
      }
      return {
        valid: crypto.timingSafeEqual(derived, expected),
        needsUpgrade: false,
      };
    } catch {
      return { valid: false, needsUpgrade: false };
    }
  }
  if (typeof legacyPlain === 'string' && legacyPlain.length > 0) {
    const a = Buffer.from(password, 'utf8');
    const b = Buffer.from(legacyPlain, 'utf8');
    if (a.length !== b.length) return { valid: false, needsUpgrade: false };
    const ok = crypto.timingSafeEqual(a, b);
    return { valid: ok, needsUpgrade: ok };
  }
  return { valid: false, needsUpgrade: false };
}

function hashSessionToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

let memorySessions: Record<string, SessionRecord> | null = null;

function readSessions(): Record<string, SessionRecord> {
  if (memorySessions) return memorySessions;
  try {
    const target = fs.existsSync(SESSIONS_FILE)
      ? SESSIONS_FILE
      : fs.existsSync(CWD_SESSIONS_FILE)
      ? CWD_SESSIONS_FILE
      : null;
    if (!target) {
      memorySessions = {};
      return memorySessions;
    }
    const raw = fs.readFileSync(target, 'utf8');
    if (!raw.trim()) {
      memorySessions = {};
      return memorySessions;
    }
    memorySessions = JSON.parse(raw) as Record<string, SessionRecord>;
    return memorySessions;
  } catch {
    memorySessions = {};
    return memorySessions;
  }
}

function writeSessions(sessions: Record<string, SessionRecord>): void {
  memorySessions = sessions;
  try {
    const tmpFile = `${SESSIONS_FILE}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(sessions), 'utf8');
    fs.renameSync(tmpFile, SESSIONS_FILE);
  } catch {
    // Keep in-memory sessions if filesystem is read-only
  }
}

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    try {
      out[k] = decodeURIComponent(v);
    } catch {
      out[k] = v;
    }
  }
  return out;
}

function isHttpsRequest(req: express.Request): boolean {
  return (
    req.secure ||
    req.get('x-forwarded-proto') === 'https' ||
    process.env.NODE_ENV === 'production'
  );
}

function buildCookieString(
  name: string,
  value: string,
  maxAgeSec: number,
  isHttps: boolean
): string {
  const attrs = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    `Max-Age=${maxAgeSec}`,
    'HttpOnly',
  ];
  if (isHttps) {
    attrs.push('Secure', 'SameSite=None', 'Partitioned');
  } else {
    attrs.push('SameSite=Lax');
  }
  return attrs.join('; ');
}

function setSessionCookie(
  req: express.Request,
  res: express.Response,
  token: string
): void {
  res.setHeader(
    'Set-Cookie',
    buildCookieString(SESSION_COOKIE, token, 31536000, isHttpsRequest(req))
  );
}

function clearSessionCookie(req: express.Request, res: express.Response): void {
  res.setHeader(
    'Set-Cookie',
    buildCookieString(SESSION_COOKIE, '', 0, isHttpsRequest(req))
  );
}

function isAllowedCorsOrigin(origin: string, serverHost?: string): boolean {
  try {
    const parsed = new URL(origin);
    if (serverHost && parsed.host === serverHost) return true;
    const configured = (process.env.ALLOWED_ORIGINS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (configured.includes(origin) || configured.includes(parsed.host)) {
      return true;
    }
    const hostname = parsed.hostname.toLowerCase();
    return (
      hostname === 'animefit-2.onrender.com' ||
      hostname.endsWith('.vercel.app') ||
      hostname.endsWith('.onrender.com') ||
      hostname.endsWith('.run.app') ||
      hostname === 'aistudio.google.com' ||
      hostname === 'localhost' ||
      hostname === '127.0.0.1'
    );
  } catch {
    return false;
  }
}

function verifyMutationOrigin(
  req: express.Request,
  res: express.Response
): boolean {
  const origin = req.get('origin');
  const host = req.get('x-forwarded-host') || req.get('host');
  if (origin) {
    if (!isAllowedCorsOrigin(origin, host)) {
      res.status(403).json({ error: 'Origen no permitido' });
      return false;
    }
    return true;
  }
  if (req.get('x-requested-with') !== 'animefit') {
    res.status(403).json({ error: 'Solicitud no autorizada' });
    return false;
  }
  return true;
}

function createServerSeedUsers(): Record<string, DbUserRecord> {
  const seeded: Record<string, DbUserRecord> = {};
  for (const [k, u] of Object.entries(SEED_USERS)) {
    const clone = JSON.parse(JSON.stringify(u)) as DbUserRecord;
    const rawPass = clone.pass || '123';
    delete clone.pass;
    clone.passHash = hashPassword(rawPass);
    seeded[k] = clone;
  }
  return seeded;
}

let memoryDb: DbShape | null = null;

function readPersistedState(): DbShape {
  if (memoryDb) return memoryDb;
  let dirty = false;
  let parsed: (DbShape & { sessionUser?: unknown }) | null = null;

  try {
    const target = fs.existsSync(DATA_FILE)
      ? DATA_FILE
      : fs.existsSync(CWD_DATA_FILE)
      ? CWD_DATA_FILE
      : null;
    if (target) {
      const raw = fs.readFileSync(target, 'utf8');
      if (raw.trim()) {
        parsed = JSON.parse(raw) as DbShape & { sessionUser?: unknown };
      }
    }
  } catch {
    parsed = null;
  }

  if (!parsed || !parsed.users) {
    const initial: DbShape = {
      users: createServerSeedUsers(),
      groups: JSON.parse(JSON.stringify(SEED_GROUPS)) as CommunityGroup[],
      activeWorkouts: {},
    };
    writePersistedState(initial);
    return initial;
  }

  if ('sessionUser' in parsed) {
    delete parsed.sessionUser;
    dirty = true;
  }

  if (!Array.isArray(parsed.groups)) {
    parsed.groups = JSON.parse(JSON.stringify(SEED_GROUPS)) as CommunityGroup[];
    dirty = true;
  }

  if (!parsed.activeWorkouts || typeof parsed.activeWorkouts !== 'object') {
    parsed.activeWorkouts = {};
    dirty = true;
  }

  // Ensure any existing plaintext passwords in persisted DB are hashed cleanly on server
  for (const u of Object.values(parsed.users)) {
    if (u && typeof u.pass === 'string' && u.pass.length > 0 && !u.passHash) {
      u.passHash = hashPassword(u.pass);
      delete u.pass;
      dirty = true;
    } else if (u && 'pass' in u) {
      delete u.pass;
      dirty = true;
    }
  }

  const clean: DbShape = {
    users: parsed.users,
    groups: parsed.groups,
    activeWorkouts: parsed.activeWorkouts,
  };
  memoryDb = clean;

  if (dirty) {
    writePersistedState(clean);
  }
  return clean;
}

function writePersistedState(state: DbShape): void {
  const sanitized: DbShape = {
    users: state.users || {},
    groups: state.groups || [],
    activeWorkouts: state.activeWorkouts || {},
  };
  memoryDb = sanitized;
  try {
    const tmpFile = `${DATA_FILE}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(sanitized), 'utf8');
    fs.renameSync(tmpFile, DATA_FILE);
  } catch {
    // Keep in-memory state if filesystem is read-only
  }
}

function resolveUsernameKey(
  users: Record<string, DbUserRecord>,
  candidate: string | null | undefined
): string | null {
  if (!candidate) return null;
  if (users[candidate]) return candidate;
  const lower = candidate.trim().toLowerCase();
  const found = Object.values(users).find(
    (u) => u.username.toLowerCase() === lower
  );
  return found ? found.username : null;
}

function getAuthenticatedUsername(
  cookieHeader: string | undefined,
  db: DbShape
): string | null {
  const cookies = parseCookies(cookieHeader);
  const token = cookies[SESSION_COOKIE];
  if (!token) return null;
  const sessions = readSessions();
  const rec = sessions[hashSessionToken(token)];
  if (!rec) return null;
  return resolveUsernameKey(db.users, rec.username);
}

function sanitizeSelfUser(u: DbUserRecord): UserProfile {
  const clone = JSON.parse(JSON.stringify(u)) as DbUserRecord;
  delete clone.pass;
  delete clone.passHash;
  return clone as unknown as UserProfile;
}

function sanitizePublicUsers(
  users: Record<string, DbUserRecord>
): Record<string, UserProfile> {
  const out: Record<string, UserProfile> = {};
  for (const [key, u] of Object.entries(users)) {
    out[key] = {
      username: u.username,
      email: '',
      charId: u.charId || 'goku',
      xp: Number(u.xp || 0),
      workoutsDone: Number(u.workoutsDone || 0),
      prs: (u.prs || {}) as Record<string, number>,
      history: [],
      friends: Array.isArray(u.friends) ? u.friends : [],
      groups: Array.isArray(u.groups) ? u.groups : [],
      customExercises: Array.isArray(u.customExercises)
        ? (u.customExercises as UserProfile['customExercises'])
        : [],
      routines: Array.isArray(u.routines)
        ? u.routines.filter((r) => Boolean(r?.published))
        : [],
      pvpWins: Number(u.pvpWins || 0),
      pvpLosses: Number(u.pvpLosses || 0),
    };
  }
  return out;
}

function getLevelFromXp(xp: number): number {
  let level = 1;
  let remaining = Math.max(0, xp || 0);
  let needed = 120;
  while (remaining >= needed && level < 150) {
    remaining -= needed;
    level++;
    needed = Math.floor(120 * Math.pow(1.12, level - 1));
  }
  return level;
}

interface FighterSeed {
  username: string;
  charId: string;
  stageName: string;
  level: number;
  workoutsDone: number;
  prsCount: number;
}

interface PvpFighterState {
  username: string;
  charId: string;
  stageName: string;
  level: number;
  hp: number;
  maxHp: number;
  baseAtk: number;
  critChance: number;
  aura: number;
  guarding: boolean;
}

interface PvpClashState {
  initiator: string;
  endsAt: number;
  taps: Record<string, number>;
}

interface PvpMatchState {
  id: string;
  status: 'active' | 'finished';
  turn: string;
  round: number;
  winner: string | null;
  players: Record<string, PvpFighterState>;
  playerOrder: [string, string];
  clash: PvpClashState | null;
  log: string[];
  rewardsGranted?: boolean;
}

interface OnlineEntry {
  ws: WebSocket;
  seed: FighterSeed;
}

interface PendingInvite {
  id: string;
  fromUsername: string;
  fromCharId: string;
  fromLevel: number;
  toUsername: string;
  createdAt: number;
}

interface PvpRoom {
  code: string;
  hostUsername: string;
  createdAt: number;
}

function buildFighterState(seed: FighterSeed): PvpFighterState {
  const db = readPersistedState();
  const dbUser = db.users?.[seed.username];
  const level = dbUser ? getLevelFromXp(Number(dbUser.xp || 0)) : seed.level;
  const workoutsDone = dbUser ? Number(dbUser.workoutsDone || 0) : seed.workoutsDone;
  const prsCount = dbUser && dbUser.prs ? Object.keys(dbUser.prs).length : seed.prsCount;
  const charId = (dbUser?.charId as string) || seed.charId || 'goku';

  const maxHp = Math.round(140 + level * 16 + workoutsDone * 4 + prsCount * 6);
  const baseAtk = Math.round(22 + level * 4 + Math.min(26, workoutsDone * 1.4));
  const critChance = Math.min(0.45, 0.16 + prsCount * 0.015);

  return {
    username: seed.username,
    charId,
    stageName: seed.stageName || 'Guerrero Base',
    level,
    hp: maxHp,
    maxHp,
    baseAtk,
    critChance,
    aura: 35,
    guarding: false,
  };
}

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);
  app.use((req, res, next) => {
    res.setHeader('Permissions-Policy', 'accelerometer=*, gyroscope=*');
    const origin = req.get('origin');
    const host = req.get('x-forwarded-host') || req.get('host');
    if (origin && isAllowedCorsOrigin(origin, host)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader(
        'Access-Control-Allow-Methods',
        'GET,POST,PUT,DELETE,OPTIONS'
      );
      res.setHeader(
        'Access-Control-Allow-Headers',
        'Content-Type, X-Requested-With, Authorization'
      );
    }
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });
  app.use(express.json({ limit: '5mb' }));
  app.use(express.text({ type: 'text/plain', limit: '5mb' }));

  // Clean up any legacy sessionUser in .animefit_db.json immediately on boot
  readPersistedState();

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/api/auth/me', (req, res) => {
    const db = readPersistedState();
    const uname = getAuthenticatedUsername(req.headers.cookie, db);
    const me = uname ? db.users[uname] : null;
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      user: me ? sanitizeSelfUser(me) : null,
      activeWorkout: uname ? db.activeWorkouts[uname] || null : null,
      groups: db.groups || [],
      publicUsers: sanitizePublicUsers(db.users),
    });
  });

  app.post('/api/auth/login', (req, res) => {
    if (!verifyMutationOrigin(req, res)) return;
    const body = (req.body || {}) as { identifier?: unknown; password?: unknown };
    const identifier = String(body.identifier || '').trim();
    const lowerId = identifier.toLowerCase();
    const password = String(body.password || '').trim();

    if (!identifier || !password) {
      res.status(400).json({ error: 'Ingresa tu usuario/correo y contraseña.' });
      return;
    }

    const db = readPersistedState();
    const found =
      db.users[identifier] ||
      Object.values(db.users).find(
        (u) =>
          u.username.toLowerCase() === lowerId ||
          (u.email || '').toLowerCase() === lowerId
      );

    if (!found) {
      res.status(401).json({ error: 'Usuario/correo o contraseña incorrectos.' });
      return;
    }

    const check = verifyPassword(password, found.passHash, found.pass);
    if (!check.valid) {
      res.status(401).json({ error: 'Usuario/correo o contraseña incorrectos.' });
      return;
    }

    if (check.needsUpgrade) {
      found.passHash = hashPassword(password);
      delete found.pass;
      writePersistedState(db);
    }

    const token = crypto.randomBytes(32).toString('hex');
    const sessions = readSessions();
    sessions[hashSessionToken(token)] = {
      username: found.username,
      createdAt: Date.now(),
    };
    writeSessions(sessions);
    setSessionCookie(req, res, token);

    res.json({
      user: sanitizeSelfUser(found),
      activeWorkout: db.activeWorkouts[found.username] || null,
      groups: db.groups || [],
      publicUsers: sanitizePublicUsers(db.users),
    });
  });

  app.post('/api/auth/register', (req, res) => {
    if (!verifyMutationOrigin(req, res)) return;
    const body = (req.body || {}) as {
      username?: unknown;
      email?: unknown;
      password?: unknown;
    };
    const username = String(body.username || '').trim();
    const rawEmail = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '').trim();

    if (username.length < 3 || password.length < 3) {
      res
        .status(400)
        .json({ error: 'Usuario y contraseña deben tener al menos 3 caracteres.' });
      return;
    }

    if (rawEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) {
      res.status(400).json({ error: 'Ingresa un correo electrónico válido.' });
      return;
    }

    const email = rawEmail || `${username.toLowerCase()}@animefit.local`;
    const db = readPersistedState();

    const usernameTaken = Object.keys(db.users).some(
      (existing) => existing.toLowerCase() === username.toLowerCase()
    );
    if (usernameTaken) {
      res
        .status(409)
        .json({ error: 'Ese nombre de usuario ya está en uso. Elige otro.' });
      return;
    }

    if (rawEmail) {
      const emailTaken = Object.values(db.users).some(
        (u) => (u.email || '').toLowerCase() === rawEmail
      );
      if (emailTaken) {
        res.status(409).json({
          error: 'Ese correo electrónico ya está registrado. Inicia sesión.',
        });
        return;
      }
    }

    const nonGokuPool = CHARACTERS.filter((c) => c.id !== 'goku');
    const assignedChar =
      email === EXCLUSIVE_GOKU_EMAIL
        ? CHARACTERS.find((c) => c.id === 'goku') || CHARACTERS[0]
        : nonGokuPool[Math.floor(Math.random() * nonGokuPool.length)] ||
          CHARACTERS[0];

    const newUser: DbUserRecord = {
      username,
      email,
      passHash: hashPassword(password),
      charId: assignedChar.id,
      xp: 0,
      workoutsDone: 0,
      prs: {},
      history: [],
      friends: [],
      groups: [],
      customExercises: [],
      routines: [
        {
          id: `r_starter_${Date.now()}`,
          name: 'Full Body Inicial (Guerrero Nv.1)',
          published: false,
          author: username,
          likes: 0,
          exercises: [
            { exId: 'm_chest_press', sets: 3, targetReps: '10-12' },
            { exId: 'm_lat_pulldown_wide', sets: 3, targetReps: '10-12' },
            { exId: 'm_leg_press_45', sets: 3, targetReps: '10-12' },
            { exId: 'm_shoulder_press', sets: 3, targetReps: '10' },
            { exId: 'm_ab_crunch', sets: 3, targetReps: '15' },
          ],
        },
      ],
    };

    db.users[username] = newUser;
    writePersistedState(db);

    const token = crypto.randomBytes(32).toString('hex');
    const sessions = readSessions();
    sessions[hashSessionToken(token)] = {
      username,
      createdAt: Date.now(),
    };
    writeSessions(sessions);
    setSessionCookie(req, res, token);

    res.json({
      user: sanitizeSelfUser(newUser),
      activeWorkout: null,
      groups: db.groups || [],
      publicUsers: sanitizePublicUsers(db.users),
    });
  });

  app.post('/api/auth/logout', (req, res) => {
    if (!verifyMutationOrigin(req, res)) return;
    const cookies = parseCookies(req.headers.cookie);
    const token = cookies[SESSION_COOKIE];
    if (token) {
      const sessions = readSessions();
      const h = hashSessionToken(token);
      if (sessions[h]) {
        delete sessions[h];
        writeSessions(sessions);
      }
    }
    clearSessionCookie(req, res);
    res.json({ ok: true });
  });

  app.post('/api/auth/change-password', (req, res) => {
    if (!verifyMutationOrigin(req, res)) return;
    const db = readPersistedState();
    const uname = getAuthenticatedUsername(req.headers.cookie, db);
    if (!uname || !db.users[uname]) {
      res.status(401).json({ error: 'Sesión expirada o no iniciada.' });
      return;
    }

    const body = (req.body || {}) as {
      newPassword?: unknown;
    };
    const newPassword =
      typeof body.newPassword === 'string' ? body.newPassword.trim() : '';

    if (newPassword.length < 3 || newPassword.length > 128) {
      res.status(400).json({
        error: 'La nueva contraseña debe tener entre 3 y 128 caracteres.',
      });
      return;
    }

    const userRecord = db.users[uname];
    userRecord.passHash = hashPassword(newPassword);
    delete userRecord.pass;
    writePersistedState(db);

    // Rotate session tokens for this user and issue a fresh cookie
    const sessions = readSessions();
    const targetLower = uname.toLowerCase();
    for (const [h, rec] of Object.entries(sessions)) {
      if (rec.username.toLowerCase() === targetLower) {
        delete sessions[h];
      }
    }
    const freshToken = crypto.randomBytes(32).toString('hex');
    sessions[hashSessionToken(freshToken)] = {
      username: uname,
      createdAt: Date.now(),
    };
    writeSessions(sessions);
    setSessionCookie(req, res, freshToken);

    res.json({ ok: true });
  });

  app.delete('/api/auth/account', (req, res) => {
    if (!verifyMutationOrigin(req, res)) return;
    const db = readPersistedState();
    const uname = getAuthenticatedUsername(req.headers.cookie, db);
    if (!uname) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }

    const targetLower = uname.toLowerCase();
    const nextUsers: Record<string, DbUserRecord> = {};
    for (const [key, u] of Object.entries(db.users)) {
      if (key.toLowerCase() === targetLower || u.username.toLowerCase() === targetLower) {
        continue;
      }
      u.friends = (u.friends || []).filter((f) => f.toLowerCase() !== targetLower);
      nextUsers[key] = u;
    }
    db.users = nextUsers;
    delete db.activeWorkouts[uname];
    db.groups = (db.groups || []).map((g) => ({
      ...g,
      members: (g.members || []).filter((m) => m.toLowerCase() !== targetLower),
    }));
    writePersistedState(db);

    const sessions = readSessions();
    for (const [h, rec] of Object.entries(sessions)) {
      if (rec.username.toLowerCase() === targetLower) {
        delete sessions[h];
      }
    }
    writeSessions(sessions);
    clearSessionCookie(req, res);
    res.json({ ok: true });
  });

  function sanitizeWellnessPayload(
    incomingRaw: unknown,
    existingRaw: unknown
  ): Record<string, unknown> | undefined {
    if (!incomingRaw || typeof incomingRaw !== 'object') {
      return existingRaw && typeof existingRaw === 'object'
        ? (existingRaw as Record<string, unknown>)
        : undefined;
    }

    const incoming = incomingRaw as Record<string, unknown>;
    const existing =
      existingRaw && typeof existingRaw === 'object'
        ? (existingRaw as Record<string, unknown>)
        : {};

    const stepGoal = Math.max(
      3000,
      Math.min(50000, Math.round(Number(incoming.stepGoal) || Number(existing.stepGoal) || 8000))
    );
    const sleepGoal = Math.max(
      4,
      Math.min(14, Math.round((Number(incoming.sleepGoal) || Number(existing.sleepGoal) || 8) * 10) / 10)
    );

    const existingLogs =
      existing.logs && typeof existing.logs === 'object'
        ? (existing.logs as Record<string, Record<string, unknown>>)
        : {};
    const incomingLogs =
      incoming.logs && typeof incoming.logs === 'object'
        ? (incoming.logs as Record<string, Record<string, unknown>>)
        : {};

    const mergedLogs: Record<string, Record<string, unknown>> = { ...existingLogs };
    const dateKeys = Object.keys(incomingLogs)
      .filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k))
      .sort()
      .slice(-30);

    const validQualities = new Set(['mala', 'regular', 'buena', 'excelente']);

    for (const dateKey of dateKeys) {
      const entry = incomingLogs[dateKey];
      if (!entry || typeof entry !== 'object') continue;
      const prevEntry = existingLogs[dateKey];
      const prevSteps = Math.max(0, Math.round(Number(prevEntry?.steps) || 0));
      const requestedSteps = Math.max(
        0,
        Math.min(60000, Math.round(Number(entry.steps) || 0))
      );

      // Anti-cheat: steps only accumulate monotonically and cannot spike > 1500 in one sync
      const safeSteps = Math.max(
        prevSteps,
        Math.min(requestedSteps, prevSteps + 1500)
      );
      const safeLogStepGoal = Math.max(
        3000,
        Math.min(50000, Math.round(Number(entry.stepGoal) || stepGoal))
      );
      const safeSleepHours = Math.max(
        0,
        Math.min(24, Math.round((Number(entry.sleepHours) || 0) * 10) / 10)
      );
      const safeLogSleepGoal = Math.max(
        4,
        Math.min(14, Math.round((Number(entry.sleepGoal) || sleepGoal) * 10) / 10)
      );

      mergedLogs[dateKey] = {
        date: dateKey,
        steps: safeSteps,
        stepGoal: safeLogStepGoal,
        sleepHours: safeSleepHours,
        sleepGoal: safeLogSleepGoal,
        ...(typeof entry.sleepQuality === 'string' && validQualities.has(entry.sleepQuality)
          ? { sleepQuality: entry.sleepQuality }
          : prevEntry?.sleepQuality
          ? { sleepQuality: prevEntry.sleepQuality }
          : {}),
        ...(typeof entry.bedTime === 'string' && /^\d{2}:\d{2}$/.test(entry.bedTime)
          ? { bedTime: entry.bedTime }
          : {}),
        ...(typeof entry.wakeTime === 'string' && /^\d{2}:\d{2}$/.test(entry.wakeTime)
          ? { wakeTime: entry.wakeTime }
          : {}),
        stepsXpAwarded:
          Boolean(prevEntry?.stepsXpAwarded) ||
          (Boolean(entry.stepsXpAwarded) && safeSteps >= safeLogStepGoal),
        sleepXpAwarded:
          Boolean(prevEntry?.sleepXpAwarded) ||
          (Boolean(entry.sleepXpAwarded) &&
            safeSleepHours >= Math.min(safeLogSleepGoal, 7)),
      };
    }

    const recentKeys = Object.keys(mergedLogs).sort().slice(-30);
    const prunedLogs: Record<string, Record<string, unknown>> = {};
    for (const k of recentKeys) {
      prunedLogs[k] = mergedLogs[k];
    }

    return {
      stepGoal,
      sleepGoal,
      logs: prunedLogs,
    };
  }

  app.put('/api/user/sync', (req, res) => {
    if (!verifyMutationOrigin(req, res)) return;
    const db = readPersistedState();
    const uname = getAuthenticatedUsername(req.headers.cookie, db);
    if (!uname || !db.users[uname]) {
      res.status(401).json({ error: 'Sesión expirada o no iniciada' });
      return;
    }

    let rawBody: unknown = req.body;
    if (typeof rawBody === 'string') {
      try {
        rawBody = JSON.parse(rawBody);
      } catch {
        res.status(400).json({ error: 'Payload inválido' });
        return;
      }
    }

    const payload = (rawBody || {}) as {
      profile?: Partial<DbUserRecord>;
      activeWorkout?: unknown;
    };

    const existing = db.users[uname];
    if (payload.profile && typeof payload.profile === 'object') {
      const incoming = payload.profile;
      const sanitizedWellness = sanitizeWellnessPayload(
        incoming.wellness,
        existing.wellness
      );
      const merged: DbUserRecord = {
        ...existing,
        email: typeof incoming.email === 'string' ? incoming.email : existing.email,
        charId: typeof incoming.charId === 'string' ? incoming.charId : existing.charId,
        xp: Math.max(Number(existing.xp || 0), Number(incoming.xp || 0)),
        workoutsDone: Math.max(
          Number(existing.workoutsDone || 0),
          Number(incoming.workoutsDone || 0)
        ),
        pvpWins: Math.max(
          Number(existing.pvpWins || 0),
          Number(incoming.pvpWins || 0)
        ),
        pvpLosses: Math.max(
          Number(existing.pvpLosses || 0),
          Number(incoming.pvpLosses || 0)
        ),
        prs:
          incoming.prs && typeof incoming.prs === 'object'
            ? incoming.prs
            : existing.prs,
        history: Array.isArray(incoming.history) ? incoming.history : existing.history,
        friends: Array.isArray(incoming.friends) ? incoming.friends : existing.friends,
        groups: Array.isArray(incoming.groups) ? incoming.groups : existing.groups,
        customExercises: Array.isArray(incoming.customExercises)
          ? incoming.customExercises
          : existing.customExercises,
        routines: Array.isArray(incoming.routines)
          ? incoming.routines
          : existing.routines,
        storyRoutineId:
          typeof incoming.storyRoutineId === 'string'
            ? incoming.storyRoutineId
            : existing.storyRoutineId,
        story: incoming.story !== undefined ? incoming.story : existing.story,
        profileSetup:
          incoming.profileSetup !== undefined
            ? incoming.profileSetup
            : existing.profileSetup,
        wellness: sanitizedWellness,
        username: existing.username,
        passHash: existing.passHash,
      };
      delete merged.pass;
      db.users[uname] = merged;
    }

    if ('activeWorkout' in payload) {
      if (payload.activeWorkout && typeof payload.activeWorkout === 'object') {
        db.activeWorkouts[uname] = payload.activeWorkout;
      } else {
        delete db.activeWorkouts[uname];
      }
    }

    writePersistedState(db);
    res.json({
      ok: true,
      groups: db.groups,
      publicUsers: sanitizePublicUsers(db.users),
    });
  });

  app.post('/api/groups', (req, res) => {
    if (!verifyMutationOrigin(req, res)) return;
    const db = readPersistedState();
    const uname = getAuthenticatedUsername(req.headers.cookie, db);
    if (!uname) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }
    const body = (req.body || {}) as { name?: unknown; desc?: unknown };
    const name = String(body.name || '').trim();
    const desc = String(body.desc || '').trim();
    if (!name) {
      res.status(400).json({ error: 'Escribe un nombre para el grupo.' });
      return;
    }
    const group: CommunityGroup = {
      id: `grp_${Date.now()}`,
      name,
      desc: desc || 'Comunidad de entrenamiento AnimeFit',
      members: [uname],
    };
    db.groups = [group, ...(db.groups || [])];
    writePersistedState(db);
    res.json({ ok: true, groups: db.groups });
  });

  app.post('/api/groups/:groupId/toggle', (req, res) => {
    if (!verifyMutationOrigin(req, res)) return;
    const db = readPersistedState();
    const uname = getAuthenticatedUsername(req.headers.cookie, db);
    if (!uname) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }
    const groupId = String(req.params.groupId || '');
    db.groups = (db.groups || []).map((g) => {
      if (g.id !== groupId) return g;
      const isMember = (g.members || []).includes(uname);
      return {
        ...g,
        members: isMember
          ? g.members.filter((m) => m !== uname)
          : [...g.members, uname],
      };
    });
    writePersistedState(db);
    res.json({ ok: true, groups: db.groups });
  });

  app.get('/.well-known/assetlinks.json', (_req, res) => {
    const candidates = [
      path.join(process.cwd(), 'dist', '.well-known', 'assetlinks.json'),
      path.join(process.cwd(), 'public', '.well-known', 'assetlinks.json'),
    ];
    const target = candidates.find((p) => fs.existsSync(p));
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    if (target) {
      res.send(fs.readFileSync(target, 'utf8'));
      return;
    }
    res.send('[]');
  });

  const distDir = path.join(process.cwd(), 'dist');
  const isProdStart =
    process.env.NODE_ENV === 'production' ||
    (process.env.npm_lifecycle_event === 'start' &&
      fs.existsSync(path.join(distDir, 'index.html')));

  if (!isProdStart) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(
      express.static(distDir, {
        dotfiles: 'allow',
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('manifest.webmanifest')) {
            res.setHeader('Content-Type', 'application/manifest+json');
            res.setHeader('Cache-Control', 'no-cache');
          } else if (filePath.endsWith('sw.js')) {
            res.setHeader('Cache-Control', 'no-cache');
          } else if (filePath.endsWith('assetlinks.json')) {
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.setHeader('Cache-Control', 'no-cache');
          }
        },
      })
    );
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const server = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true });

  const onlineUsers = new Map<string, OnlineEntry>();
  const socketToUser = new Map<WebSocket, string>();
  const socketVerifiedUser = new Map<WebSocket, string>();
  const pendingInvites = new Map<string, PendingInvite>();
  const rooms = new Map<string, PvpRoom>();
  const matches = new Map<string, PvpMatchState>();
  const clashTimers = new Map<string, NodeJS.Timeout>();

  const sendToUser = (username: string, payload: unknown) => {
    const entry = onlineUsers.get(username);
    if (entry && entry.ws.readyState === WebSocket.OPEN) {
      entry.ws.send(JSON.stringify(payload));
    }
  };

  const broadcastPresence = () => {
    const list = Array.from(onlineUsers.values()).map((e) => ({
      username: e.seed.username,
      charId: e.seed.charId,
      stageName: e.seed.stageName,
      level: e.seed.level,
    }));
    for (const entry of onlineUsers.values()) {
      if (entry.ws.readyState === WebSocket.OPEN) {
        entry.ws.send(JSON.stringify({ type: 'pvp:presence', users: list }));
      }
    }
  };

  const broadcastMatch = (match: PvpMatchState) => {
    for (const uname of match.playerOrder) {
      sendToUser(uname, { type: 'pvp:match_state', match });
    }
  };

  const finishMatch = (match: PvpMatchState, winnerUsername: string, reason?: string) => {
    if (match.status === 'finished') return;
    const t = clashTimers.get(match.id);
    if (t) {
      clearTimeout(t);
      clashTimers.delete(match.id);
    }
    match.clash = null;
    match.status = 'finished';
    match.winner = winnerUsername;
    if (reason) {
      match.log = [reason, ...match.log.slice(0, 7)];
    }

    if (!match.rewardsGranted) {
      match.rewardsGranted = true;
      const db = readPersistedState();
      for (const uname of match.playerOrder) {
        const won = uname === winnerUsername;
        const xpEarned = won ? 80 : 35;
        let totalXp: number | undefined;
        let pvpWins: number | undefined;
        let pvpLosses: number | undefined;

        if (db?.users?.[uname]) {
          const u = db.users[uname];
          u.xp = Number(u.xp || 0) + xpEarned;
          u.pvpWins = Number(u.pvpWins || 0) + (won ? 1 : 0);
          u.pvpLosses = Number(u.pvpLosses || 0) + (won ? 0 : 1);
          totalXp = u.xp;
          pvpWins = u.pvpWins;
          pvpLosses = u.pvpLosses;
        }
        sendToUser(uname, {
          type: 'pvp:reward',
          matchId: match.id,
          won,
          xpEarned,
          totalXp,
          pvpWins,
          pvpLosses,
        });
      }
      if (db) {
        try {
          writePersistedState(db);
        } catch {
          // ignore disk errors
        }
      }
    }
    broadcastMatch(match);
  };

  const startMatch = (p1Seed: FighterSeed, p2Seed: FighterSeed) => {
    // End any stale match references for these players
    for (const [mId, m] of matches.entries()) {
      if (
        m.status === 'active' &&
        (m.playerOrder.includes(p1Seed.username) ||
          m.playerOrder.includes(p2Seed.username))
      ) {
        finishMatch(
          m,
          m.playerOrder[0],
          'Combate cerrado por inicio de nueva partida.'
        );
        matches.delete(mId);
      }
    }

    const p1 = buildFighterState(p1Seed);
    const p2 = buildFighterState(p2Seed);
    const id = `pvp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const match: PvpMatchState = {
      id,
      status: 'active',
      turn: p1.username,
      round: 1,
      winner: null,
      players: {
        [p1.username]: p1,
        [p2.username]: p2,
      },
      playerOrder: [p1.username, p2.username],
      clash: null,
      log: [`⚔️ ¡Duelo PvP iniciado: ${p1.username} vs ${p2.username}! Turno de ${p1.username}.`],
    };
    matches.set(id, match);
    broadcastMatch(match);
  };

  const resolveClash = (match: PvpMatchState) => {
    if (match.status !== 'active' || !match.clash) return;
    const t = clashTimers.get(match.id);
    if (t) {
      clearTimeout(t);
      clashTimers.delete(match.id);
    }

    const initiatorName = match.clash.initiator;
    const defenderName = match.playerOrder.find((n) => n !== initiatorName) || initiatorName;
    const initiator = match.players[initiatorName];
    const defender = match.players[defenderName];
    const initTaps = match.clash.taps[initiatorName] || 0;
    const defTaps = match.clash.taps[defenderName] || 0;

    match.clash = null;

    if (initTaps >= defTaps) {
      const dmg = Math.round(initiator.baseAtk * (initTaps > defTaps ? 2.25 : 1.75));
      const actualDmg = defender.guarding ? Math.round(dmg * 0.6) : dmg;
      defender.hp = Math.max(0, defender.hp - actualDmg);
      defender.guarding = false;
      match.log = [
        `🔥 ¡${initiator.username} ganó el Choque de Ki (${initTaps} vs ${defTaps} toques) e infligió -${actualDmg} HP a ${defender.username}!`,
        ...match.log.slice(0, 7),
      ];
      if (defender.hp <= 0) {
        finishMatch(match, initiator.username, `🏆 ¡${initiator.username} derrotó a ${defender.username} con Técnica Definitiva!`);
        return;
      }
    } else {
      const reflect = Math.round(defender.baseAtk * 1.1);
      initiator.hp = Math.max(0, initiator.hp - reflect);
      defender.guarding = false;
      match.log = [
        `🛡️ ¡${defender.username} ganó el Choque de Ki (${defTaps} vs ${initTaps} toques) y contraatacó por -${reflect} HP!`,
        ...match.log.slice(0, 7),
      ];
      if (initiator.hp <= 0) {
        finishMatch(match, defender.username, `🏆 ¡${defender.username} remontó en el Choque de Ki y venció!`);
        return;
      }
    }

    match.turn = defenderName;
    match.round += 1;
    broadcastMatch(match);
  };

  wss.on('connection', (ws: WebSocket) => {
    ws.on('message', (raw) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(String(raw)) as Record<string, unknown>;
      } catch {
        return;
      }

      const type = String(msg.type || '');
      const currentUsername = socketToUser.get(ws);

      if (type === 'pvp:auth') {
        const verified = socketVerifiedUser.get(ws);
        if (!verified) {
          ws.send(
            JSON.stringify({
              type: 'pvp:error',
              message: 'Debes iniciar sesión en tu cuenta para conectarte al PvP.',
            })
          );
          return;
        }
        const username = verified;
        const seed: FighterSeed = {
          username,
          charId: String(msg.charId || 'goku'),
          stageName: String(msg.stageName || 'Guerrero Base'),
          level: Number(msg.level || 1),
          workoutsDone: Number(msg.workoutsDone || 0),
          prsCount: Number(msg.prsCount || 0),
        };
        const prev = onlineUsers.get(username);
        if (prev && prev.ws !== ws) {
          socketToUser.delete(prev.ws);
        }
        onlineUsers.set(username, { ws, seed });
        socketToUser.set(ws, username);
        broadcastPresence();

        // Resend active match if player reconnected
        for (const m of matches.values()) {
          if (m.status === 'active' && m.playerOrder.includes(username)) {
            sendToUser(username, { type: 'pvp:match_state', match: m });
          }
        }
        // Resend pending invites
        for (const inv of pendingInvites.values()) {
          if (inv.toUsername === username) {
            sendToUser(username, { type: 'pvp:invite', invite: inv });
          }
        }
        return;
      }

      if (!currentUsername) return;
      const meEntry = onlineUsers.get(currentUsername);
      if (!meEntry) return;

      if (type === 'pvp:challenge') {
        const toUsername = String(msg.toUsername || '').trim();
        if (!toUsername || toUsername === currentUsername) return;
        const target = onlineUsers.get(toUsername);
        if (!target) {
          sendToUser(currentUsername, {
            type: 'pvp:error',
            message: `${toUsername} no está conectado en este momento. Comparte una Sala PvP para invitarlo.`,
          });
          return;
        }
        const invId = `inv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const invite: PendingInvite = {
          id: invId,
          fromUsername: currentUsername,
          fromCharId: meEntry.seed.charId,
          fromLevel: meEntry.seed.level,
          toUsername,
          createdAt: Date.now(),
        };
        pendingInvites.set(invId, invite);
        sendToUser(toUsername, { type: 'pvp:invite', invite });
        sendToUser(currentUsername, {
          type: 'pvp:invite_sent',
          toUsername,
        });
        return;
      }

      if (type === 'pvp:accept') {
        const inviteId = String(msg.inviteId || '');
        const inv = pendingInvites.get(inviteId);
        if (!inv || inv.toUsername !== currentUsername) return;
        pendingInvites.delete(inviteId);
        const challenger = onlineUsers.get(inv.fromUsername);
        if (!challenger) {
          sendToUser(currentUsername, {
            type: 'pvp:error',
            message: `${inv.fromUsername} se desconectó antes de iniciar el duelo.`,
          });
          return;
        }
        startMatch(challenger.seed, meEntry.seed);
        return;
      }

      if (type === 'pvp:decline') {
        const inviteId = String(msg.inviteId || '');
        const inv = pendingInvites.get(inviteId);
        if (!inv || inv.toUsername !== currentUsername) return;
        pendingInvites.delete(inviteId);
        sendToUser(inv.fromUsername, {
          type: 'pvp:invite_declined',
          byUsername: currentUsername,
        });
        return;
      }

      if (type === 'pvp:create_room') {
        // Clear existing room hosted by this user
        for (const [c, r] of rooms.entries()) {
          if (r.hostUsername === currentUsername) rooms.delete(c);
        }
        const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 5; i++) {
          code += alphabet[Math.floor(Math.random() * alphabet.length)];
        }
        rooms.set(code, { code, hostUsername: currentUsername, createdAt: Date.now() });
        sendToUser(currentUsername, { type: 'pvp:room_created', code });
        return;
      }

      if (type === 'pvp:join_room') {
        const code = String(msg.code || '').trim().toUpperCase();
        const room = rooms.get(code);
        if (!room) {
          sendToUser(currentUsername, {
            type: 'pvp:error',
            message: `No existe ninguna Sala PvP activa con el código "${code}".`,
          });
          return;
        }
        if (room.hostUsername === currentUsername) {
          sendToUser(currentUsername, {
            type: 'pvp:error',
            message: 'Ya eres el anfitrión de esa sala. Comparte el código con tu amigo.',
          });
          return;
        }
        const host = onlineUsers.get(room.hostUsername);
        if (!host) {
          rooms.delete(code);
          sendToUser(currentUsername, {
            type: 'pvp:error',
            message: 'El anfitrión se desconectó. Pídele que cree otra sala.',
          });
          return;
        }
        rooms.delete(code);
        startMatch(host.seed, meEntry.seed);
        return;
      }

      if (type === 'pvp:action') {
        const matchId = String(msg.matchId || '');
        const action = String(msg.action || '');
        const match = matches.get(matchId);
        if (!match || match.status !== 'active') return;
        if (match.clash || match.turn !== currentUsername) return;

        const attacker = match.players[currentUsername];
        const opponentName = match.playerOrder.find((n) => n !== currentUsername) || currentUsername;
        const defender = match.players[opponentName];
        if (!attacker || !defender) return;

        if (action === 'strike') {
          const isCrit = Math.random() < attacker.critChance;
          const rawDmg = Math.round(
            attacker.baseAtk * (0.9 + Math.random() * 0.25) * (isCrit ? 1.5 : 1)
          );
          const guardMult = defender.guarding ? 0.35 : 1;
          const dmg = Math.max(4, Math.round(rawDmg * guardMult));
          defender.hp = Math.max(0, defender.hp - dmg);
          attacker.aura = Math.min(100, attacker.aura + 30);

          let logLine = isCrit
            ? `⚡ ¡CRÍTICO de ${attacker.username}! -${dmg} HP a ${defender.username}.`
            : `👊 ${attacker.username} conectó Golpe de Ki (-${dmg} HP).`;

          if (defender.guarding) {
            const counter = Math.round(defender.baseAtk * 0.5);
            attacker.hp = Math.max(0, attacker.hp - counter);
            defender.guarding = false;
            logLine = `🛡️ ${defender.username} bloqueó (-${dmg} HP) y contraatacó por -${counter} HP.`;
          }
          attacker.guarding = false;
          match.log = [logLine, ...match.log.slice(0, 7)];

          if (defender.hp <= 0) {
            finishMatch(match, attacker.username, `🏆 ¡${attacker.username} ganó el duelo PvP!`);
            return;
          }
          if (attacker.hp <= 0) {
            finishMatch(match, defender.username, `🏆 ¡${defender.username} ganó con su contraataque!`);
            return;
          }
          match.turn = opponentName;
          match.round += 1;
          broadcastMatch(match);
          return;
        }

        if (action === 'guard') {
          const heal = Math.round(attacker.maxHp * 0.08);
          attacker.hp = Math.min(attacker.maxHp, attacker.hp + heal);
          attacker.aura = Math.min(100, attacker.aura + 20);
          attacker.guarding = true;
          match.log = [
            `🛡️ ${attacker.username} adoptó Guardia (+${heal} HP, +20% Ki).`,
            ...match.log.slice(0, 7),
          ];
          match.turn = opponentName;
          match.round += 1;
          broadcastMatch(match);
          return;
        }

        if (action === 'ultimate') {
          if (attacker.aura < 100) return;
          attacker.aura = 0;
          attacker.guarding = false;
          match.clash = {
            initiator: attacker.username,
            endsAt: Date.now() + 3500,
            taps: {
              [attacker.username]: 1,
              [defender.username]: 0,
            },
          };
          match.log = [
            `🔥 ¡${attacker.username} lanzó Técnica Definitiva! ¡Ambos jugadores toquen rápido para ganar el Choque de Ki!`,
            ...match.log.slice(0, 7),
          ];
          broadcastMatch(match);
          const timer = setTimeout(() => resolveClash(match), 3550);
          clashTimers.set(match.id, timer);
          return;
        }
      }

      if (type === 'pvp:clash_tap') {
        const matchId = String(msg.matchId || '');
        const match = matches.get(matchId);
        if (!match || match.status !== 'active' || !match.clash) return;
        if (!match.playerOrder.includes(currentUsername)) return;
        match.clash.taps[currentUsername] = (match.clash.taps[currentUsername] || 0) + 1;
        broadcastMatch(match);
        return;
      }

      if (type === 'pvp:forfeit') {
        const matchId = String(msg.matchId || '');
        const match = matches.get(matchId);
        if (!match || match.status !== 'active') return;
        if (!match.playerOrder.includes(currentUsername)) return;
        const opponentName = match.playerOrder.find((n) => n !== currentUsername) || currentUsername;
        finishMatch(match, opponentName, `🏳️ ${currentUsername} se retiró. ¡Victoria para ${opponentName}!`);
        return;
      }
    });

    ws.on('close', () => {
      const uname = socketToUser.get(ws);
      socketToUser.delete(ws);
      socketVerifiedUser.delete(ws);
      if (uname) {
        const current = onlineUsers.get(uname);
        if (current && current.ws === ws) {
          onlineUsers.delete(uname);
        }
        for (const [c, r] of rooms.entries()) {
          if (r.hostUsername === uname) rooms.delete(c);
        }
        broadcastPresence();
      }
    });
  });

  server.on('upgrade', (request, socket, head) => {
    const reqUrl = request.url || '';
    if (reqUrl.startsWith('/ws/pvp')) {
      const db = readPersistedState();
      const verified = getAuthenticatedUsername(request.headers.cookie, db);
      wss.handleUpgrade(request, socket, head, (ws) => {
        if (verified) {
          socketVerifiedUser.set(ws, verified);
        }
        wss.emit('connection', ws, request);
      });
    }
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`AnimeFit server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
