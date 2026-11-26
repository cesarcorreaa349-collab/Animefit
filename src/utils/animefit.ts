import { apiUrl } from '../config/api';
import { CHARACTERS } from '../data/characters';
import { BASE_EXERCISES, SEED_GROUPS } from '../data/exercises';
import {
  ActiveWorkout,
  AppDB,
  AthleteProfileSetup,
  AthleteSex,
  CharacterDef,
  CommunityGroup,
  EvolutionStage,
  ExerciseDef,
  Routine,
  UserProfile,
} from '../types/animefit';

export const DB_KEY = 'animefit_device_v3';
export const LOGGED_OUT_KEY = 'animefit_logged_out_v3';
export const EXCLUSIVE_GOKU_EMAIL = 'cesarcorreaa349@gmail.com';
const LEGACY_DB_KEY = 'animefit_db_v2';
const LEGACY_SESSION_KEY = 'animefit_session_user_v2';
const LEGACY_LOGGED_OUT_KEY = 'animefit_logged_out_v2';
const IDB_NAME = 'animefit_persist_v3';
const IDB_STORE = 'state';

function clearLegacySharedSession(): void {
  try {
    localStorage.removeItem(LEGACY_DB_KEY);
    localStorage.removeItem(LEGACY_SESSION_KEY);
    localStorage.removeItem(LEGACY_LOGGED_OUT_KEY);
    document.cookie = `${LEGACY_SESSION_KEY}=; max-age=0; path=/; SameSite=Lax`;
    document.cookie = `${LEGACY_LOGGED_OUT_KEY}=; max-age=0; path=/; SameSite=Lax`;
  } catch {
    // ignore
  }
}

