import express from 'express';
import crypto from 'crypto';
import fs from 'fs';
import http from 'http';
import os from 'os';
import path from 'path';
import { WebSocket, WebSocketServer } from 'ws';
import { CHARACTERS } from './src/data/characters.ts';
import {
  computeTrainingPvpBonus,
  getCharacterPhaseMoveset,
} from './src/data/movesets.ts';
import { SEED_GROUPS, SEED_USERS } from './src/data/exercises.ts';
import type {
  CommunityGroup,
  FriendNotification,
  Routine,
  UserProfile,
} from './src/types/animefit.ts';

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
  oneRmRecords?: Record<string, number>;
  history: unknown[];
  friends: string[];
  friendNotifications?: FriendNotification[];
  groups: string[];
  customExercises: unknown[];
  routines: Routine[];
  routineFolders?: unknown[];
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

const WS_SIGNING_SECRET =
  process.env.SESSION_SECRET?.trim() || crypto.randomBytes(32).toString('hex');

function signWsToken(username: string, ttlMs = 10 * 60 * 1000): string {
  const payload = Buffer.from(
    JSON.stringify({ u: username, exp: Date.now() + ttlMs }),
    'utf8'
  ).toString('base64url');
  const sig = crypto
    .createHmac('sha256', WS_SIGNING_SECRET)
    .update(payload)
    .digest('base64url');
  return `${payload}.${sig}`;
}

function verifyWsToken(
  token: string | null | undefined,
  db: DbShape
): string | null {
  if (!token || typeof token !== 'string') return null;
  const dotIdx = token.indexOf('.');
  if (dotIdx <= 0) return null;
  const payload = token.slice(0, dotIdx);
  const sig = token.slice(dotIdx + 1);
  if (!payload || !sig) return null;
  try {
    const expectedSig = crypto
      .createHmac('sha256', WS_SIGNING_SECRET)
      .update(payload)
      .digest('base64url');
    const a = Buffer.from(sig, 'utf8');
    const b = Buffer.from(expectedSig, 'utf8');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return null;
    }
    const parsed = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf8')
    ) as { u?: unknown; exp?: unknown };
    if (
      typeof parsed.u !== 'string' ||
      typeof parsed.exp !== 'number' ||
      parsed.exp <= Date.now()
    ) {
      return null;
    }
    return resolveUsernameKey(db.users, parsed.u);
  } catch {
    return null;
  }
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
    if (
      origin.startsWith('capacitor://') ||
      origin.startsWith('ionic://') ||
      origin.startsWith('file://')
    ) {
      return true;
    }
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
  if (origin && origin !== 'null') {
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

function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader || typeof authHeader !== 'string') return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const token = match[1].trim();
  return token || null;
}

function getAuthenticatedUsername(
  headersOrCookie:
    | string
    | { cookie?: string; authorization?: string }
    | undefined,
  db: DbShape
): string | null {
  const cookieHeader =
    typeof headersOrCookie === 'string'
      ? headersOrCookie
      : headersOrCookie?.cookie;
  const authHeader =
    typeof headersOrCookie === 'object' && headersOrCookie
      ? headersOrCookie.authorization
      : undefined;

  const bearerToken = extractBearerToken(authHeader);
  const cookies = parseCookies(cookieHeader);
  const cookieToken = cookies[SESSION_COOKIE];
  const sessions = readSessions();

  for (const candidate of [bearerToken, cookieToken]) {
    if (!candidate) continue;
    const rec = sessions[hashSessionToken(candidate)];
    if (!rec) continue;
    const resolved = resolveUsernameKey(db.users, rec.username);
    if (resolved) return resolved;
  }
  return null;
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
  auraColor?: string;
  ultBoostPct?: number;
  streakLabel?: string | null;
  streakCount?: number;
}

interface PvpClashState {
  initiator: string;
  endsAt: number;
  taps: Record<string, number>;
}

interface PvpPlayerConnectionStatus {
  connected: boolean;
  reconnectingUntil?: number | null;
}

interface PvpCombatEvent {
  id: string;
  actor: string;
  target?: string;
  action:
    | 'strike'
    | 'special'
    | 'guard'
    | 'ultimate'
    | 'clash_win'
    | 'clash_reflect'
    | 'timeout'
    | 'forfeit'
    | 'disconnect';
  damage?: number;
  heal?: number;
  auraGain?: number;
  crit?: boolean;
  blocked?: boolean;
  skillName?: string;
  auraColor?: string;
  label: string;
}

interface PvpMatchState {
  id: string;
  status: 'active' | 'finished';
  turn: string;
  turnEndsAt?: number;
  turnDurationMs?: number;
  round: number;
  winner: string | null;
  players: Record<string, PvpFighterState>;
  playerOrder: [string, string];
  playerStatus?: Record<string, PvpPlayerConnectionStatus>;
  clash: PvpClashState | null;
  lastEvent?: PvpCombatEvent | null;
  damageDealt?: Record<string, number>;
  xpRewards?: Record<string, number>;
  rematchRequestedBy?: string[];
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
  hostDisconnectedAt?: number | null;
}

function buildFighterState(seed: FighterSeed): PvpFighterState {
  const db = readPersistedState();
  const dbUser = db.users?.[seed.username];
  const level = dbUser ? getLevelFromXp(Number(dbUser.xp || 0)) : seed.level;
  const workoutsDone = dbUser ? Number(dbUser.workoutsDone || 0) : seed.workoutsDone;
  const prsCount = dbUser && dbUser.prs ? Object.keys(dbUser.prs).length : seed.prsCount;
  const charId = (dbUser?.charId as string) || seed.charId || 'goku';
  const historyDates = Array.isArray(dbUser?.history)
    ? dbUser.history.map((h) => String((h as { date?: unknown })?.date || ''))
    : [];

  const moveset = getCharacterPhaseMoveset(charId, level, seed.stageName);
  const bonus = computeTrainingPvpBonus(workoutsDone, historyDates);

  const maxHp = Math.round(140 + level * 16 + workoutsDone * 4 + prsCount * 6);
  const baseAtk = Math.round(22 + level * 4 + Math.min(26, workoutsDone * 1.4));
  const critChance = Math.min(0.45, 0.16 + prsCount * 0.015);

  return {
    username: seed.username,
    charId,
    stageName: moveset.stageName || seed.stageName || 'Guerrero Base',
    level,
    hp: maxHp,
    maxHp,
    baseAtk,
    critChance,
    aura: Math.min(50, 35 + bonus.bonusAura),
    guarding: false,
    auraColor: moveset.accentColor,
    ultBoostPct: bonus.ultBoostPct,
    streakLabel: bonus.badgeLabel,
    streakCount: bonus.streakCount,
  };
}

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);
  const onlineUsers = new Map<string, OnlineEntry>();
  const sendToUser = (username: string, payload: unknown) => {
    const entry = onlineUsers.get(username);
    if (entry && entry.ws.readyState === WebSocket.OPEN) {
      entry.ws.send(JSON.stringify(payload));
    }
  };
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
    const uname = getAuthenticatedUsername(req.headers, db);
    const me = uname ? db.users[uname] : null;
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      user: me ? sanitizeSelfUser(me) : null,
      activeWorkout: uname ? db.activeWorkouts[uname] || null : null,
      groups: db.groups || [],
      publicUsers: sanitizePublicUsers(db.users),
      wsToken: uname ? signWsToken(uname) : null,
    });
  });

  app.get('/api/auth/ws-token', (req, res) => {
    const db = readPersistedState();
    const uname = getAuthenticatedUsername(req.headers, db);
    res.setHeader('Cache-Control', 'no-store');
    if (!uname || !db.users[uname]) {
      res.status(401).json({ error: 'Sesión expirada o no iniciada.' });
      return;
    }
    res.json({
      ok: true,
      username: uname,
      wsToken: signWsToken(uname),
    });
  });

  const handleAutoHydrateProfile = (req: express.Request, res: express.Response) => {
    if (!verifyMutationOrigin(req, res)) return;
    res.setHeader('Cache-Control', 'no-store');

    const body = (req.body || {}) as {
      profile?: Partial<DbUserRecord>;
      activeWorkout?: unknown;
    };
    const incoming = body.profile;
    if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) {
      res.status(400).json({ error: 'Perfil requerido para sincronizar.' });
      return;
    }

    const rawUsername = String(incoming.username || '').trim();
    if (
      rawUsername.length < 3 ||
      rawUsername.length > 48 ||
      rawUsername === '__proto__' ||
      rawUsername === 'constructor' ||
      rawUsername === 'prototype'
    ) {
      res.status(400).json({ error: 'Nombre de usuario inválido.' });
      return;
    }

    const db = readPersistedState();
    const existingKey = resolveUsernameKey(db.users, rawUsername);
    const incomingEmail = String(incoming.email || '').trim().toLowerCase();

    if (existingKey && db.users[existingKey]) {
      const existing = db.users[existingKey];
      const existingEmail = String(existing.email || '').trim().toLowerCase();
      const hasRealExistingEmail =
        Boolean(existingEmail) && !existingEmail.endsWith('@animefit.local');
      const hasRealIncomingEmail =
        Boolean(incomingEmail) && !incomingEmail.endsWith('@animefit.local');
      const emailMatches =
        !hasRealExistingEmail ||
        !hasRealIncomingEmail ||
        existingEmail === incomingEmail;

      if (!emailMatches) {
        res.status(403).json({
          error: 'No se pudo validar automáticamente este perfil en el servidor.',
        });
        return;
      }

      const merged = mergeIncomingProfileIntoRecord(existing, incoming, db);
      db.users[existingKey] = merged;
      if (
        'activeWorkout' in body &&
        body.activeWorkout &&
        typeof body.activeWorkout === 'object' &&
        !db.activeWorkouts[existingKey]
      ) {
        db.activeWorkouts[existingKey] = body.activeWorkout;
      }
      writePersistedState(db);

      const token = crypto.randomBytes(32).toString('hex');
      const sessions = readSessions();
      sessions[hashSessionToken(token)] = {
        username: existingKey,
        createdAt: Date.now(),
      };
      writeSessions(sessions);
      setSessionCookie(req, res, token);

      res.json({
        ok: true,
        hydrated: true,
        user: sanitizeSelfUser(merged),
        activeWorkout: db.activeWorkouts[existingKey] || null,
        groups: db.groups || [],
        publicUsers: sanitizePublicUsers(db.users),
        sessionToken: token,
        wsToken: signWsToken(existingKey),
      });
      return;
    }

    // Server memory/ephemeral disk was reset (e.g. Render cold start):
    // silently recreate the full user record from the client's cached profile without password.
    const safeEmail =
      incomingEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(incomingEmail)
        ? incomingEmail
        : `${rawUsername.toLowerCase()}@animefit.local`;

    const baseRecord: DbUserRecord = {
      username: rawUsername,
      email: safeEmail,
      passHash: hashPassword(crypto.randomBytes(24).toString('hex')),
      charId:
        typeof incoming.charId === 'string' && incoming.charId.trim()
          ? incoming.charId.trim()
          : 'goku',
      xp: Math.max(0, Number(incoming.xp || 0) || 0),
      workoutsDone: Math.max(0, Number(incoming.workoutsDone || 0) || 0),
      prs:
        incoming.prs && typeof incoming.prs === 'object' && !Array.isArray(incoming.prs)
          ? (incoming.prs as Record<string, number>)
          : {},
      oneRmRecords: sanitizeOneRmRecordsPayload(incoming.oneRmRecords, {}),
      history: Array.isArray(incoming.history) ? incoming.history.slice(-80) : [],
      friends: Array.isArray(incoming.friends)
        ? incoming.friends
            .map((f) => resolveUsernameKey(db.users, String(f || '')))
            .filter((f): f is string => Boolean(f && f !== rawUsername))
        : [],
      friendNotifications: [],
      groups: Array.isArray(incoming.groups) ? incoming.groups : [],
      customExercises: Array.isArray(incoming.customExercises)
        ? incoming.customExercises
        : [],
      routines: Array.isArray(incoming.routines) ? incoming.routines : [],
      routineFolders: Array.isArray(incoming.routineFolders)
        ? incoming.routineFolders
        : [],
      storyRoutineId:
        typeof incoming.storyRoutineId === 'string'
          ? incoming.storyRoutineId
          : undefined,
      pvpWins: Math.max(0, Number(incoming.pvpWins || 0) || 0),
      pvpLosses: Math.max(0, Number(incoming.pvpLosses || 0) || 0),
      story: incoming.story !== undefined ? incoming.story : undefined,
      profileSetup:
        incoming.profileSetup !== undefined ? incoming.profileSetup : undefined,
      wellness: sanitizeWellnessPayload(incoming.wellness, undefined),
    };

    db.users[rawUsername] = baseRecord;
    if (
      'activeWorkout' in body &&
      body.activeWorkout &&
      typeof body.activeWorkout === 'object'
    ) {
      db.activeWorkouts[rawUsername] = body.activeWorkout;
    }
    writePersistedState(db);

    const token = crypto.randomBytes(32).toString('hex');
    const sessions = readSessions();
    sessions[hashSessionToken(token)] = {
      username: rawUsername,
      createdAt: Date.now(),
    };
    writeSessions(sessions);
    setSessionCookie(req, res, token);

    res.json({
      ok: true,
      hydrated: true,
      user: sanitizeSelfUser(baseRecord),
      activeWorkout: db.activeWorkouts[rawUsername] || null,
      groups: db.groups || [],
      publicUsers: sanitizePublicUsers(db.users),
      sessionToken: token,
      wsToken: signWsToken(rawUsername),
    });
  };

  app.post('/api/auth/auto-sync', handleAutoHydrateProfile);
  app.post('/api/auth/resume-pvp', handleAutoHydrateProfile);

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
      sessionToken: token,
      wsToken: signWsToken(found.username),
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
      oneRmRecords: {},
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
      sessionToken: token,
      wsToken: signWsToken(newUser.username),
    });
  });

  app.post('/api/auth/logout', (req, res) => {
    if (!verifyMutationOrigin(req, res)) return;
    const cookies = parseCookies(req.headers.cookie);
    const token =
      extractBearerToken(req.headers.authorization) || cookies[SESSION_COOKIE];
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
    const uname = getAuthenticatedUsername(req.headers, db);
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

    res.json({ ok: true, sessionToken: freshToken, wsToken: signWsToken(uname) });
  });

  app.delete('/api/auth/account', (req, res) => {
    if (!verifyMutationOrigin(req, res)) return;
    const db = readPersistedState();
    const uname = getAuthenticatedUsername(req.headers, db);
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

  function sanitizeOneRmRecordsPayload(
    incomingRaw: unknown,
    existingRaw: unknown
  ): Record<string, number> {
    const out: Record<string, number> = {};
    const addEntries = (src: unknown) => {
      if (!src || typeof src !== 'object' || Array.isArray(src)) return;
      for (const [k, v] of Object.entries(src as Record<string, unknown>)) {
        if (
          !k ||
          k.length > 80 ||
          k === '__proto__' ||
          k === 'constructor' ||
          k === 'prototype'
        ) {
          continue;
        }
        const num = Number(v);
        if (!Number.isFinite(num) || num <= 0 || num > 2000) continue;
        const rounded = Math.round(num * 10) / 10;
        if (rounded > (out[k] || 0)) {
          out[k] = rounded;
        }
      }
    };
    addEntries(existingRaw);
    addEntries(incomingRaw);
    const keys = Object.keys(out).slice(0, 500);
    const bounded: Record<string, number> = {};
    for (const k of keys) {
      bounded[k] = out[k];
    }
    return bounded;
  }

  function mergeIncomingProfileIntoRecord(
    existing: DbUserRecord,
    incoming: Partial<DbUserRecord>,
    db: DbShape
  ): DbUserRecord {
    const sanitizedWellness = sanitizeWellnessPayload(
      incoming.wellness,
      existing.wellness
    );
    const nextFriends = Array.isArray(incoming.friends)
      ? incoming.friends
          .map((f) => resolveUsernameKey(db.users, String(f || '')))
          .filter((f): f is string => Boolean(f && f !== existing.username))
      : existing.friends;

    const merged: DbUserRecord = {
      ...existing,
      email:
        typeof incoming.email === 'string' && incoming.email.trim()
          ? incoming.email
          : existing.email,
      charId:
        typeof incoming.charId === 'string' && incoming.charId.trim()
          ? incoming.charId
          : existing.charId,
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
          ? { ...(existing.prs || {}), ...incoming.prs }
          : existing.prs,
      oneRmRecords: sanitizeOneRmRecordsPayload(
        incoming.oneRmRecords,
        existing.oneRmRecords
      ),
      history:
        Array.isArray(incoming.history) &&
        incoming.history.length >= (Array.isArray(existing.history) ? existing.history.length : 0)
          ? incoming.history
          : existing.history,
      friends: nextFriends,
      friendNotifications: Array.isArray(existing.friendNotifications)
        ? existing.friendNotifications
        : [],
      groups: Array.isArray(incoming.groups) ? incoming.groups : existing.groups,
      customExercises: Array.isArray(incoming.customExercises)
        ? incoming.customExercises
        : existing.customExercises,
      routines:
        Array.isArray(incoming.routines) && incoming.routines.length > 0
          ? incoming.routines
          : existing.routines,
      routineFolders: Array.isArray(incoming.routineFolders)
        ? incoming.routineFolders
        : existing.routineFolders,
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
    return merged;
  }

  app.put('/api/user/sync', (req, res) => {
    if (!verifyMutationOrigin(req, res)) return;
    const db = readPersistedState();
    const uname = getAuthenticatedUsername(req.headers, db);
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
    const newlyAddedFriendNotifs: Array<{
      targetUsername: string;
      notification: FriendNotification;
    }> = [];

    if (payload.profile && typeof payload.profile === 'object') {
      const incoming = payload.profile;
      const sanitizedWellness = sanitizeWellnessPayload(
        incoming.wellness,
        existing.wellness
      );
      const prevFriendSet = new Set(
        (Array.isArray(existing.friends) ? existing.friends : []).map((f) =>
          String(f).toLowerCase()
        )
      );
      const nextFriends = Array.isArray(incoming.friends)
        ? incoming.friends
            .map((f) => resolveUsernameKey(db.users, String(f || '')))
            .filter((f): f is string => Boolean(f && f !== uname))
        : existing.friends;

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
        oneRmRecords: sanitizeOneRmRecordsPayload(
          incoming.oneRmRecords,
          existing.oneRmRecords
        ),
        history: Array.isArray(incoming.history) ? incoming.history : existing.history,
        friends: nextFriends,
        friendNotifications: Array.isArray(existing.friendNotifications)
          ? existing.friendNotifications
          : [],
        groups: Array.isArray(incoming.groups) ? incoming.groups : existing.groups,
        customExercises: Array.isArray(incoming.customExercises)
          ? incoming.customExercises
          : existing.customExercises,
        routines: Array.isArray(incoming.routines)
          ? incoming.routines
          : existing.routines,
        routineFolders: Array.isArray(incoming.routineFolders)
          ? incoming.routineFolders
          : existing.routineFolders,
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

      for (const targetUsername of nextFriends) {
        if (prevFriendSet.has(targetUsername.toLowerCase())) continue;
        const targetRecord = db.users[targetUsername];
        if (!targetRecord) continue;
        const existingNotifs = Array.isArray(targetRecord.friendNotifications)
          ? targetRecord.friendNotifications
          : [];
        const hasRecentFromSender = existingNotifs.some(
          (n) =>
            n.fromUsername.toLowerCase() === uname.toLowerCase() &&
            (!n.read || Date.now() - new Date(n.createdAt).getTime() < 10 * 60 * 1000)
        );
        if (hasRecentFromSender) continue;

        const notif: FriendNotification = {
          id: `fn_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          fromUsername: uname,
          fromCharId: String(merged.charId || 'goku'),
          fromLevel: getLevelFromXp(Number(merged.xp || 0)),
          createdAt: new Date().toISOString(),
          read: false,
        };
        targetRecord.friendNotifications = [notif, ...existingNotifs].slice(0, 25);
        newlyAddedFriendNotifs.push({ targetUsername, notification: notif });
      }
    }

    if ('activeWorkout' in payload) {
      if (payload.activeWorkout && typeof payload.activeWorkout === 'object') {
        db.activeWorkouts[uname] = payload.activeWorkout;
      } else {
        delete db.activeWorkouts[uname];
      }
    }

    writePersistedState(db);
    for (const item of newlyAddedFriendNotifs) {
      sendToUser(item.targetUsername, {
        type: 'social:friend_added',
        notification: item.notification,
      });
    }
    res.json({
      ok: true,
      groups: db.groups,
      publicUsers: sanitizePublicUsers(db.users),
    });
  });

  app.post('/api/notifications/friend-read', (req, res) => {
    if (!verifyMutationOrigin(req, res)) return;
    const db = readPersistedState();
    const uname = getAuthenticatedUsername(req.headers, db);
    if (!uname) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }
    const body = (req.body || {}) as { ids?: unknown };
    const idSet = Array.isArray(body.ids)
      ? new Set(body.ids.map((v) => String(v)))
      : null;

    const userRecord = db.users[uname];
    const current = Array.isArray(userRecord.friendNotifications)
      ? userRecord.friendNotifications
      : [];
    userRecord.friendNotifications = current.map((n) =>
      !idSet || idSet.has(n.id) ? { ...n, read: true } : n
    );
    writePersistedState(db);
    res.json({
      ok: true,
      friendNotifications: userRecord.friendNotifications,
    });
  });

  app.post('/api/groups', (req, res) => {
    if (!verifyMutationOrigin(req, res)) return;
    const db = readPersistedState();
    const uname = getAuthenticatedUsername(req.headers, db);
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
    const uname = getAuthenticatedUsername(req.headers, db);
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

  const server = http.createServer(app);

  const distDir = path.join(process.cwd(), 'dist');
  const isProdStart =
    process.env.NODE_ENV === 'production' ||
    (process.env.npm_lifecycle_event === 'start' &&
      fs.existsSync(path.join(distDir, 'index.html')));

  if (!isProdStart) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        allowedHosts: ['.run.app', '.onrender.com', '.vercel.app'],
        ws: { server },
      },
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

  const wss = new WebSocketServer({ noServer: true });

  const PVP_TURN_DURATION_MS = 22_000;
  const PVP_DISCONNECT_GRACE_MS = 30_000;

  const socketToUser = new Map<WebSocket, string>();
  const socketVerifiedUser = new Map<WebSocket, string>();
  const pendingInvites = new Map<string, PendingInvite>();
  const rooms = new Map<string, PvpRoom>();
  const matches = new Map<string, PvpMatchState>();
  const clashTimers = new Map<string, NodeJS.Timeout>();
  const turnTimers = new Map<string, NodeJS.Timeout>();
  const disconnectTimers = new Map<string, NodeJS.Timeout>();
  const roomGraceTimers = new Map<string, NodeJS.Timeout>();
  const lastKnownSeeds = new Map<string, FighterSeed>();

  const makeEventId = () =>
    `ev_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  const clearTurnTimer = (matchId: string) => {
    const t = turnTimers.get(matchId);
    if (t) {
      clearTimeout(t);
      turnTimers.delete(matchId);
    }
  };

  const clearMatchDisconnectTimers = (matchId: string) => {
    const prefix = `${matchId}:`;
    for (const [key, timer] of disconnectTimers.entries()) {
      if (key.startsWith(prefix)) {
        clearTimeout(timer);
        disconnectTimers.delete(key);
      }
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

  const scheduleTurnTimer = (match: PvpMatchState) => {
    clearTurnTimer(match.id);
    if (match.status !== 'active' || match.clash) return;
    match.turnDurationMs = PVP_TURN_DURATION_MS;
    match.turnEndsAt = Date.now() + PVP_TURN_DURATION_MS;

    const scheduledTurn = match.turn;
    const scheduledRound = match.round;

    const timer = setTimeout(() => {
      turnTimers.delete(match.id);
      const current = matches.get(match.id);
      if (
        !current ||
        current.status !== 'active' ||
        current.clash ||
        current.turn !== scheduledTurn ||
        current.round !== scheduledRound
      ) {
        return;
      }

      const timedOutUser = current.turn;
      const nextUser =
        current.playerOrder.find((n) => n !== timedOutUser) || timedOutUser;
      if (current.players[timedOutUser]) {
        current.players[timedOutUser].guarding = false;
      }
      current.lastEvent = {
        id: makeEventId(),
        actor: timedOutUser,
        target: nextUser,
        action: 'timeout',
        label: `⏱️ Tiempo agotado para ${timedOutUser}`,
      };
      current.log = [
        `⏱️ Tiempo agotado para ${timedOutUser}. ¡Turno de ${nextUser}!`,
        ...current.log.slice(0, 7),
      ];
      current.turn = nextUser;
      current.round += 1;
      scheduleTurnTimer(current);
      broadcastMatch(current);
    }, PVP_TURN_DURATION_MS + 120);

    turnTimers.set(match.id, timer);
  };

  const finishMatch = (
    match: PvpMatchState,
    winnerUsername: string,
    reason?: string,
    lastEvent?: PvpCombatEvent | null
  ) => {
    if (match.status === 'finished') return;
    const t = clashTimers.get(match.id);
    if (t) {
      clearTimeout(t);
      clashTimers.delete(match.id);
    }
    clearTurnTimer(match.id);
    clearMatchDisconnectTimers(match.id);
    match.clash = null;
    match.status = 'finished';
    match.winner = winnerUsername;
    match.turnEndsAt = undefined;
    if (lastEvent) {
      match.lastEvent = lastEvent;
    }
    if (reason) {
      match.log = [reason, ...match.log.slice(0, 7)];
    }

    const xpMap: Record<string, number> = {};
    for (const uname of match.playerOrder) {
      xpMap[uname] = uname === winnerUsername ? 80 : 35;
    }
    match.xpRewards = xpMap;

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
      turnEndsAt: Date.now() + PVP_TURN_DURATION_MS,
      turnDurationMs: PVP_TURN_DURATION_MS,
      round: 1,
      winner: null,
      players: {
        [p1.username]: p1,
        [p2.username]: p2,
      },
      playerOrder: [p1.username, p2.username],
      playerStatus: {
        [p1.username]: { connected: onlineUsers.has(p1.username), reconnectingUntil: null },
        [p2.username]: { connected: onlineUsers.has(p2.username), reconnectingUntil: null },
      },
      clash: null,
      lastEvent: null,
      damageDealt: {
        [p1.username]: 0,
        [p2.username]: 0,
      },
      rematchRequestedBy: [],
      log: [`⚔️ ¡Duelo PvP iniciado: ${p1.username} vs ${p2.username}! Turno de ${p1.username}.`],
    };
    matches.set(id, match);
    scheduleTurnTimer(match);
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
    match.damageDealt = match.damageDealt || { [initiatorName]: 0, [defenderName]: 0 };

    const initiatorMoveset = getCharacterPhaseMoveset(
      initiator.charId,
      initiator.level,
      initiator.stageName
    );
    const defenderMoveset = getCharacterPhaseMoveset(
      defender.charId,
      defender.level,
      defender.stageName
    );

    if (initTaps >= defTaps) {
      const ultMult =
        1 + Math.min(15, Math.max(0, Number(initiator.ultBoostPct || 0))) / 100;
      const dmg = Math.round(
        initiator.baseAtk * (initTaps > defTaps ? 2.25 : 1.75) * ultMult
      );
      const wasBlocked = defender.guarding;
      const actualDmg = wasBlocked ? Math.round(dmg * 0.6) : dmg;
      defender.hp = Math.max(0, defender.hp - actualDmg);
      defender.guarding = false;
      match.damageDealt[initiatorName] =
        (match.damageDealt[initiatorName] || 0) + actualDmg;

      const ev: PvpCombatEvent = {
        id: makeEventId(),
        actor: initiator.username,
        target: defender.username,
        action: 'clash_win',
        damage: actualDmg,
        blocked: wasBlocked,
        skillName: initiatorMoveset.ultimate.name,
        auraColor: initiator.auraColor || initiatorMoveset.accentColor,
        label: `🔥 ¡${initiatorMoveset.ultimate.name} de ${initiator.username}! -${actualDmg} HP`,
      };
      match.lastEvent = ev;
      match.log = [
        `🔥 ¡${initiator.username} desató ${initiatorMoveset.ultimate.name} (${initTaps} vs ${defTaps} toques) e infligió -${actualDmg} HP a ${defender.username}!`,
        ...match.log.slice(0, 7),
      ];
      if (defender.hp <= 0) {
        finishMatch(
          match,
          initiator.username,
          `🏆 ¡${initiator.username} derrotó a ${defender.username} con ${initiatorMoveset.ultimate.name}!`,
          ev
        );
        return;
      }
    } else {
      const reflect = Math.round(defender.baseAtk * 1.1);
      initiator.hp = Math.max(0, initiator.hp - reflect);
      defender.guarding = false;
      match.damageDealt[defenderName] =
        (match.damageDealt[defenderName] || 0) + reflect;

      const ev: PvpCombatEvent = {
        id: makeEventId(),
        actor: defender.username,
        target: initiator.username,
        action: 'clash_reflect',
        damage: reflect,
        skillName: defenderMoveset.guard.name,
        auraColor: defender.auraColor || defenderMoveset.accentColor,
        label: `🛡️ ¡${defenderMoveset.guard.name} de ${defender.username}! -${reflect} HP`,
      };
      match.lastEvent = ev;
      match.log = [
        `🛡️ ¡${defender.username} resistió con ${defenderMoveset.guard.name} (${defTaps} vs ${initTaps} toques) y contraatacó por -${reflect} HP!`,
        ...match.log.slice(0, 7),
      ];
      if (initiator.hp <= 0) {
        finishMatch(
          match,
          defender.username,
          `🏆 ¡${defender.username} remontó el Choque de Ki y venció!`,
          ev
        );
        return;
      }
    }

    match.turn = defenderName;
    match.round += 1;
    scheduleTurnTimer(match);
    broadcastMatch(match);
  };

  const aliveSockets = new Map<WebSocket, boolean>();
  const wsHeartbeatTimer = setInterval(() => {
    for (const client of wss.clients) {
      if (aliveSockets.get(client) === false) {
        client.terminate();
        continue;
      }
      aliveSockets.set(client, false);
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.ping();
        } catch {
          // ignore broken socket
        }
      }
    }
  }, 25000);
  wss.on('close', () => clearInterval(wsHeartbeatTimer));

  wss.on('connection', (ws: WebSocket) => {
    aliveSockets.set(ws, true);
    ws.on('pong', () => {
      aliveSockets.set(ws, true);
    });
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
        let verified = socketVerifiedUser.get(ws) || null;
        if (!verified && typeof msg.token === 'string' && msg.token.trim()) {
          const db = readPersistedState();
          verified = verifyWsToken(msg.token.trim(), db);
          if (verified) {
            socketVerifiedUser.set(ws, verified);
          }
        }
        if (!verified) {
          ws.send(
            JSON.stringify({
              type: 'pvp:error',
              code: 'AUTH_REQUIRED',
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
        lastKnownSeeds.set(username, seed);
        socketToUser.set(ws, username);
        sendToUser(username, { type: 'pvp:authenticated', username });
        broadcastPresence();

        // Recover active match if player reconnected within grace period
        let hasActiveMatch = false;
        const clientActiveMatchId =
          typeof msg.activeMatchId === 'string' && msg.activeMatchId.trim()
            ? msg.activeMatchId.trim()
            : null;
        for (const m of matches.values()) {
          if (m.playerOrder.includes(username) && m.status === 'active') {
            hasActiveMatch = true;
            const dKey = `${m.id}:${username}`;
            const dTimer = disconnectTimers.get(dKey);
            if (dTimer) {
              clearTimeout(dTimer);
              disconnectTimers.delete(dKey);
            }
            const prevConnected = m.playerStatus?.[username]?.connected;
            m.playerStatus = {
              ...(m.playerStatus || {}),
              [username]: { connected: true, reconnectingUntil: null },
            };
            if (prevConnected === false) {
              m.log = [`✅ ¡${username} se reconectó al combate!`, ...m.log.slice(0, 7)];
              broadcastMatch(m);
            } else {
              sendToUser(username, { type: 'pvp:match_state', match: m });
            }
          } else if (
            clientActiveMatchId &&
            m.id === clientActiveMatchId &&
            m.status === 'finished' &&
            m.playerOrder.includes(username)
          ) {
            hasActiveMatch = true;
            sendToUser(username, { type: 'pvp:match_state', match: m });
          }
        }

        // If client still displays an active match ID that no longer exists (e.g. server restarted)
        if (!hasActiveMatch && clientActiveMatchId && !matches.has(clientActiveMatchId)) {
          sendToUser(username, {
            type: 'pvp:match_lost',
            matchId: clientActiveMatchId,
            message: 'El servidor se reinició y finalizó la partida anterior.',
          });
        }

        // Restore private room if host reconnected within 30s grace window
        for (const r of rooms.values()) {
          if (r.hostUsername === username) {
            const rt = roomGraceTimers.get(r.code);
            if (rt) {
              clearTimeout(rt);
              roomGraceTimers.delete(r.code);
            }
            r.hostDisconnectedAt = null;
            if (!hasActiveMatch) {
              sendToUser(username, { type: 'pvp:room_created', code: r.code });
            }
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
          if (r.hostUsername === currentUsername) {
            const rt = roomGraceTimers.get(c);
            if (rt) {
              clearTimeout(rt);
              roomGraceTimers.delete(c);
            }
            rooms.delete(c);
          }
        }
        const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 5; i++) {
          code += alphabet[Math.floor(Math.random() * alphabet.length)];
        }
        rooms.set(code, {
          code,
          hostUsername: currentUsername,
          createdAt: Date.now(),
          hostDisconnectedAt: null,
        });
        sendToUser(currentUsername, { type: 'pvp:room_created', code });
        return;
      }

      if (type === 'pvp:leave_room') {
        for (const [c, r] of rooms.entries()) {
          if (r.hostUsername === currentUsername) {
            const rt = roomGraceTimers.get(c);
            if (rt) {
              clearTimeout(rt);
              roomGraceTimers.delete(c);
            }
            rooms.delete(c);
          }
        }
        sendToUser(currentUsername, { type: 'pvp:room_closed' });
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
          sendToUser(currentUsername, {
            type: 'pvp:error',
            message: room.hostDisconnectedAt
              ? `${room.hostUsername} está reconectándose. Intenta entrar en unos segundos.`
              : 'El anfitrión se desconectó. Pídele que cree otra sala.',
          });
          return;
        }
        const rt = roomGraceTimers.get(code);
        if (rt) {
          clearTimeout(rt);
          roomGraceTimers.delete(code);
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

        match.damageDealt = match.damageDealt || {
          [attacker.username]: 0,
          [defender.username]: 0,
        };
        const attackerMoveset = getCharacterPhaseMoveset(
          attacker.charId,
          attacker.level,
          attacker.stageName
        );
        const accentColor = attacker.auraColor || attackerMoveset.accentColor;

        if (action === 'strike') {
          const isCrit = Math.random() < attacker.critChance;
          const rawDmg = Math.round(
            attacker.baseAtk * (0.9 + Math.random() * 0.25) * (isCrit ? 1.5 : 1)
          );
          const wasGuarding = defender.guarding;
          const guardMult = wasGuarding ? 0.35 : 1;
          const dmg = Math.max(4, Math.round(rawDmg * guardMult));
          defender.hp = Math.max(0, defender.hp - dmg);
          attacker.aura = Math.min(100, attacker.aura + 30);
          match.damageDealt[attacker.username] =
            (match.damageDealt[attacker.username] || 0) + dmg;

          let logLine = isCrit
            ? `⚡ ¡CRÍTICO con ${attackerMoveset.physical.name} de ${attacker.username}! -${dmg} HP a ${defender.username}.`
            : `👊 ${attacker.username} ejecutó ${attackerMoveset.physical.name} (-${dmg} HP).`;
          let evLabel = isCrit
            ? `⚡ ¡CRÍTICO · ${attackerMoveset.physical.name}! -${dmg} HP (+30% Ki)`
            : `👊 ${attackerMoveset.physical.name}: -${dmg} HP (+30% Ki)`;

          if (wasGuarding) {
            const counter = Math.round(defender.baseAtk * 0.5);
            attacker.hp = Math.max(0, attacker.hp - counter);
            match.damageDealt[defender.username] =
              (match.damageDealt[defender.username] || 0) + counter;
            defender.guarding = false;
            logLine = `🛡️ ${defender.username} bloqueó ${attackerMoveset.physical.name} (-${dmg} HP) y contraatacó por -${counter} HP.`;
            evLabel = `🛡️ Bloqueo (-${dmg} HP) · Contraataque -${counter} HP`;
          }
          attacker.guarding = false;
          const ev: PvpCombatEvent = {
            id: makeEventId(),
            actor: attacker.username,
            target: defender.username,
            action: 'strike',
            damage: dmg,
            auraGain: 30,
            crit: isCrit,
            blocked: wasGuarding,
            skillName: attackerMoveset.physical.name,
            auraColor: accentColor,
            label: evLabel,
          };
          match.lastEvent = ev;
          match.log = [logLine, ...match.log.slice(0, 7)];

          if (defender.hp <= 0) {
            finishMatch(
              match,
              attacker.username,
              `🏆 ¡${attacker.username} ganó el duelo PvP con ${attackerMoveset.physical.name}!`,
              ev
            );
            return;
          }
          if (attacker.hp <= 0) {
            finishMatch(
              match,
              defender.username,
              `🏆 ¡${defender.username} ganó con su contraataque!`,
              ev
            );
            return;
          }
          match.turn = opponentName;
          match.round += 1;
          scheduleTurnTimer(match);
          broadcastMatch(match);
          return;
        }

        if (action === 'special') {
          if (attacker.aura < 40) return;
          attacker.aura = Math.max(0, attacker.aura - 40);
          const isCrit = Math.random() < Math.min(0.55, attacker.critChance + 0.08);
          const rawDmg = Math.round(
            attacker.baseAtk * (1.3 + Math.random() * 0.22) * (isCrit ? 1.45 : 1)
          );
          const wasGuarding = defender.guarding;
          const dmg = Math.max(6, Math.round(rawDmg * (wasGuarding ? 0.65 : 1)));
          defender.hp = Math.max(0, defender.hp - dmg);
          defender.guarding = false;
          attacker.guarding = false;
          match.damageDealt[attacker.username] =
            (match.damageDealt[attacker.username] || 0) + dmg;

          const skillName = attackerMoveset.special.name;
          const evLabel = isCrit
            ? `✨ ¡CRÍTICO · ${skillName}! -${dmg} HP`
            : wasGuarding
            ? `✨ ¡${skillName} atravesó la guardia! -${dmg} HP`
            : `✨ ${skillName}: -${dmg} HP`;
          const logLine = `✨ ${attacker.username} usó ${skillName}${
            isCrit ? ' (CRÍTICO)' : ''
          } contra ${defender.username} (-${dmg} HP).`;

          const ev: PvpCombatEvent = {
            id: makeEventId(),
            actor: attacker.username,
            target: defender.username,
            action: 'special',
            damage: dmg,
            crit: isCrit,
            blocked: wasGuarding,
            skillName,
            auraColor: accentColor,
            label: evLabel,
          };
          match.lastEvent = ev;
          match.log = [logLine, ...match.log.slice(0, 7)];

          if (defender.hp <= 0) {
            finishMatch(
              match,
              attacker.username,
              `🏆 ¡${attacker.username} remató con ${skillName}!`,
              ev
            );
            return;
          }
          match.turn = opponentName;
          match.round += 1;
          scheduleTurnTimer(match);
          broadcastMatch(match);
          return;
        }

        if (action === 'guard') {
          const heal = Math.round(attacker.maxHp * 0.08);
          attacker.hp = Math.min(attacker.maxHp, attacker.hp + heal);
          attacker.aura = Math.min(100, attacker.aura + 20);
          attacker.guarding = true;
          const guardName = attackerMoveset.guard.name;
          const ev: PvpCombatEvent = {
            id: makeEventId(),
            actor: attacker.username,
            action: 'guard',
            heal,
            auraGain: 20,
            skillName: guardName,
            auraColor: accentColor,
            label: `🛡️ ${guardName}: +${heal} HP · +20% Ki`,
          };
          match.lastEvent = ev;
          match.log = [
            `🛡️ ${attacker.username} activó ${guardName} (+${heal} HP, +20% Ki).`,
            ...match.log.slice(0, 7),
          ];
          match.turn = opponentName;
          match.round += 1;
          scheduleTurnTimer(match);
          broadcastMatch(match);
          return;
        }

        if (action === 'ultimate') {
          if (attacker.aura < 100) return;
          clearTurnTimer(match.id);
          match.turnEndsAt = undefined;
          attacker.aura = 0;
          attacker.guarding = false;
          const ultName = attackerMoveset.ultimate.name;
          match.lastEvent = {
            id: makeEventId(),
            actor: attacker.username,
            target: defender.username,
            action: 'ultimate',
            skillName: ultName,
            auraColor: accentColor,
            label: `🔥 ¡${attacker.username} lanzó ${ultName}!`,
          };
          match.clash = {
            initiator: attacker.username,
            endsAt: Date.now() + 3500,
            taps: {
              [attacker.username]: 1,
              [defender.username]: 0,
            },
          };
          match.log = [
            `🔥 ¡${attacker.username} desató ${ultName}! ¡Toquen rápido para ganar el Choque de Ki!`,
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
        finishMatch(
          match,
          opponentName,
          `🏳️ ${currentUsername} se retiró. ¡Victoria para ${opponentName}!`,
          {
            id: makeEventId(),
            actor: currentUsername,
            target: opponentName,
            action: 'forfeit',
            label: `🏳️ ${currentUsername} se retiró`,
          }
        );
        return;
      }

      if (type === 'pvp:rematch') {
        const matchId = String(msg.matchId || '');
        const match = matches.get(matchId);
        if (!match || match.status !== 'finished') return;
        if (!match.playerOrder.includes(currentUsername)) return;

        const requested = new Set(match.rematchRequestedBy || []);
        if (!requested.has(currentUsername)) {
          requested.add(currentUsername);
        }
        match.rematchRequestedBy = Array.from(requested);

        const opponentName =
          match.playerOrder.find((n) => n !== currentUsername) || currentUsername;
        const p1Entry = onlineUsers.get(match.playerOrder[0]);
        const p2Entry = onlineUsers.get(match.playerOrder[1]);

        if (match.playerOrder.every((n) => requested.has(n))) {
          if (p1Entry && p2Entry) {
            startMatch(p1Entry.seed, p2Entry.seed);
            return;
          }
          sendToUser(currentUsername, {
            type: 'pvp:error',
            message: `${opponentName} ya salió de la arena PvP.`,
          });
          broadcastMatch(match);
          return;
        }

        if (!onlineUsers.has(opponentName)) {
          sendToUser(currentUsername, {
            type: 'pvp:error',
            message: `${opponentName} está desconectado o salió del lobby.`,
          });
        } else {
          sendToUser(opponentName, {
            type: 'pvp:rematch_notice',
            fromUsername: currentUsername,
            matchId: match.id,
          });
        }
        broadcastMatch(match);
        return;
      }
    });

    ws.on('close', () => {
      aliveSockets.delete(ws);
      const uname = socketToUser.get(ws);
      socketToUser.delete(ws);
      socketVerifiedUser.delete(ws);
      if (uname) {
        const current = onlineUsers.get(uname);
        if (current && current.ws === ws) {
          onlineUsers.delete(uname);
        } else {
          // Newer socket already replaced this one
          return;
        }

        // Keep private room alive during 30s reconnect grace window
        for (const [c, r] of rooms.entries()) {
          if (r.hostUsername === uname) {
            r.hostDisconnectedAt = Date.now();
            const existingRt = roomGraceTimers.get(c);
            if (existingRt) clearTimeout(existingRt);
            const rt = setTimeout(() => {
              roomGraceTimers.delete(c);
              const latestRoom = rooms.get(c);
              if (latestRoom && latestRoom.hostUsername === uname && !onlineUsers.has(uname)) {
                rooms.delete(c);
              }
            }, PVP_DISCONNECT_GRACE_MS);
            roomGraceTimers.set(c, rt);
          }
        }

        // Put active matches into 30s reconnect grace state
        for (const m of matches.values()) {
          if (m.status === 'active' && m.playerOrder.includes(uname)) {
            const deadline = Date.now() + PVP_DISCONNECT_GRACE_MS;
            m.playerStatus = {
              ...(m.playerStatus || {}),
              [uname]: { connected: false, reconnectingUntil: deadline },
            };
            m.log = [
              `📡 ${uname} perdió la conexión. Esperando reconexión (30s)...`,
              ...m.log.slice(0, 7),
            ];
            broadcastMatch(m);

            const dKey = `${m.id}:${uname}`;
            const oldTimer = disconnectTimers.get(dKey);
            if (oldTimer) clearTimeout(oldTimer);
            const timer = setTimeout(() => {
              disconnectTimers.delete(dKey);
              const latestMatch = matches.get(m.id);
              if (!latestMatch || latestMatch.status !== 'active') return;
              if (onlineUsers.has(uname)) return;
              const opponentName =
                latestMatch.playerOrder.find((n) => n !== uname) || uname;
              finishMatch(
                latestMatch,
                opponentName,
                `📡 ${uname} no pudo reconectarse en 30s. ¡Victoria por abandono para ${opponentName}!`,
                {
                  id: makeEventId(),
                  actor: uname,
                  target: opponentName,
                  action: 'disconnect',
                  label: `📡 ${uname} abandonó por desconexión`,
                }
              );
            }, PVP_DISCONNECT_GRACE_MS);
            disconnectTimers.set(dKey, timer);
          }
        }

        broadcastPresence();
      }
    });
  });

  server.on('upgrade', (request, socket, head) => {
    const reqUrl = request.url || '';
    if (reqUrl.startsWith('/ws/pvp')) {
      const db = readPersistedState();
      let tokenParam: string | null = null;
      try {
        const parsed = new URL(reqUrl, 'http://localhost');
        tokenParam = parsed.searchParams.get('token');
      } catch {
        tokenParam = null;
      }
      const verified =
        getAuthenticatedUsername(request.headers, db) ||
        verifyWsToken(tokenParam, db);
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