export function resolveUsername(
  users: Record<string, UserProfile>,
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

export function markExplicitLogout(loggedOut: boolean): void {
  try {
    if (loggedOut) {
      localStorage.setItem(LOGGED_OUT_KEY, '1');
    } else {
      localStorage.removeItem(LOGGED_OUT_KEY);
    }
  } catch {
    // ignore
  }
}

function isExplicitlyLoggedOut(): boolean {
  try {
    return localStorage.getItem(LOGGED_OUT_KEY) === '1';
  } catch {
    return false;
  }
}

function openIDB(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') {
        resolve(null);
        return;
      }
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const idb = req.result;
        if (!idb.objectStoreNames.contains(IDB_STORE)) {
          idb.createObjectStore(IDB_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function readFromIDB(): Promise<AppDB | null> {
  const idb = await openIDB();
  if (!idb) return null;
  return new Promise((resolve) => {
    try {
      const tx = idb.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get('db');
      req.onsuccess = () => resolve((req.result as AppDB) || null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function writeToIDB(db: AppDB): Promise<void> {
  const idb = await openIDB();
  if (!idb) return;
  try {
    const tx = idb.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(db, 'db');
  } catch {
    // ignore
  }
}

export async function clearLocalDeviceCache(): Promise<void> {
  try {
    localStorage.removeItem(DB_KEY);
  } catch {
    // ignore
  }
  const idb = await openIDB();
  if (!idb) return;
  try {
    const tx = idb.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).delete('db');
  } catch {
    // ignore
  }
}

export function removeUserFromDB(db: AppDB, targetUsername: string): AppDB {
  const targetLower = targetUsername.toLowerCase();
  const nextUsers: Record<string, UserProfile> = {};

  Object.entries(db.users).forEach(([key, u]) => {
    if (key.toLowerCase() === targetLower || u.username.toLowerCase() === targetLower) {
      return;
    }
    nextUsers[key] = {
      ...u,
      friends: (u.friends || []).filter((f) => f.toLowerCase() !== targetLower),
    };
  });

  const nextActive = { ...db.activeWorkouts };
  Object.keys(nextActive).forEach((k) => {
    if (k.toLowerCase() === targetLower) delete nextActive[k];
  });

  const nextGroups = (db.groups || []).map((g) => ({
    ...g,
    members: g.members.filter((m) => m.toLowerCase() !== targetLower),
  }));

  const nextSession =
    db.sessionUser && db.sessionUser.toLowerCase() === targetLower
      ? null
      : db.sessionUser;

  return {
    ...db,
    users: nextUsers,
    activeWorkouts: nextActive,
    groups: nextGroups,
    sessionUser: nextSession,
  };
}

export function sanitizeDB(rawDb: AppDB): AppDB {
  const db: AppDB = {
    users: rawDb.users || {},
    groups: rawDb.groups || JSON.parse(JSON.stringify(SEED_GROUPS)),
    sessionUser: rawDb.sessionUser || null,
    activeWorkouts: rawDb.activeWorkouts || {},
  };

  const nonGokuMalePool = CHARACTERS.filter(
    (c) => c.id !== 'goku' && c.gender === 'M'
  );
  const femalePool = CHARACTERS.filter((c) => c.gender === 'F');

  Object.values(db.users).forEach((u) => {
    if ('pass' in u) {
      delete u.pass;
    }
    const email = (u.email || '').trim().toLowerCase();
    const desiredGender =
      u.profileSetup?.sex === 'femenino'
        ? 'F'
        : u.profileSetup?.sex === 'masculino'
        ? 'M'
        : null;

    if (email === EXCLUSIVE_GOKU_EMAIL && desiredGender !== 'F') {
      if (u.charId !== 'goku') {
        u.charId = 'goku';
      }
    } else if (u.charId === 'goku' && desiredGender) {
      const pool = desiredGender === 'F' ? femalePool : nonGokuMalePool;
      u.charId =
        desiredGender !== 'F' &&
        (u.username === 'kakaroto_gym' || u.username === 'vegeta_gym')
          ? 'vegeta'
          : pool[Math.floor(Math.random() * pool.length)].id;
    } else if (desiredGender) {
      const curr = getCharacterById(u.charId);
      if (curr.gender !== desiredGender) {
        const pool = desiredGender === 'F' ? femalePool : nonGokuMalePool;
        u.charId = pool[Math.floor(Math.random() * pool.length)].id;
      }
    }
  });

  if (isExplicitlyLoggedOut()) {
    db.sessionUser = null;
  } else {
    db.sessionUser = resolveUsername(db.users, db.sessionUser);
  }

  return db;
}

export function loadDB(): AppDB {
  clearLegacySharedSession();
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppDB;
      if (parsed && parsed.users) return sanitizeDB(parsed);
    }
  } catch {
    // fallback to clean unauthenticated local state
  }
  return {
    users: {},
    groups: JSON.parse(JSON.stringify(SEED_GROUPS)),
    sessionUser: null,
    activeWorkouts: {},
  };
}

let serverSyncTimer: number | null = null;
let inMemorySessionToken: string | null = null;
let inMemoryWsToken: { token: string; expiresAt: number } | null = null;
let serverSessionStatus: 'unknown' | 'authenticated' | 'unauthenticated' =
  'unknown';

export function getServerSessionStatus():
  | 'unknown'
  | 'authenticated'
  | 'unauthenticated' {
  return serverSessionStatus;
}

export function setInMemoryAuthTokens(
  sessionToken?: string | null,
  wsToken?: string | null
): void {
  if (typeof sessionToken === 'string' && sessionToken.trim()) {
    inMemorySessionToken = sessionToken.trim();
  }
  if (typeof wsToken === 'string' && wsToken.trim()) {
    inMemoryWsToken = {
      token: wsToken.trim(),
      expiresAt: Date.now() + 8 * 60 * 1000,
    };
  }
}

export function getInMemoryWsToken(): string | null {
  if (inMemoryWsToken && inMemoryWsToken.expiresAt > Date.now() + 15000) {
    return inMemoryWsToken.token;
  }
  return null;
}

export function clearInMemoryAuthTokens(): void {
  inMemorySessionToken = null;
  inMemoryWsToken = null;
  serverSessionStatus = 'unauthenticated';
}

function authHeaders(
  extra: Record<string, string> = {}
): Record<string, string> {
  if (inMemorySessionToken) {
    return { ...extra, Authorization: `Bearer ${inMemorySessionToken}` };
  }
  return extra;
}

export function pushDBToServer(db: AppDB, keepalive = false): void {
  try {
    const uname = resolveUsername(db.users, db.sessionUser);
    if (!uname) return;
    const selfUser = db.users[uname];
    if (!selfUser) return;
    const sanitizedProfile: UserProfile = { ...selfUser };
    delete sanitizedProfile.pass;
    const payload = JSON.stringify({
      profile: sanitizedProfile,
      activeWorkout: db.activeWorkouts[uname] || null,
    });
    fetch(apiUrl('/api/user/sync'), {
      method: 'PUT',
      credentials: 'include',
      headers: authHeaders({
        'Content-Type': 'application/json',
        'X-Requested-With': 'animefit',
      }),
      body: payload,
      keepalive,
    }).catch(() => {
      // offline fallback: local device storage stays up to date
    });
  } catch {
    // ignore
  }
}

export function persistDB(db: AppDB, immediateServer = false): void {
  const cleanDb: AppDB = {
    users: db.users,
    groups: db.groups,
    sessionUser: db.sessionUser,
    activeWorkouts: db.activeWorkouts,
  };
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(cleanDb));
  } catch {
    // ignore storage quota errors gracefully
  }

  void writeToIDB(cleanDb);

  if (typeof window !== 'undefined' && cleanDb.sessionUser) {
    if (immediateServer) {
      if (serverSyncTimer !== null) {
        window.clearTimeout(serverSyncTimer);
        serverSyncTimer = null;
      }
      pushDBToServer(cleanDb, false);
    } else {
      if (serverSyncTimer !== null) window.clearTimeout(serverSyncTimer);
      serverSyncTimer = window.setTimeout(() => {
        serverSyncTimer = null;
        pushDBToServer(cleanDb, false);
      }, 250);
    }
  }
}

export interface AuthSessionPayload {
  user: UserProfile | null;
  activeWorkout: ActiveWorkout | null;
  groups: CommunityGroup[];
  publicUsers: Record<string, UserProfile>;
  sessionToken?: string;
  wsToken?: string | null;
}

export function buildAppDBFromServerAuth(payload: AuthSessionPayload): AppDB {
  const mergedUsers: Record<string, UserProfile> = {
    ...(payload.publicUsers || {}),
  };
  const activeWorkouts: Record<string, ActiveWorkout> = {};
  let sessionUser: string | null = null;

  if (payload.user) {
    mergedUsers[payload.user.username] = payload.user;
    sessionUser = payload.user.username;
    if (payload.activeWorkout) {
      activeWorkouts[payload.user.username] = payload.activeWorkout;
    }
  }

  return sanitizeDB({
    users: mergedUsers,
    groups: payload.groups || JSON.parse(JSON.stringify(SEED_GROUPS)),
    sessionUser,
    activeWorkouts,
  });
}

export async function syncDBFromBackups(localDb: AppDB): Promise<AppDB | null> {
  let effectiveLocal = localDb;
  if (!effectiveLocal.sessionUser && !isExplicitlyLoggedOut()) {
    const idbDb = await readFromIDB();
    if (idbDb && idbDb.sessionUser && idbDb.users?.[idbDb.sessionUser]) {
      effectiveLocal = sanitizeDB(idbDb);
    }
  }

  try {
    const res = await fetch(apiUrl('/api/auth/me'), {
      credentials: 'include',
      cache: 'no-store',
      headers: authHeaders(),
    });
    if (res.ok) {
      const data = (await res.json()) as AuthSessionPayload;
      if (data.user) {
        serverSessionStatus = 'authenticated';
        setInMemoryAuthTokens(data.sessionToken, data.wsToken);
        const nextDb = buildAppDBFromServerAuth(data);
        const localUser = effectiveLocal.users?.[data.user.username];
        if (localUser?.wellness?.logs) {
          const now = new Date();
          const todayKey = `${now.getFullYear()}-${String(
            now.getMonth() + 1
          ).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
          const localToday = localUser.wellness.logs[todayKey];
          const serverUser = nextDb.users[data.user.username];
          const serverToday = serverUser?.wellness?.logs?.[todayKey];
          const localSteps = Math.max(
            0,
            Math.min(60000, Math.round(Number(localToday?.steps) || 0))
          );
          const serverSteps = Math.max(
            0,
            Math.min(60000, Math.round(Number(serverToday?.steps) || 0))
          );
          if (serverUser && localToday && localSteps > serverSteps) {
            const baseLogs = serverUser.wellness?.logs || {};
            const baseStepGoal = Math.max(
              3000,
              Math.round(
                serverUser.wellness?.stepGoal || localToday.stepGoal || 8000
              )
            );
            const bonusNeeded =
              !serverToday?.stepsXpAwarded &&
              Boolean(localToday.stepsXpAwarded) &&
              localSteps >= baseStepGoal;
            nextDb.users[data.user.username] = {
              ...serverUser,
              xp: (serverUser.xp || 0) + (bonusNeeded ? 20 : 0),
              wellness: {
                stepGoal: baseStepGoal,
                sleepGoal: serverUser.wellness?.sleepGoal || 8,
                logs: {
                  ...baseLogs,
                  [todayKey]: {
                    ...(serverToday || localToday),
                    date: todayKey,
                    steps: localSteps,
                    stepGoal: baseStepGoal,
                    stepsXpAwarded:
                      Boolean(serverToday?.stepsXpAwarded) ||
                      Boolean(localToday.stepsXpAwarded),
                  },
                },
              },
            };
            pushDBToServer(nextDb, false);
          }
        }
        try {
          localStorage.setItem(DB_KEY, JSON.stringify(nextDb));
        } catch {
          // ignore
        }
        void writeToIDB(nextDb);
        return nextDb;
      }

      serverSessionStatus = 'unauthenticated';
      inMemoryWsToken = null;

      // Preserve saved local/IDB session unless user explicitly logged out,
      // and silently resume the server session in the background for PvP/sync
      if (
        !isExplicitlyLoggedOut() &&
        effectiveLocal.sessionUser &&
        effectiveLocal.users?.[effectiveLocal.sessionUser]
      ) {
        const preservedUser = effectiveLocal.users[effectiveLocal.sessionUser];
        const preservedActive =
          effectiveLocal.activeWorkouts?.[preservedUser.username] || null;
        const resumed = await apiResumePvpSession(preservedUser, preservedActive);
        const resumedData = resumed.ok ? resumed.data : null;

        const mergedDb = sanitizeDB({
          users: {
            ...(data.publicUsers || {}),
            ...(resumedData?.publicUsers || {}),
            ...effectiveLocal.users,
            [preservedUser.username]: resumedData?.user
              ? {
                  ...resumedData.user,
                  ...preservedUser,
                  xp: Math.max(resumedData.user.xp || 0, preservedUser.xp || 0),
                  workoutsDone: Math.max(
                    resumedData.user.workoutsDone || 0,
                    preservedUser.workoutsDone || 0
                  ),
                  friendNotifications:
                    resumedData.user.friendNotifications ||
                    preservedUser.friendNotifications,
                }
              : preservedUser,
          },
          groups:
            resumedData?.groups && resumedData.groups.length > 0
              ? resumedData.groups
              : data.groups && data.groups.length > 0
              ? data.groups
              : effectiveLocal.groups,
          sessionUser: preservedUser.username,
          activeWorkouts: effectiveLocal.activeWorkouts || {},
        });
        try {
          localStorage.setItem(DB_KEY, JSON.stringify(mergedDb));
        } catch {
          // ignore
        }
        void writeToIDB(mergedDb);
        return mergedDb;
      }

      return null;
    }
  } catch {
    // Offline fallback: keep saved device cache below
  }

  if (
    !isExplicitlyLoggedOut() &&
    effectiveLocal.sessionUser &&
    effectiveLocal.users?.[effectiveLocal.sessionUser]
  ) {
    try {
      localStorage.setItem(DB_KEY, JSON.stringify(effectiveLocal));
    } catch {
      // ignore
    }
    return effectiveLocal;
  }
  return null;
}

export async function apiFetchWsToken(): Promise<
  | { ok: true; wsToken: string }
  | { ok: false; unauthenticated: boolean }
> {
  try {
    const res = await fetch(apiUrl('/api/auth/ws-token'), {
      credentials: 'include',
      cache: 'no-store',
      headers: authHeaders(),
    });
    if (res.status === 401) {
      inMemoryWsToken = null;
      serverSessionStatus = 'unauthenticated';
      return { ok: false, unauthenticated: true };
    }
    if (!res.ok) {
      return { ok: false, unauthenticated: false };
    }
    const json = (await res.json()) as { wsToken?: string };
    if (typeof json.wsToken === 'string' && json.wsToken.trim()) {
      setInMemoryAuthTokens(undefined, json.wsToken);
      serverSessionStatus = 'authenticated';
      return { ok: true, wsToken: json.wsToken.trim() };
    }
    return { ok: false, unauthenticated: false };
  } catch {
    return { ok: false, unauthenticated: false };
  }
}

export async function apiResumePvpSession(
  profile: UserProfile,
  activeWorkout?: ActiveWorkout | null
): Promise<
  | { ok: true; data: AuthSessionPayload }
  | { ok: false; rejected: boolean }
> {
  try {
    const cleanProfile: UserProfile = { ...profile };
    delete cleanProfile.pass;
    const res = await fetch(apiUrl('/api/auth/resume-pvp'), {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'animefit',
      },
      body: JSON.stringify({
        profile: cleanProfile,
        ...(activeWorkout !== undefined ? { activeWorkout } : {}),
      }),
    });
    if (!res.ok) {
      return { ok: false, rejected: res.status === 400 || res.status === 403 };
    }
    const json = (await res.json()) as AuthSessionPayload;
    if (json.sessionToken || json.wsToken) {
      serverSessionStatus = 'authenticated';
      setInMemoryAuthTokens(json.sessionToken, json.wsToken);
    }
    return { ok: true, data: json };
  } catch {
    return { ok: false, rejected: false };
  }
}

export async function apiLogin(
  identifier: string,
  password: string
): Promise<{ ok: true; data: AuthSessionPayload } | { ok: false; error: string }> {
  try {
    const res = await fetch(apiUrl('/api/auth/login'), {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'animefit',
      },
      body: JSON.stringify({ identifier, password }),
    });
    const json = (await res.json()) as AuthSessionPayload & { error?: string };
    if (!res.ok) {
      return { ok: false, error: json.error || 'Error al iniciar sesión.' };
    }
    serverSessionStatus = 'authenticated';
    setInMemoryAuthTokens(json.sessionToken, json.wsToken);
    return { ok: true, data: json };
  } catch {
    return { ok: false, error: 'Sin conexión con el servidor.' };
  }
}

export async function apiRegister(
  username: string,
  email: string,
  password: string
): Promise<{ ok: true; data: AuthSessionPayload } | { ok: false; error: string }> {
  try {
    const res = await fetch(apiUrl('/api/auth/register'), {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'animefit',
      },
      body: JSON.stringify({ username, email, password }),
    });
    const json = (await res.json()) as AuthSessionPayload & { error?: string };
    if (!res.ok) {
      return { ok: false, error: json.error || 'Error al crear cuenta.' };
    }
    serverSessionStatus = 'authenticated';
    setInMemoryAuthTokens(json.sessionToken, json.wsToken);
    return { ok: true, data: json };
  } catch {
    return { ok: false, error: 'Sin conexión con el servidor.' };
  }
}

export async function apiLogout(): Promise<void> {
  const headers = authHeaders({ 'X-Requested-With': 'animefit' });
  clearInMemoryAuthTokens();
  try {
    await fetch(apiUrl('/api/auth/logout'), {
      method: 'POST',
      credentials: 'include',
      headers,
    });
  } catch {
    // ignore
  }
}

export async function apiChangePassword(
  newPassword: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch(apiUrl('/api/auth/change-password'), {
      method: 'POST',
      credentials: 'include',
      headers: authHeaders({
        'Content-Type': 'application/json',
        'X-Requested-With': 'animefit',
      }),
      body: JSON.stringify({ newPassword }),
    });
    const json = (await res.json()) as {
      ok?: boolean;
      error?: string;
      sessionToken?: string;
      wsToken?: string | null;
    };
    if (!res.ok || !json.ok) {
      return {
        ok: false,
        error: json.error || 'No se pudo cambiar la contraseña.',
      };
    }
    setInMemoryAuthTokens(json.sessionToken, json.wsToken);
    return { ok: true };
  } catch {
    return { ok: false, error: 'Sin conexión con el servidor.' };
  }
}

export async function apiDeleteAccount(): Promise<boolean> {
  const headers = authHeaders({ 'X-Requested-With': 'animefit' });
  try {
    const res = await fetch(apiUrl('/api/auth/account'), {
      method: 'DELETE',
      credentials: 'include',
      headers,
    });
    if (res.ok) {
      clearInMemoryAuthTokens();
    }
    return res.ok;
  } catch {
    return false;
  }
}

export async function apiCreateGroup(
  name: string,
  desc: string
): Promise<CommunityGroup[] | null> {
  try {
    const res = await fetch(apiUrl('/api/groups'), {
      method: 'POST',
      credentials: 'include',
      headers: authHeaders({
        'Content-Type': 'application/json',
        'X-Requested-With': 'animefit',
      }),
      body: JSON.stringify({ name, desc }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { groups?: CommunityGroup[] };
    return json.groups || null;
  } catch {
    return null;
  }
}

export async function apiToggleGroup(
  groupId: string
): Promise<CommunityGroup[] | null> {
  try {
    const res = await fetch(
      apiUrl(`/api/groups/${encodeURIComponent(groupId)}/toggle`),
      {
        method: 'POST',
        credentials: 'include',
        headers: authHeaders({ 'X-Requested-With': 'animefit' }),
      }
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { groups?: CommunityGroup[] };
    return json.groups || null;
  } catch {
    return null;
  }
}

export async function apiMarkFriendNotificationsRead(
  ids?: string[]
): Promise<void> {
  try {
    await fetch(apiUrl('/api/notifications/friend-read'), {
      method: 'POST',
      credentials: 'include',
      headers: authHeaders({
        'Content-Type': 'application/json',
        'X-Requested-With': 'animefit',
      }),
      body: JSON.stringify(ids ? { ids } : {}),
    });
  } catch {
    // offline fallback: local state already marks notifications read
  }
}


export function getLevelInfo(xp: number) {
  let level = 1;
  let remaining = Math.max(0, xp || 0);
  let needed = 120;
  while (remaining >= needed && level < 150) {
    remaining -= needed;
    level++;
    needed = Math.floor(120 * Math.pow(1.12, level - 1));
  }
  return {
    level,
    currentXp: remaining,
    neededXp: needed,
    totalXp: xp || 0,
    pct: Math.min(100, Math.round((remaining / needed) * 100)),
  };
}

export function getCharacterById(id: string): CharacterDef {
  return CHARACTERS.find((c) => c.id === id) || CHARACTERS[0];
}

export function getCharacterStage(charId: string, level: number): {
  char: CharacterDef;
  stageName: string;
  stageLevel: number;
  nextStage: EvolutionStage | null;
} {
  const char = getCharacterById(charId);
  let current = char.stages[0];
  let next: EvolutionStage | null = null;
  for (let i = 0; i < char.stages.length; i++) {
    if (level >= char.stages[i].levelReq) {
      current = char.stages[i];
      next = char.stages[i + 1] || null;
    }
  }
  return {
    char,
    stageName: current.phase,
    stageLevel: current.levelReq,
    nextStage: next,
  };
}

export function getAllExercisesForUser(user: UserProfile | null): ExerciseDef[] {
  const customs = user?.customExercises || [];
  return [...BASE_EXERCISES, ...customs];
}

export function getExerciseById(
  id: string,
  user: UserProfile | null
): ExerciseDef | undefined {
  return getAllExercisesForUser(user).find((e) => e.id === id);
}

export function getLastStatsForExercise(
  user: UserProfile,
  exId: string
): { weight: number | ''; reps: number | '' } | null {
  const hist = user.history || [];
  for (let i = hist.length - 1; i >= 0; i--) {
    const found = hist[i].exercises.find((e) => e.exId === exId);
    if (found && found.sets.length > 0) {
      const doneSet = found.sets.find((s) => s.done) || found.sets[0];
      return { weight: doneSet.weight, reps: doneSet.reps };
    }
  }
  return null;
}

export interface PreviousExerciseHistory {
  date: string;
  sets: { weight: number | ''; reps: number | '' }[];
  bestWeight: number;
  bestReps: number;
}

export function getLastExerciseSetsHistory(
  user: UserProfile,
  exId: string
): PreviousExerciseHistory | null {
  const hist = user.history || [];
  for (let i = hist.length - 1; i >= 0; i--) {
    const entry = hist[i];
    const found = entry.exercises.find((e) => e.exId === exId);
    if (found && found.sets.length > 0) {
      const doneSets = found.sets.filter((s) => s.done);
      const source = doneSets.length > 0 ? doneSets : found.sets;
      const mapped = source.map((s) => ({
        weight: s.weight,
        reps: s.reps,
      }));
      let bestWeight = 0;
      let bestReps = 0;
      for (const s of mapped) {
        const w = Number(s.weight) || 0;
        const r = Number(s.reps) || 0;
        if (w > bestWeight) bestWeight = w;
        if (r > bestReps) bestReps = r;
      }
      return {
        date: entry.date,
        sets: mapped,
        bestWeight,
        bestReps,
      };
    }
  }
  return null;
}

export function calculateEstimated1RM(weight: number, reps: number): number {
  if (
    !Number.isFinite(weight) ||
    !Number.isFinite(reps) ||
    weight <= 0 ||
    reps <= 0
  ) {
    return 0;
  }
  if (reps <= 1) {
    return Math.round(weight * 10) / 10;
  }
  const estimated = weight * (1 + reps / 30);
  return Math.round(estimated * 10) / 10;
}

export function getBestOneRmFromHistory(
  user: UserProfile,
  exId: string,
  isCardio = false
): number {
  if (isCardio) return 0;
  let best = 0;
  const hist = user.history || [];
  for (const entry of hist) {
    for (const ex of entry.exercises || []) {
      if (ex.exId !== exId) continue;
      for (const s of ex.sets || []) {
        if (!s.done) continue;
        const est = calculateEstimated1RM(
          Number(s.weight) || 0,
          Number(s.reps) || 0
        );
        if (est > best) best = est;
      }
    }
  }
  return best;
}

export function getBestOneRmForExercise(
  user: UserProfile,
  exId: string,
  isCardio = false
): number {
  if (isCardio) return 0;
  const stored = Number(user.oneRmRecords?.[exId] || 0);
  const fromHistory = getBestOneRmFromHistory(user, exId, isCardio);
  return Math.max(
    Number.isFinite(stored) && stored > 0 ? Math.round(stored * 10) / 10 : 0,
    fromHistory
  );
}

export function getAllOneRmRecordEntries(
  user: UserProfile
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [exId, val] of Object.entries(user.oneRmRecords || {})) {
    const num = Number(val);
    if (Number.isFinite(num) && num > 0) {
      out[exId] = Math.round(num * 10) / 10;
    }
  }
  for (const entry of user.history || []) {
    for (const ex of entry.exercises || []) {
      const exDef = getExerciseById(ex.exId, user);
      if (exDef?.isCardio) continue;
      for (const s of ex.sets || []) {
        if (!s.done) continue;
        const est = calculateEstimated1RM(
          Number(s.weight) || 0,
          Number(s.reps) || 0
        );
        if (est > (out[ex.exId] || 0)) {
          out[ex.exId] = est;
        }
      }
    }
  }
  return out;
}

export function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export function beepRestDone(): void {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
  } catch {
    // ignore audio restrictions
  }
}

export function buildSmartRoutines(params: {
  goal: string;
  place: 'gym' | 'home' | 'calistenia';
  days: number;
  level: string;
  publish: boolean;
  username: string;
}): Routine[] {
  const { goal, place, days, level, publish, username } = params;
  const extraSets = level === 'avanzado' ? 4 : 3;
  const compSets = goal === 'powerlifting' || goal === 'fuerza' ? 5 : 4;

  type PoolTuple = [string, number, string];

  const pools: Record<'gym' | 'home' | 'calistenia', Record<string, PoolTuple[]>> = {
    gym: {
      push:
        goal === 'powerlifting'
          ? [
              ['f_bench_flat', compSets, '3-5'],
              ['f_close_bench', 4, '5-6'],
              ['f_ohp_bar', 4, '5-8'],
              ['m_incline_hs', 3, '8-10'],
              ['m_tricep_bar', 3, '10-12'],
            ]
          : goal === 'powerbuilding'
          ? [
              ['f_bench_flat', 4, '5-6'],
              ['m_incline_hs', 3, '8-10'],
              ['f_db_ohp', 3, '8-10'],
              ['m_peck_deck', 3, '12-15'],
              ['m_cable_lat_raise', 4, '12-15'],
              ['m_tricep_rope', 3, '12'],
            ]
          : [
              ['m_incline_hs', extraSets, '8-10'],
              ['m_chest_press', 3, '10-12'],
              ['m_cable_cross_high', 3, '12-15'],
              ['m_shoulder_press', 3, '10'],
              ['m_lat_raise_mach', 4, '12-15'],
              ['m_tricep_oh_mach', 3, '12'],
            ],
      pull:
        goal === 'powerlifting'
          ? [
              ['f_deadlift', compSets, '3-5'],
              ['f_bar_row', 4, '6-8'],
              ['m_lat_pulldown_wide', 3, '8-10'],
              ['m_face_pull', 3, '15'],
              ['f_bar_curl', 3, '10'],
            ]
          : [
              ['m_lat_pulldown_wide', extraSets, '8-10'],
              ['m_chest_supp_row', extraSets, '10-12'],
              ['m_gironda_row', 3, '10-12'],
              ['m_rev_peck', 3, '15'],
              ['m_bicep_mach', 3, '10-12'],
              ['f_hammer_curl', 3, '12'],
            ],
      legs:
        goal === 'powerlifting'
          ? [
              ['f_back_squat', compSets, '3-5'],
              ['f_rdl', 4, '6-8'],
              ['m_leg_press_45', 3, '8-10'],
              ['m_seated_curl', 3, '10'],
              ['m_ab_crunch', 3, '12-15'],
            ]
          : [
              ['m_hack_squat', extraSets, '8-10'],
              ['f_rdl', 3, '8-10'],
              ['m_leg_press_45', 3, '12'],
              ['m_leg_ext', 3, '12-15'],
              ['m_lying_curl', 3, '12'],
              ['m_calf_stand', 4, '15'],
            ],
      upper: [
        ['f_bench_flat', 4, goal === 'fuerza' ? '4-6' : '8-10'],
        ['m_lat_pulldown_wide', 4, '8-10'],
        ['m_low_row_iso', 3, '10'],
        ['m_shoulder_press', 3, '10'],
        ['m_cable_curl', 3, '12'],
        ['m_tricep_rope', 3, '12'],
      ],
      lower: [
        ['f_back_squat', 4, goal === 'fuerza' ? '4-6' : '8-10'],
        ['f_hip_thrust_bar', 4, '8-10'],
        ['m_seated_curl', 3, '12'],
        ['m_leg_ext', 3, '12-15'],
        ['m_calf_seat', 4, '15'],
        ['m_cable_crunch', 3, '15'],
      ],
      full: [
        ['m_leg_press_45', 3, '10-12'],
        ['m_chest_press', 3, '10-12'],
        ['m_gironda_row', 3, '10-12'],
        ['m_lat_raise_mach', 3, '12-15'],
        ['m_seated_curl', 3, '12'],
        ['c_stairmaster', 1, '15m'],
      ],
    },
    home: {
      push: [
        ['h_pushup', 4, '12-20'],
        ['h_pushup_dec', 3, '10-15'],
        ['h_pike_pushup', 3, '8-12'],
        ['h_pushup_diam', 3, '10-15'],
        ['h_kickback_home', 3, '12-15'],
      ],
      pull: [
        ['h_home_row', 4, '12'],
        ['h_sl_rdl', 3, '10-12'],
        ['h_plank', 3, '45s'],
        ['h_crunch', 3, '20'],
        ['h_mountain_climb', 3, '40s'],
      ],
      legs: [
        ['h_goblet_squat', 4, '12-15'],
        ['h_lunges_home', 4, '12'],
        ['h_sl_rdl', 3, '10'],
        ['h_air_squat', 3, '20'],
        ['h_burpees', 3, '12'],
      ],
      upper: [
        ['h_pushup', 4, '12-15'],
        ['h_home_row', 4, '12'],
        ['h_pike_pushup', 3, '10'],
        ['h_pushup_diam', 3, '10'],
        ['h_plank', 3, '45s'],
      ],
      lower: [
        ['h_goblet_squat', 4, '15'],
        ['h_lunges_home', 3, '12'],
        ['h_sl_rdl', 3, '12'],
        ['h_burpees', 3, '10'],
        ['h_side_plank', 3, '35s'],
      ],
      full: [
        ['h_air_squat', 3, '20'],
        ['h_pushup', 3, '12-15'],
        ['h_home_row', 3, '12'],
        ['h_lunges_home', 3, '12'],
        ['h_burpees', 3, '10'],
        ['h_plank', 3, '45s'],
      ],
    },
    calistenia: {
      push: [
        ['cal_dips', 4, '8-12'],
        ['cal_hspu', 3, '5-8'],
        ['cal_planche', 4, '15s'],
        ['h_pushup_diam', 3, '12-15'],
        ['cal_lsit', 3, '20s'],
      ],
      pull: [
        ['cal_muscleup', 3, '3-6'],
        ['cal_pullup', 4, '8-12'],
        ['cal_front_lever', 4, '15s'],
        ['cal_aust_row', 3, '12-15'],
        ['cal_toes_bar', 3, '10'],
      ],
      legs: [
        ['cal_pistol', 4, '6-8'],
        ['cal_bulg_bw', 4, '12'],
        ['h_air_squat', 3, '25'],
        ['cal_dragon_flag', 3, '6-8'],
      ],
      upper: [
        ['cal_weighted_pull', 4, '6-8'],
        ['cal_dips', 4, '10'],
        ['cal_aust_row', 3, '12'],
        ['cal_hspu', 3, '6'],
        ['cal_lsit', 3, '20s'],
      ],
      lower: [
        ['cal_pistol', 4, '8'],
        ['cal_bulg_bw', 4, '12'],
        ['cal_toes_bar', 3, '12'],
        ['cal_dragon_flag', 3, '6'],
      ],
      full: [
        ['cal_pullup', 4, '8'],
        ['cal_dips', 4, '10'],
        ['cal_pistol', 3, '6'],
        ['cal_aust_row', 3, '12'],
        ['cal_lsit', 3, '20s'],
      ],
    },
  };

  const p = pools[place];
  const goalLabels: Record<string, string> = {
    hipertrofia: 'Hipertrofia',
    powerbuilding: 'Powerbuilding',
    powerlifting: 'Powerlifting',
    fuerza: 'Fuerza',
    calistenia: 'Calistenia',
    definicion: 'Definición',
  };
  const tag = goalLabels[goal] || 'Pro';

  let plan: { title: string; list: PoolTuple[] }[] = [];
  if (days === 2) {
    plan = [
      { title: `Día A: Full Body (${tag})`, list: p.full },
      {
        title: `Día B: Torso/Pierna Mix (${tag})`,
        list: [...p.upper.slice(0, 3), ...p.lower.slice(0, 3)],
      },
    ];
  } else if (days === 3) {
    plan = [
      { title: `Día 1: Empuje / Push (${tag})`, list: p.push },
      { title: `Día 2: Tirón / Pull (${tag})`, list: p.pull },
      { title: `Día 3: Piernas (${tag})`, list: p.legs },
    ];
  } else if (days === 4) {
    plan = [
      { title: `Día 1: Torso A (${tag})`, list: p.upper },
      { title: `Día 2: Pierna A (${tag})`, list: p.lower },
      {
        title: `Día 3: Torso B (${tag})`,
        list: [...p.push.slice(0, 3), ...p.pull.slice(0, 3)],
      },
      { title: `Día 4: Pierna B (${tag})`, list: p.legs },
    ];
  } else if (days === 5) {
    plan = [
      { title: `Día 1: Empuje (${tag})`, list: p.push },
      { title: `Día 2: Tirón (${tag})`, list: p.pull },
      { title: `Día 3: Piernas (${tag})`, list: p.legs },
      { title: `Día 4: Torso Completo (${tag})`, list: p.upper },
      { title: `Día 5: Pierna & Core (${tag})`, list: p.lower },
    ];
  } else {
    plan = [
      { title: `Día 1: Push A (${tag})`, list: p.push },
      { title: `Día 2: Pull A (${tag})`, list: p.pull },
      { title: `Día 3: Legs A (${tag})`, list: p.legs },
      { title: `Día 4: Push B (${tag})`, list: p.push },
      { title: `Día 5: Pull B (${tag})`, list: p.pull },
      { title: `Día 6: Legs B (${tag})`, list: p.legs },
    ];
  }

  if (goal === 'definicion' && place === 'gym') {
    plan.forEach((d) => {
      d.list = [...d.list, ['c_airbike', 1, '12m']];
    });
  }

  const now = Date.now();
  return plan.map((d, i) => ({
    id: `ai_${now}_${i}`,
    name: d.title,
    published: publish,
    author: username,
    likes: 0,
    exercises: d.list.map(([exId, sets, targetReps]) => ({
      exId,
      sets,
      targetReps,
    })),
  }));
}

export interface TrainingStyleOption {
  id: string;
  label: string;
  desc: string;
  icon: string;
}

export const TRAINING_STYLE_OPTIONS: TrainingStyleOption[] = [
  {
    id: 'hipertrofia',
    label: 'Hipertrofia',
    desc: 'Estética, volumen y masa muscular',
    icon: '💪',
  },
  {
    id: 'powerlifting',
    label: 'Powerlifting',
    desc: 'Sentadilla, Press Banca y Peso Muerto',
    icon: '🏋️',
  },
  {
    id: 'calistenia',
    label: 'Calistenia',
    desc: 'Dominadas, fondos y peso corporal',
    icon: '🤸',
  },
  {
    id: 'powerbuilding',
    label: 'Powerbuilding',
    desc: 'Fuerza en básicos + estética muscular',
    icon: '⚡',
  },
  {
    id: 'fuerza',
    label: 'Fuerza Máxima',
    desc: 'Cargas altas y récords personales',
    icon: '🪨',
  },
  {
    id: 'definicion',
    label: 'Definición',
    desc: 'Quema de grasa y tono muscular',
    icon: '🔥',
  },
  {
    id: 'casa',
    label: 'Entrenar en Casa',
    desc: 'Sin máquinas ni gimnasio',
    icon: '🏠',
  },
  {
    id: 'crossfit',
    label: 'CrossTraining / HIIT',
    desc: 'Circuitos metabólicos intensos',
    icon: '⏱️',
  },
  {
    id: 'funcional',
    label: 'Funcional & Atlético',
    desc: 'Potencia, agilidad y rendimiento',
    icon: '🏃',
  },
  {
    id: 'cardio',
    label: 'Cardio & Resistencia',
    desc: 'Running, bici, remo y escaladora',
    icon: '🫀',
  },
  {
    id: 'artes_marciales',
    label: 'Artes Marciales / Boxeo',
    desc: 'Explosividad, core y aguante',
    icon: '🥊',
  },
  {
    id: 'movilidad',
    label: 'Movilidad & Core',
    desc: 'Abdomen fuerte, postura y salud',
    icon: '🧘',
  },
];

export function assignCharacterBySex(
  sex: AthleteSex,
  email: string,
  currentCharId?: string
): CharacterDef {
  const normalizedEmail = (email || '').trim().toLowerCase();
  const desiredGender = sex === 'femenino' ? 'F' : 'M';

  if (normalizedEmail === EXCLUSIVE_GOKU_EMAIL && sex === 'masculino') {
    return getCharacterById('goku');
  }

  if (currentCharId) {
    const curr = getCharacterById(currentCharId);
    if (
      curr.gender === desiredGender &&
      (curr.id !== 'goku' || normalizedEmail === EXCLUSIVE_GOKU_EMAIL)
    ) {
      return curr;
    }
  }

  const pool =
    desiredGender === 'F'
      ? CHARACTERS.filter((c) => c.gender === 'F')
      : CHARACTERS.filter((c) => c.gender === 'M' && c.id !== 'goku');

  return pool[Math.floor(Math.random() * pool.length)] || CHARACTERS[0];
}

export function buildRoutinesFromOnboarding(
  setup: AthleteProfileSetup,
  username: string
): Routine[] {
  const months =
    setup.experienceUnit === 'años'
      ? setup.experienceValue * 12
      : setup.experienceValue;
  const level = months >= 24 ? 'avanzado' : months >= 6 ? 'intermedio' : 'principiante';

  const styles = setup.trainingStyles;
  const primaryGoal = styles.includes('powerlifting')
    ? 'powerlifting'
    : styles.includes('powerbuilding')
    ? 'powerbuilding'
    : styles.includes('fuerza')
    ? 'fuerza'
    : styles.includes('definicion')
    ? 'definicion'
    : 'hipertrofia';

  const place: 'gym' | 'home' | 'calistenia' =
    styles.includes('calistenia') && !styles.includes('hipertrofia') && !styles.includes('powerlifting')
      ? 'calistenia'
      : styles.includes('casa') && !styles.includes('hipertrofia') && !styles.includes('powerlifting')
      ? 'home'
      : 'gym';

  const baseRoutines = buildSmartRoutines({
    goal: primaryGoal,
    place,
    days: 3,
    level,
    publish: false,
    username,
  });

  const extraRoutines: Routine[] = [];
  const now = Date.now();

  if (styles.includes('calistenia') && place !== 'calistenia') {
    extraRoutines.push({
      id: `onb_cal_${now}`,
      name: 'Calistenia & Dominio Corporal',
      published: false,
      author: username,
      likes: 0,
      exercises: [
        { exId: 'cal_pullup', sets: 4, targetReps: '8-12' },
        { exId: 'cal_dips', sets: 4, targetReps: '10-12' },
        { exId: 'cal_pistol', sets: 3, targetReps: '6-8' },
        { exId: 'cal_lsit', sets: 3, targetReps: '20s' },
      ],
    });
  }

  if (
    styles.includes('cardio') ||
    styles.includes('crossfit') ||
    styles.includes('artes_marciales')
  ) {
    extraRoutines.push({
      id: `onb_cond_${now}`,
      name: 'Acondicionamiento, Cardio & Core',
      published: false,
      author: username,
      likes: 0,
      exercises: [
        { exId: 'h_burpees', sets: 4, targetReps: '12' },
        { exId: 'h_mountain_climb', sets: 3, targetReps: '40s' },
        { exId: 'm_ab_crunch', sets: 3, targetReps: '15' },
        { exId: 'c_airbike', sets: 1, targetReps: '15m' },
      ],
    });
  }

  return [...baseRoutines, ...extraRoutines];
}

export const STORY_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function getStoryWeeklyStatus(lastCompletedAt?: string | null): {
  canCompleteNewChapter: boolean;
  remainingMs: number;
  nextAvailableDate: Date | null;
} {
  if (!lastCompletedAt) {
    return { canCompleteNewChapter: true, remainingMs: 0, nextAvailableDate: null };
  }
  const ts = Date.parse(lastCompletedAt);
  if (!Number.isFinite(ts)) {
    return { canCompleteNewChapter: true, remainingMs: 0, nextAvailableDate: null };
  }
  const elapsed = Date.now() - ts;
  const remainingMs = Math.max(0, STORY_WEEK_MS - elapsed);
  return {
    canCompleteNewChapter: remainingMs === 0,
    remainingMs,
    nextAvailableDate: remainingMs > 0 ? new Date(ts + STORY_WEEK_MS) : null,
  };
}

export function formatWeeklyCountdown(ms: number): string {
  const totalMin = Math.max(1, Math.ceil(ms / 60000));
  const days = Math.floor(totalMin / (60 * 24));
  const hours = Math.floor((totalMin % (60 * 24)) / 60);
  const mins = totalMin % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}


