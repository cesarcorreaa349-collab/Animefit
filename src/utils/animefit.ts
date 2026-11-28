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
import {
  DAILY_ITEM_PURCHASE_LIMIT,
  DAILY_SURVIVAL_COIN_CAP,
  getCharacterEffectiveXp,
  getCharacterShopPrice,
  getDailyShopRotation,
  getResaleValue,
  getShopItemById,
  getUnlockedCharacterIds,
  getUserDailyShopPurchasesCount,
  isSingleOwnershipCosmetic,
  toShopLocalDateKey,
} from '../data/shopCatalog';
import {
  ACCESSORY_DAILY_PURCHASE_LIMIT,
  getAccessoryById,
  getAccessorySlotKey,
  getDailyAccessoryShopRotation,
  getOwnedAccessoryIds,
  getUserAccessoryDailyPurchasesCount,
  SECONDARY_CURRENCY_NAME,
} from '../data/accessoriesCatalog';
import { getCombatAudioContext } from './combatAudio';

export {
  getCombatSoundEnabled,
  installGlobalAudioUnlockOnce,
  playConsumeItemSound,
  playPvpEffectSound,
  playPvpEmoteSound,
  playRoomTowerSound,
  playShopCoinSound,
  playTechniqueCombatSound,
  setCombatSoundEnabled,
  speakVictoryVoice,
  stopAllCombatAudio,
  stopCombatVoice,
  subscribeCombatSound,
  unlockCombatAudio,
  unlockPvpAudio,
  unlockRestAudio,
} from './combatAudio';
export type {
  CombatSoundActor,
  CombatSoundKind,
  CombatSoundPayload,
  RoomTowerSoundKind,
  SpeakVictoryVoiceOptions,
  TechniqueSlot,
} from './combatAudio';

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

let inFlightAutoSync: {
  usernameLower: string;
  promise: Promise<
    | { ok: true; data: AuthSessionPayload }
    | { ok: false; rejected: boolean }
  >;
} | null = null;

export function pushDBToServer(db: AppDB, keepalive = false): void {
  try {
    const uname = resolveUsername(db.users, db.sessionUser);
    if (!uname) return;
    const selfUser = db.users[uname];
    if (!selfUser) return;
    const sanitizedProfile: UserProfile = { ...selfUser };
    delete sanitizedProfile.pass;
    const activeWorkout = db.activeWorkouts[uname] || null;
    const payload = JSON.stringify({
      profile: sanitizedProfile,
      activeWorkout,
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
    })
      .then((res) => {
        if (!keepalive && res.status === 401 && !isExplicitlyLoggedOut()) {
          serverSessionStatus = 'unauthenticated';
          inMemoryWsToken = null;
          void apiResumePvpSession(sanitizedProfile, activeWorkout);
        }
      })
      .catch(() => {
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

function mergeNumberRecordMax(
  serverMap: Record<string, number> | undefined,
  localMap: Record<string, number> | undefined
): { merged: Record<string, number>; localHadHigher: boolean } {
  const merged: Record<string, number> = { ...(serverMap || {}) };
  let localHadHigher = false;
  if (localMap) {
    for (const [key, rawVal] of Object.entries(localMap)) {
      const val = Number(rawVal || 0);
      const prev = Number(merged[key] || 0);
      if (val > prev) {
        merged[key] = val;
        localHadHigher = true;
      }
    }
  }
  return { merged, localHadHigher };
}

export function mergeRichUserProfiles(
  localUser: UserProfile | undefined,
  serverUser: UserProfile
): { merged: UserProfile; localHadExtraData: boolean } {
  if (!localUser) {
    return { merged: serverUser, localHadExtraData: false };
  }

  let localHadExtraData = false;
  const localXp = Math.max(0, Number(localUser.xp || 0));
  const serverXp = Math.max(0, Number(serverUser.xp || 0));
  if (localXp > serverXp) localHadExtraData = true;

  const localWorkouts = Math.max(0, Number(localUser.workoutsDone || 0));
  const serverWorkouts = Math.max(0, Number(serverUser.workoutsDone || 0));
  if (localWorkouts > serverWorkouts) localHadExtraData = true;

  const prsResult = mergeNumberRecordMax(serverUser.prs, localUser.prs);
  if (prsResult.localHadHigher) localHadExtraData = true;

  const oneRmResult = mergeNumberRecordMax(
    serverUser.oneRmRecords,
    localUser.oneRmRecords
  );
  if (oneRmResult.localHadHigher) localHadExtraData = true;

  const serverHistory = Array.isArray(serverUser.history) ? serverUser.history : [];
  const localHistory = Array.isArray(localUser.history) ? localUser.history : [];
  const historyMap = new Map<string, (typeof serverHistory)[number]>();
  for (const h of serverHistory) {
    if (!h) continue;
    historyMap.set(`${h.date || ''}::${h.name || ''}::${h.sets || 0}`, h);
  }
  for (const h of localHistory) {
    if (!h) continue;
    const key = `${h.date || ''}::${h.name || ''}::${h.sets || 0}`;
    if (!historyMap.has(key)) {
      localHadExtraData = true;
    }
    historyMap.set(key, h);
  }
  const mergedHistory = Array.from(historyMap.values()).slice(-80);

  const localRoutines = Array.isArray(localUser.routines) ? localUser.routines : [];
  const serverRoutines = Array.isArray(serverUser.routines)
    ? serverUser.routines
    : [];
  let mergedRoutines = serverRoutines;
  if (localRoutines.length > 0) {
    const localRoutineIds = new Set(localRoutines.map((r) => r.id));
    const localIsAhead =
      localXp >= serverXp ||
      localWorkouts >= serverWorkouts ||
      localRoutines.length >= serverRoutines.length;
    if (localIsAhead) {
      mergedRoutines = localRoutines;
      if (
        localRoutines.length !== serverRoutines.length ||
        serverRoutines.some((sr) => !localRoutineIds.has(sr.id))
      ) {
        localHadExtraData = true;
      }
    } else {
      const mergedMap = new Map<string, Routine>();
      for (const r of serverRoutines) mergedMap.set(r.id, r);
      for (const r of localRoutines) {
        if (!mergedMap.has(r.id)) {
          mergedMap.set(r.id, r);
          localHadExtraData = true;
        }
      }
      mergedRoutines = Array.from(mergedMap.values());
    }
  }

  const localFolders = Array.isArray(localUser.routineFolders)
    ? localUser.routineFolders
    : [];
  const serverFolders = Array.isArray(serverUser.routineFolders)
    ? serverUser.routineFolders
    : [];
  if (localFolders.length > serverFolders.length) localHadExtraData = true;
  const mergedFolders =
    localFolders.length >= serverFolders.length ? localFolders : serverFolders;

  const customExMap = new Map<string, ExerciseDef>();
  for (const ex of serverUser.customExercises || []) {
    if (ex?.id) customExMap.set(ex.id, ex);
  }
  for (const ex of localUser.customExercises || []) {
    if (ex?.id) {
      if (!customExMap.has(ex.id)) localHadExtraData = true;
      customExMap.set(ex.id, ex);
    }
  }
  const mergedCustomExercises = Array.from(customExMap.values());

  const mergedFriendsSet = new Set<string>([
    ...(serverUser.friends || []),
    ...(localUser.friends || []),
  ]);
  const mergedFriends = Array.from(mergedFriendsSet);
  if (mergedFriends.length > (serverUser.friends || []).length) {
    localHadExtraData = true;
  }

  const mergedGroups = Array.from(
    new Set<string>([...(serverUser.groups || []), ...(localUser.groups || [])])
  );

  const localStory = localUser.story;
  const serverStory = serverUser.story;
  let mergedStory = serverStory || localStory;
  if (localStory && serverStory) {
    const localCount =
      (localStory.completedChapters?.length || 0) * 10 +
      (localStory.claimedRewards?.length || 0) +
      (localStory.currentNodeIndex || 0);
    const serverCount =
      (serverStory.completedChapters?.length || 0) * 10 +
      (serverStory.claimedRewards?.length || 0) +
      (serverStory.currentNodeIndex || 0);
    if (localCount > serverCount) {
      mergedStory = localStory;
      localHadExtraData = true;
    }
  } else if (localStory && !serverStory) {
    mergedStory = localStory;
    localHadExtraData = true;
  }

  let mergedWellness = serverUser.wellness || localUser.wellness;
  if (localUser.wellness?.logs) {
    const baseLogs = { ...(serverUser.wellness?.logs || {}) };
    const stepGoal = Math.max(
      3000,
      Math.round(
        localUser.wellness.stepGoal || serverUser.wellness?.stepGoal || 8000
      )
    );
    const sleepGoal = Math.max(
      4,
      Math.min(
        12,
        Number(
          localUser.wellness.sleepGoal || serverUser.wellness?.sleepGoal || 8
        )
      )
    );
    for (const [dateKey, localLog] of Object.entries(localUser.wellness.logs)) {
      const serverLog = baseLogs[dateKey];
      if (!serverLog) {
        baseLogs[dateKey] = localLog;
        localHadExtraData = true;
      } else {
        const bestSteps = Math.max(
          Number(serverLog.steps || 0),
          Number(localLog.steps || 0)
        );
        const bestSleep = Math.max(
          Number(serverLog.sleepHours || 0),
          Number(localLog.sleepHours || 0)
        );
        if (
          bestSteps > Number(serverLog.steps || 0) ||
          bestSleep > Number(serverLog.sleepHours || 0)
        ) {
          localHadExtraData = true;
        }
        baseLogs[dateKey] = {
          ...serverLog,
          ...localLog,
          date: dateKey,
          steps: bestSteps,
          stepGoal: Math.max(3000, Number(localLog.stepGoal || stepGoal)),
          sleepHours: bestSleep,
          sleepGoal: Number(localLog.sleepGoal || sleepGoal),
          stepsXpAwarded:
            Boolean(serverLog.stepsXpAwarded) || Boolean(localLog.stepsXpAwarded),
          sleepXpAwarded:
            Boolean(serverLog.sleepXpAwarded) || Boolean(localLog.sleepXpAwarded),
        };
      }
    }
    mergedWellness = {
      stepGoal,
      sleepGoal,
      logs: baseLogs,
    };
  }

  if (localUser.profileSetup && !serverUser.profileSetup) {
    localHadExtraData = true;
  }

  const localUnlocked = getUnlockedCharacterIds(localUser);
  const serverUnlocked = getUnlockedCharacterIds(serverUser);
  const mergedUnlocked = Array.from(new Set([...serverUnlocked, ...localUnlocked]));
  if (mergedUnlocked.length > serverUnlocked.length) localHadExtraData = true;

  const mergedOffsets: Record<string, number> = {
    ...(serverUser.charXpOffsets || {}),
  };
  for (const [cid, off] of Object.entries(localUser.charXpOffsets || {})) {
    if (typeof off === 'number' && Number.isFinite(off)) {
      if (mergedOffsets[cid] === undefined) {
        mergedOffsets[cid] = off;
        localHadExtraData = true;
      } else {
        mergedOffsets[cid] = Math.min(mergedOffsets[cid], off);
      }
    }
  }

  const localDailyShop = localUser.shopDailyPurchases;
  const serverDailyShop = serverUser.shopDailyPurchases;
  let mergedShopDaily = serverDailyShop || localDailyShop;
  if (localDailyShop && serverDailyShop) {
    if (localDailyShop.dateKey > serverDailyShop.dateKey) {
      mergedShopDaily = localDailyShop;
      localHadExtraData = true;
    } else if (
      localDailyShop.dateKey === serverDailyShop.dateKey &&
      localDailyShop.itemsBought > serverDailyShop.itemsBought
    ) {
      mergedShopDaily = localDailyShop;
      localHadExtraData = true;
    }
  } else if (localDailyShop && !serverDailyShop) {
    mergedShopDaily = localDailyShop;
    localHadExtraData = true;
  }

  const localPvpDaily = localUser.pvpDailyXp;
  const serverPvpDaily = serverUser.pvpDailyXp;
  let mergedPvpDaily = serverPvpDaily || localPvpDaily;
  if (localPvpDaily && serverPvpDaily) {
    if (localPvpDaily.dateKey > serverPvpDaily.dateKey) {
      mergedPvpDaily = localPvpDaily;
      localHadExtraData = true;
    } else if (localPvpDaily.dateKey === serverPvpDaily.dateKey) {
      mergedPvpDaily = {
        dateKey: localPvpDaily.dateKey,
        xpEarned: Math.max(localPvpDaily.xpEarned || 0, serverPvpDaily.xpEarned || 0),
        coinsEarned: Math.max(
          localPvpDaily.coinsEarned || 0,
          serverPvpDaily.coinsEarned || 0
        ),
      };
    }
  } else if (localPvpDaily && !serverPvpDaily) {
    mergedPvpDaily = localPvpDaily;
    localHadExtraData = true;
  }

  const localSurvDaily = localUser.survivalDailyCoins;
  const serverSurvDaily = serverUser.survivalDailyCoins;
  let mergedSurvDaily = serverSurvDaily || localSurvDaily;
  if (localSurvDaily && serverSurvDaily) {
    if (localSurvDaily.dateKey > serverSurvDaily.dateKey) {
      mergedSurvDaily = localSurvDaily;
      localHadExtraData = true;
    } else if (localSurvDaily.dateKey === serverSurvDaily.dateKey) {
      mergedSurvDaily = {
        dateKey: localSurvDaily.dateKey,
        coinsEarned: Math.max(
          localSurvDaily.coinsEarned || 0,
          serverSurvDaily.coinsEarned || 0
        ),
      };
    }
  } else if (localSurvDaily && !serverSurvDaily) {
    mergedSurvDaily = localSurvDaily;
    localHadExtraData = true;
  }

  const localInv = Array.isArray(localUser.inventory) ? localUser.inventory : [];
  const serverInv = Array.isArray(serverUser.inventory) ? serverUser.inventory : [];
  const localInvCount = localInv.reduce((sum, e) => sum + (e?.quantity || 0), 0);
  const serverInvCount = serverInv.reduce((sum, e) => sum + (e?.quantity || 0), 0);
  const localSpentAhead =
    mergedUnlocked.length > serverUnlocked.length ||
    (mergedShopDaily === localDailyShop &&
      (localDailyShop?.itemsBought || 0) > (serverDailyShop?.itemsBought || 0)) ||
    localInvCount !== serverInvCount;

  const mergedCoins = localSpentAhead
    ? Math.max(0, Number(localUser.coins ?? serverUser.coins ?? 0))
    : Math.max(
        Math.max(0, Number(serverUser.coins || 0)),
        Math.max(0, Number(localUser.coins || 0))
      );
  if (
    typeof localUser.coins === 'number' &&
    localUser.coins !== serverUser.coins
  ) {
    localHadExtraData = true;
  }

  const mergedInventory =
    localInv.length > 0 && (localSpentAhead || localInvCount >= serverInvCount)
      ? localInv
      : serverInv;
  if (localInvCount > serverInvCount) localHadExtraData = true;

  const mergedEquippedCosmetics = localUser.equippedCosmetics || serverUser.equippedCosmetics;

  const localEmail = (localUser.email || '').trim();
  const serverEmail = (serverUser.email || '').trim();
  const mergedEmail =
    localEmail && !localEmail.endsWith('@animefit.local')
      ? localEmail
      : serverEmail || localEmail;

  const localOwnedAcc = getOwnedAccessoryIds(localUser);
  const serverOwnedAcc = getOwnedAccessoryIds(serverUser);
  const mergedOwnedAcc = Array.from(new Set([...serverOwnedAcc, ...localOwnedAcc]));
  if (mergedOwnedAcc.length > serverOwnedAcc.length) localHadExtraData = true;

  const localDailyAcc = localUser.accessoryShopDailyPurchases;
  const serverDailyAcc = serverUser.accessoryShopDailyPurchases;
  let mergedAccDaily = serverDailyAcc || localDailyAcc;
  if (localDailyAcc && serverDailyAcc) {
    if (localDailyAcc.dateKey > serverDailyAcc.dateKey) {
      mergedAccDaily = localDailyAcc;
      localHadExtraData = true;
    } else if (
      localDailyAcc.dateKey === serverDailyAcc.dateKey &&
      localDailyAcc.itemsBought > serverDailyAcc.itemsBought
    ) {
      mergedAccDaily = localDailyAcc;
      localHadExtraData = true;
    }
  } else if (localDailyAcc && !serverDailyAcc) {
    mergedAccDaily = localDailyAcc;
    localHadExtraData = true;
  }

  const localAccSpentAhead =
    mergedOwnedAcc.length > serverOwnedAcc.length ||
    (mergedAccDaily === localDailyAcc &&
      (localDailyAcc?.itemsBought || 0) > (serverDailyAcc?.itemsBought || 0));

  const mergedSecondaryCoins = localAccSpentAhead
    ? Math.max(0, Math.floor(Number(localUser.secondaryCoins ?? serverUser.secondaryCoins ?? 0)))
    : Math.max(
        Math.max(0, Math.floor(Number(serverUser.secondaryCoins || 0))),
        Math.max(0, Math.floor(Number(localUser.secondaryCoins || 0)))
      );
  if (
    typeof localUser.secondaryCoins === 'number' &&
    localUser.secondaryCoins !== serverUser.secondaryCoins
  ) {
    localHadExtraData = true;
  }

  const mergedEquippedAccessories =
    localUser.equippedAccessories || serverUser.equippedAccessories;

  const mergedRoomMilestones = Array.from(
    new Set([
      ...(Array.isArray(serverUser.roomBossMilestonesDefeated)
        ? serverUser.roomBossMilestonesDefeated
        : []),
      ...(Array.isArray(localUser.roomBossMilestonesDefeated)
        ? localUser.roomBossMilestonesDefeated
        : []),
    ])
  )
    .map((n) => Math.floor(Number(n)))
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b);

  if (
    mergedRoomMilestones.length >
    (Array.isArray(serverUser.roomBossMilestonesDefeated)
      ? serverUser.roomBossMilestonesDefeated.length
      : 0)
  ) {
    localHadExtraData = true;
  }

  const mergedRoomBestFloor = Math.max(
    Math.floor(Number(serverUser.roomBestFloor || 0)),
    Math.floor(Number(localUser.roomBestFloor || 0))
  );
  if (mergedRoomBestFloor > Math.floor(Number(serverUser.roomBestFloor || 0))) {
    localHadExtraData = true;
  }

  const merged: UserProfile = {
    ...serverUser,
    email: mergedEmail,
    charId: localUser.charId || serverUser.charId || 'goku',
    xp: Math.max(serverXp, localXp),
    coins: mergedCoins,
    secondaryCoins: mergedSecondaryCoins,
    unlockedChars: mergedUnlocked,
    charXpOffsets: mergedOffsets,
    inventory: mergedInventory,
    equippedCosmetics: mergedEquippedCosmetics,
    ownedAccessories: mergedOwnedAcc,
    equippedAccessories: mergedEquippedAccessories,
    shopDailyPurchases: mergedShopDaily,
    accessoryShopDailyPurchases: mergedAccDaily,
    pvpDailyXp: mergedPvpDaily,
    survivalDailyCoins: mergedSurvDaily,
    workoutsDone: Math.max(serverWorkouts, localWorkouts),
    pvpWins: Math.max(serverUser.pvpWins || 0, localUser.pvpWins || 0),
    pvpLosses: Math.max(serverUser.pvpLosses || 0, localUser.pvpLosses || 0),
    survivalBestWave: Math.max(
      serverUser.survivalBestWave || 0,
      localUser.survivalBestWave || 0
    ),
    roomBestFloor: mergedRoomBestFloor,
    roomBossMilestonesDefeated: mergedRoomMilestones,
    prs: prsResult.merged,
    oneRmRecords: oneRmResult.merged,
    history: mergedHistory,
    friends: mergedFriends,
    friendNotifications:
      serverUser.friendNotifications || localUser.friendNotifications,
    groups: mergedGroups,
    customExercises: mergedCustomExercises,
    routines: mergedRoutines,
    routineFolders: mergedFolders,
    storyRoutineId: localUser.storyRoutineId || serverUser.storyRoutineId,
    story: mergedStory,
    profileSetup: localUser.profileSetup || serverUser.profileSetup,
    wellness: mergedWellness,
  };

  return { merged, localHadExtraData };
}

export async function syncDBFromBackups(localDb: AppDB): Promise<AppDB | null> {
  let effectiveLocal = localDb;
  if (!effectiveLocal.sessionUser && !isExplicitlyLoggedOut()) {
    const idbDb = await readFromIDB();
    if (idbDb && idbDb.sessionUser && idbDb.users?.[idbDb.sessionUser]) {
      effectiveLocal = sanitizeDB(idbDb);
    }
  }

  let serverPublicUsers: Record<string, UserProfile> = {};
  let serverGroups: CommunityGroup[] = [];

  try {
    const res = await fetch(apiUrl('/api/auth/me'), {
      credentials: 'include',
      cache: 'no-store',
      headers: authHeaders(),
    });
    if (res.ok) {
      const data = (await res.json()) as AuthSessionPayload;
      serverPublicUsers = data.publicUsers || {};
      serverGroups = data.groups || [];

      if (data.user) {
        serverSessionStatus = 'authenticated';
        setInMemoryAuthTokens(data.sessionToken, data.wsToken);
        const nextDb = buildAppDBFromServerAuth(data);
        const localKey = resolveUsername(effectiveLocal.users, data.user.username);
        const localUser = localKey ? effectiveLocal.users?.[localKey] : undefined;
        const serverUser = nextDb.users[data.user.username];
        const { merged, localHadExtraData } = mergeRichUserProfiles(
          localUser,
          serverUser
        );
        nextDb.users[data.user.username] = merged;

        let restoredLocalActive = false;
        const localActive = localKey
          ? effectiveLocal.activeWorkouts?.[localKey]
          : undefined;
        if (!nextDb.activeWorkouts[data.user.username] && localActive) {
          nextDb.activeWorkouts[data.user.username] = localActive;
          restoredLocalActive = true;
        }

        if (localHadExtraData || restoredLocalActive) {
          pushDBToServer(nextDb, false);
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
    } else if (res.status === 401) {
      serverSessionStatus = 'unauthenticated';
      inMemoryWsToken = null;
    }
  } catch {
    // Offline or cold start: fall through to silent hydration / local cache
  }

  // Preserve saved local/IDB session unless user explicitly logged out,
  // and silently recreate/rehydrate the account in the background for PvP/sync
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
    const serverHydratedUser = resumedData?.user || undefined;
    const finalUser = serverHydratedUser
      ? mergeRichUserProfiles(preservedUser, serverHydratedUser).merged
      : preservedUser;

    const mergedDb = sanitizeDB({
      users: {
        ...serverPublicUsers,
        ...(resumedData?.publicUsers || {}),
        ...effectiveLocal.users,
        [finalUser.username]: finalUser,
      },
      groups:
        resumedData?.groups && resumedData.groups.length > 0
          ? resumedData.groups
          : serverGroups.length > 0
          ? serverGroups
          : effectiveLocal.groups,
      sessionUser: finalUser.username,
      activeWorkouts: {
        ...(effectiveLocal.activeWorkouts || {}),
        ...(resumedData?.activeWorkout && !preservedActive
          ? { [finalUser.username]: resumedData.activeWorkout }
          : {}),
      },
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
  const usernameLower = (profile.username || '').trim().toLowerCase();
  if (inFlightAutoSync && inFlightAutoSync.usernameLower === usernameLower) {
    return inFlightAutoSync.promise;
  }

  const runPromise = (async (): Promise<
    | { ok: true; data: AuthSessionPayload }
    | { ok: false; rejected: boolean }
  > => {
    try {
      const cleanProfile: UserProfile = { ...profile };
      delete cleanProfile.pass;
      const res = await fetch(apiUrl('/api/auth/auto-sync'), {
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
  })();

  inFlightAutoSync = { usernameLower, promise: runPromise };
  try {
    return await runPromise;
  } finally {
    if (inFlightAutoSync?.promise === runPromise) {
      inFlightAutoSync = null;
    }
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
  stageIndex: number;
  nextStage: EvolutionStage | null;
} {
  const char = getCharacterById(charId);
  let current = char.stages[0];
  let currentIdx = 0;
  let next: EvolutionStage | null = null;
  for (let i = 0; i < char.stages.length; i++) {
    if (level >= char.stages[i].levelReq) {
      current = char.stages[i];
      currentIdx = i;
      next = char.stages[i + 1] || null;
    }
  }
  return {
    char,
    stageName: current.phase,
    stageLevel: current.levelReq,
    stageIndex: currentIdx,
    nextStage: next,
  };
}

export function getActiveCharacterStage(
  user: Pick<UserProfile, 'charId' | 'xp' | 'charXpOffsets'>,
  overrideCharId?: string
): {
  char: CharacterDef;
  stageName: string;
  stageLevel: number;
  stageIndex: number;
  nextStage: EvolutionStage | null;
  effectiveLevel: number;
  effectiveXpInfo: ReturnType<typeof getLevelInfo>;
} {
  const targetCharId = overrideCharId || user.charId || 'goku';
  const effectiveXp = getCharacterEffectiveXp(user, targetCharId);
  const effectiveXpInfo = getLevelInfo(effectiveXp);
  const stage = getCharacterStage(targetCharId, effectiveXpInfo.level);
  return {
    ...stage,
    effectiveLevel: effectiveXpInfo.level,
    effectiveXpInfo,
  };
}

export function normalizeExerciseMuscle(
  muscle: string,
  name = ''
): ExerciseDef['muscle'] {
  if (muscle === 'Brazos') {
    if (
      /tr[íi]cep|copa|franc[ée]s|rompecr[áa]neo|patada|kickback|fondo|diamante|jm\s*press|agarre\s*cerrado/i.test(
        name
      )
    ) {
      return 'Tríceps';
    }
    return 'Bíceps';
  }
  return muscle as ExerciseDef['muscle'];
}

export function getMuscleBadge(muscle: string): string {
  const normalized = normalizeExerciseMuscle(muscle);
  switch (normalized) {
    case 'Pecho':
      return 'PEC';
    case 'Espalda':
      return 'ESP';
    case 'Piernas':
      return 'PIE';
    case 'Glúteos':
      return 'GLU';
    case 'Hombros':
      return 'HOM';
    case 'Bíceps':
      return 'BIC';
    case 'Tríceps':
      return 'TRI';
    case 'Abdomen':
      return 'ABD';
    case 'Cardio':
      return 'CAR';
    default:
      return String(normalized).slice(0, 3).toUpperCase() || 'EJ';
  }
}

export function reorderArrayItem<T>(
  items: T[],
  fromIdx: number,
  toIdx: number
): T[] {
  if (
    fromIdx === toIdx ||
    fromIdx < 0 ||
    toIdx < 0 ||
    fromIdx >= items.length ||
    toIdx >= items.length
  ) {
    return items;
  }
  const copy = [...items];
  const [moved] = copy.splice(fromIdx, 1);
  copy.splice(toIdx, 0, moved);
  return copy;
}

export function getAllExercisesForUser(user: UserProfile | null): ExerciseDef[] {
  const customs = (user?.customExercises || []).map((ex) => ({
    ...ex,
    muscle: normalizeExerciseMuscle(ex.muscle, ex.name),
  }));
  return [...BASE_EXERCISES, ...customs];
}

export function getExerciseById(
  id: string,
  user: UserProfile | null
): ExerciseDef | undefined {
  return getAllExercisesForUser(user).find((e) => e.id === id);
}

export function normalizeExerciseKey(raw: string): string {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function getExerciseNameByAnyId(
  user: UserProfile,
  exId: string,
  exNameHint?: string
): string {
  if (exNameHint && exNameHint.trim()) return exNameHint.trim();
  const def = getExerciseById(exId, user);
  if (def?.name) return def.name;
  const hist = user.history || [];
  for (let i = hist.length - 1; i >= 0; i--) {
    const found = hist[i].exercises?.find((e) => e.exId === exId && e.exName);
    if (found?.exName) return found.exName;
  }
  return '';
}

export function getMatchingExerciseIds(
  user: UserProfile,
  exId: string,
  exNameHint?: string
): { ids: Set<string>; normName: string; displayName: string } {
  const displayName = getExerciseNameByAnyId(user, exId, exNameHint);
  const normName = normalizeExerciseKey(displayName);
  const ids = new Set<string>();
  if (exId) ids.add(exId);

  if (normName) {
    for (const def of getAllExercisesForUser(user)) {
      if (normalizeExerciseKey(def.name) === normName) {
        ids.add(def.id);
      }
    }
    for (const r of user.routines || []) {
      for (const re of r.exercises || []) {
        const reDef = getExerciseById(re.exId, user);
        if (reDef && normalizeExerciseKey(reDef.name) === normName) {
          ids.add(re.exId);
        }
      }
    }
    for (const entry of user.history || []) {
      for (const ex of entry.exercises || []) {
        const name = ex.exName || getExerciseById(ex.exId, user)?.name || '';
        if (name && normalizeExerciseKey(name) === normName) {
          ids.add(ex.exId);
        }
      }
    }
  }

  return { ids, normName, displayName };
}

function computeSetPrScore(
  weight: number | '',
  reps: number | '',
  isCardio: boolean,
  isBodyweight: boolean
): number {
  const w = Number(weight) || 0;
  const r = Number(reps) || 0;
  if (isCardio) return w;
  if (isBodyweight && w === 0) return r;
  return w;
}

export function getLastStatsForExercise(
  user: UserProfile,
  exId: string,
  exNameHint?: string
): { weight: number | ''; reps: number | '' } | null {
  const { ids, normName } = getMatchingExerciseIds(user, exId, exNameHint);
  const hist = user.history || [];
  for (let i = hist.length - 1; i >= 0; i--) {
    const found = hist[i].exercises.find((e) => {
      if (ids.has(e.exId)) return true;
      if (!normName) return false;
      const n = e.exName || getExerciseById(e.exId, user)?.name || '';
      return n ? normalizeExerciseKey(n) === normName : false;
    });
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
  exId: string,
  exNameHint?: string
): PreviousExerciseHistory | null {
  const { ids, normName } = getMatchingExerciseIds(user, exId, exNameHint);
  const hist = user.history || [];
  for (let i = hist.length - 1; i >= 0; i--) {
    const entry = hist[i];
    const found = entry.exercises.find((e) => {
      if (ids.has(e.exId)) return true;
      if (!normName) return false;
      const n = e.exName || getExerciseById(e.exId, user)?.name || '';
      return n ? normalizeExerciseKey(n) === normName : false;
    });
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

export function getGlobalExerciseBaseline(
  user: UserProfile,
  exId: string,
  options?: {
    exName?: string;
    isCardio?: boolean;
    isBodyweight?: boolean;
  }
): {
  bestPr: number;
  bestOneRm: number;
  hasPriorRecord: boolean;
} {
  const def = getExerciseById(exId, user);
  const isCardio = options?.isCardio ?? Boolean(def?.isCardio);
  const isBodyweight = options?.isBodyweight ?? Boolean(def?.isBodyweight);
  const { ids, normName } = getMatchingExerciseIds(
    user,
    exId,
    options?.exName || def?.name
  );

  let bestPr = 0;
  let bestOneRm = 0;
  let hasPriorRecord = false;

  for (const id of ids) {
    const prVal = Number(user.prs?.[id] || 0);
    if (Number.isFinite(prVal) && prVal > 0) {
      hasPriorRecord = true;
      if (prVal > bestPr) bestPr = prVal;
    }
    if (!isCardio) {
      const rmVal = Number(user.oneRmRecords?.[id] || 0);
      if (Number.isFinite(rmVal) && rmVal > 0) {
        hasPriorRecord = true;
        const rounded = Math.round(rmVal * 10) / 10;
        if (rounded > bestOneRm) bestOneRm = rounded;
      }
    }
  }

  for (const entry of user.history || []) {
    for (const ex of entry.exercises || []) {
      const exDef = getExerciseById(ex.exId, user);
      const entryName = ex.exName || exDef?.name || '';
      const matches =
        ids.has(ex.exId) ||
        (Boolean(normName) &&
          Boolean(entryName) &&
          normalizeExerciseKey(entryName) === normName);
      if (!matches) continue;

      const doneSets = (ex.sets || []).filter((s) => s.done);
      if (doneSets.length > 0) {
        hasPriorRecord = true;
      }
      for (const s of doneSets) {
        const score = computeSetPrScore(
          s.weight,
          s.reps,
          isCardio || Boolean(exDef?.isCardio),
          isBodyweight || Boolean(exDef?.isBodyweight)
        );
        if (score > bestPr) bestPr = score;
        if (!isCardio && !exDef?.isCardio) {
          const est = calculateEstimated1RM(
            Number(s.weight) || 0,
            Number(s.reps) || 0
          );
          if (est > bestOneRm) bestOneRm = est;
        }
      }
    }
  }

  return {
    bestPr,
    bestOneRm,
    hasPriorRecord,
  };
}

export function getBestOneRmFromHistory(
  user: UserProfile,
  exId: string,
  isCardio = false,
  exNameHint?: string
): number {
  if (isCardio) return 0;
  const { ids, normName } = getMatchingExerciseIds(user, exId, exNameHint);
  let best = 0;
  const hist = user.history || [];
  for (const entry of hist) {
    for (const ex of entry.exercises || []) {
      const exDef = getExerciseById(ex.exId, user);
      const entryName = ex.exName || exDef?.name || '';
      const matches =
        ids.has(ex.exId) ||
        (Boolean(normName) &&
          Boolean(entryName) &&
          normalizeExerciseKey(entryName) === normName);
      if (!matches) continue;
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
  isCardio = false,
  exNameHint?: string
): number {
  if (isCardio) return 0;
  const { ids } = getMatchingExerciseIds(user, exId, exNameHint);
  let stored = 0;
  for (const id of ids) {
    const val = Number(user.oneRmRecords?.[id] || 0);
    if (Number.isFinite(val) && val > stored) stored = val;
  }
  const fromHistory = getBestOneRmFromHistory(user, exId, isCardio, exNameHint);
  return Math.max(
    stored > 0 ? Math.round(stored * 10) / 10 : 0,
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

export interface GlobalRecordDisplayEntry {
  key: string;
  exId: string;
  name: string;
  pr: number;
  oneRm: number;
  isCardio: boolean;
  isBodyweight: boolean;
}

export function getGlobalDisplayRecords(
  user: UserProfile
): GlobalRecordDisplayEntry[] {
  const oneRmMap = getAllOneRmRecordEntries(user);
  const allIds = Array.from(
    new Set([...Object.keys(user.prs || {}), ...Object.keys(oneRmMap)])
  );
  const byNormKey = new Map<string, GlobalRecordDisplayEntry>();

  for (const exId of allIds) {
    const ex = getExerciseById(exId, user);
    const fallbackName =
      ex?.name || getExerciseNameByAnyId(user, exId) || '';
    if (!fallbackName) continue;
    const normKey = normalizeExerciseKey(fallbackName) || exId;
    const prVal = Number(user.prs?.[exId] || 0);
    const oneRmVal = ex?.isCardio ? 0 : Number(oneRmMap[exId] || 0);
    if (prVal <= 0 && oneRmVal <= 0) continue;

    const existing = byNormKey.get(normKey);
    if (!existing) {
      byNormKey.set(normKey, {
        key: normKey,
        exId,
        name: fallbackName,
        pr: prVal,
        oneRm: oneRmVal,
        isCardio: Boolean(ex?.isCardio),
        isBodyweight: Boolean(ex?.isBodyweight),
      });
    } else {
      existing.pr = Math.max(existing.pr, prVal);
      existing.oneRm = Math.max(existing.oneRm, oneRmVal);
    }
  }

  return Array.from(byNormKey.values());
}

export function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

function playAnimeRestSequence(ctx: AudioContext): void {
  const now = ctx.currentTime;

  // Energetic ascending anime aura sweep
  const sweep = ctx.createOscillator();
  const sweepGain = ctx.createGain();
  sweep.type = 'triangle';
  sweep.frequency.setValueAtTime(330, now);
  sweep.frequency.exponentialRampToValueAtTime(660, now + 0.11);
  sweep.frequency.exponentialRampToValueAtTime(990, now + 0.22);
  sweepGain.gain.setValueAtTime(0.001, now);
  sweepGain.gain.linearRampToValueAtTime(0.075, now + 0.025);
  sweepGain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
  sweep.connect(sweepGain);
  sweepGain.connect(ctx.destination);
  sweep.start(now);
  sweep.stop(now + 0.25);

  // Crisp rising two-chime anime ready signal (E5 -> B5 -> E6)
  const notes = [
    { freq: 659.25, start: 0.08, dur: 0.14, peak: 0.07 },
    { freq: 987.77, start: 0.16, dur: 0.16, peak: 0.075 },
    { freq: 1318.51, start: 0.24, dur: 0.22, peak: 0.085 },
  ];
  for (const n of notes) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(n.freq, now + n.start);
    g.gain.setValueAtTime(0.001, now + n.start);
    g.gain.linearRampToValueAtTime(n.peak, now + n.start + 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, now + n.start + n.dur);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(now + n.start);
    osc.stop(now + n.start + n.dur + 0.01);
  }
}

export function beepRestDone(): void {
  try {
    const ctx = getCombatAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      void ctx
        .resume()
        .then(() => {
          playAnimeRestSequence(ctx);
        })
        .catch(() => {
          // ignore mobile WebAudio restrictions
        });
      return;
    }
    playAnimeRestSequence(ctx);
  } catch {
    // ignore audio restrictions
  }
}

export function playStreakCelebrationSound(): void {
  try {
    const ctx = getCombatAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      void ctx.resume();
    }
    const now = ctx.currentTime;
    const notes = [
      { freq: 587.33, start: 0, dur: 0.12, peak: 0.055 },
      { freq: 783.99, start: 0.09, dur: 0.14, peak: 0.065 },
      { freq: 1174.66, start: 0.18, dur: 0.24, peak: 0.07 },
    ];
    for (const n of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(n.freq, now + n.start);
      gain.gain.setValueAtTime(0.001, now + n.start);
      gain.gain.linearRampToValueAtTime(n.peak, now + n.start + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.001, now + n.start + n.dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + n.start);
      osc.stop(now + n.start + n.dur + 0.02);
    }
  } catch {
    // ignore mobile WebAudio restrictions cleanly
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

export const STORY_DAY_MS = 24 * 60 * 60 * 1000;
export const STORY_WEEK_MS = STORY_DAY_MS;

export function getStoryDailyStatus(lastCompletedAt?: string | null): {
  canCompleteNewChapter: boolean;
  remainingMs: number;
  nextAvailableDate: Date | null;
  elapsedDays: number;
} {
  if (!lastCompletedAt) {
    return {
      canCompleteNewChapter: true,
      remainingMs: 0,
      nextAvailableDate: null,
      elapsedDays: 1,
    };
  }
  const ts = Date.parse(lastCompletedAt);
  if (!Number.isFinite(ts)) {
    return {
      canCompleteNewChapter: true,
      remainingMs: 0,
      nextAvailableDate: null,
      elapsedDays: 1,
    };
  }
  const nowDate = new Date();
  const lastDate = new Date(ts);
  const todayStart = new Date(
    nowDate.getFullYear(),
    nowDate.getMonth(),
    nowDate.getDate()
  ).getTime();
  const lastDayStart = new Date(
    lastDate.getFullYear(),
    lastDate.getMonth(),
    lastDate.getDate()
  ).getTime();
  const elapsedDays = Math.max(
    0,
    Math.floor((todayStart - lastDayStart) / STORY_DAY_MS)
  );
  const canCompleteNewChapter =
    elapsedDays >= 1 || nowDate.getTime() - ts >= STORY_DAY_MS;

  if (canCompleteNewChapter) {
    return {
      canCompleteNewChapter: true,
      remainingMs: 0,
      nextAvailableDate: null,
      elapsedDays: Math.max(1, elapsedDays),
    };
  }

  const nextMidnight = new Date(
    nowDate.getFullYear(),
    nowDate.getMonth(),
    nowDate.getDate() + 1
  ).getTime();
  const remainingMs = Math.max(0, nextMidnight - nowDate.getTime());
  return {
    canCompleteNewChapter: false,
    remainingMs,
    nextAvailableDate: new Date(nextMidnight),
    elapsedDays: 0,
  };
}

export function formatDailyCountdown(ms: number): string {
  const totalMin = Math.max(1, Math.ceil(ms / 60000));
  const days = Math.floor(totalMin / (60 * 24));
  const hours = Math.floor((totalMin % (60 * 24)) / 60);
  const mins = totalMin % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

export const getStoryWeeklyStatus = getStoryDailyStatus;
export const formatWeeklyCountdown = formatDailyCountdown;

// =========================================================================
// Daily Streak Engine (Local Device Calendar Date — NO UTC, Sunday Paused)
// =========================================================================

export function toLocalDateKey(input: Date | string | number): string | null {
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }
  }
  const dt = input instanceof Date ? input : new Date(input);
  const ms = dt.getTime();
  if (!Number.isFinite(ms)) return null;
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseLocalNoon(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0, 0);
}

function addLocalCalendarDays(dt: Date, delta: number): Date {
  const copy = new Date(dt.getTime());
  copy.setDate(copy.getDate() + delta);
  return copy;
}

/**
 * Checks calendar days strictly between `earlierKey` and `laterKey`.
 * - Missing any Monday..Saturday (dayOfWeek !== 0) breaks the streak -> returns true.
 * - Gaps made purely of Sunday (dayOfWeek === 0) preserve the streak -> returns false.
 */
export function didMissNonSundayWeekdayBetween(
  earlierKey: string,
  laterKey: string
): boolean {
  if (earlierKey >= laterKey) return false;
  let cursor = addLocalCalendarDays(parseLocalNoon(earlierKey), 1);
  let guard = 0;
  while (guard < 4000) {
    guard++;
    const key = toLocalDateKey(cursor);
    if (!key || key >= laterKey) break;
    if (cursor.getDay() !== 0) {
      return true;
    }
    cursor = addLocalCalendarDays(cursor, 1);
  }
  return false;
}

function hasSundayStrictlyBetweenOrToday(
  earlierKey: string,
  laterKey: string
): boolean {
  if (earlierKey >= laterKey) return false;
  let cursor = addLocalCalendarDays(parseLocalNoon(earlierKey), 1);
  let guard = 0;
  while (guard < 4000) {
    guard++;
    const key = toLocalDateKey(cursor);
    if (!key || key > laterKey) break;
    if (cursor.getDay() === 0) {
      return true;
    }
    cursor = addLocalCalendarDays(cursor, 1);
  }
  return false;
}

export interface DailyStreakSummary {
  currentStreak: number;
  bestStreak: number;
  trainedToday: boolean;
  pausedOnSunday: boolean;
  lastWorkoutLocalDate: string | null;
}

export function computeDailyStreakSummary(
  userOrParams:
    | UserProfile
    | {
        historyDates?: string[];
        dailyStreakCount?: number;
        dailyStreakBest?: number;
        dailyStreakLastDate?: string | null;
      },
  now: Date = new Date()
): DailyStreakSummary {
  const historyDates =
    'history' in userOrParams
      ? (userOrParams.history || []).map((h) => h.date)
      : userOrParams.historyDates || [];
  const storedCount = Math.max(0, Number(userOrParams.dailyStreakCount || 0) || 0);
  const storedBest = Math.max(0, Number(userOrParams.dailyStreakBest || 0) || 0);
  const storedLast = userOrParams.dailyStreakLastDate || null;

  const uniqueSet = new Set<string>();
  for (const raw of historyDates) {
    const k = toLocalDateKey(raw);
    if (k) uniqueSet.add(k);
  }
  if (storedLast) {
    const k = toLocalDateKey(storedLast);
    if (k) uniqueSet.add(k);
  }

  const dayKeys = Array.from(uniqueSet).sort((a, b) => (a > b ? -1 : 1));
  const todayKey = toLocalDateKey(now) || '';

  if (dayKeys.length === 0) {
    return {
      currentStreak: 0,
      bestStreak: storedBest,
      trainedToday: false,
      pausedOnSunday: false,
      lastWorkoutLocalDate: null,
    };
  }

  // Compute run lengths across all recorded local workout days
  let runFromLatest = 1;
  for (let i = 1; i < dayKeys.length; i++) {
    if (!didMissNonSundayWeekdayBetween(dayKeys[i], dayKeys[i - 1])) {
      runFromLatest++;
    } else {
      break;
    }
  }

  // If history array was capped (e.g. latest 40-60 entries) and every entry connects,
  // honor persisted storedCount if it belongs to the same latest workout day.
  if (
    runFromLatest === dayKeys.length &&
    storedCount > runFromLatest &&
    storedLast === dayKeys[0]
  ) {
    runFromLatest = storedCount;
  }

  // Also compute historical max run for bestStreak
  let maxHistoricalRun = runFromLatest;
  let curRun = 1;
  for (let i = 1; i < dayKeys.length; i++) {
    if (!didMissNonSundayWeekdayBetween(dayKeys[i], dayKeys[i - 1])) {
      curRun++;
      if (curRun > maxHistoricalRun) maxHistoricalRun = curRun;
    } else {
      curRun = 1;
    }
  }

  const latestKey = dayKeys[0];
  const trainedToday = latestKey >= todayKey;
  const brokenBeforeToday =
    !trainedToday && didMissNonSundayWeekdayBetween(latestKey, todayKey);

  const currentStreak = brokenBeforeToday ? 0 : runFromLatest;
  const pausedOnSunday =
    !brokenBeforeToday &&
    !trainedToday &&
    hasSundayStrictlyBetweenOrToday(latestKey, todayKey);

  return {
    currentStreak,
    bestStreak: Math.max(storedBest, maxHistoricalRun, currentStreak),
    trainedToday,
    pausedOnSunday,
    lastWorkoutLocalDate: latestKey,
  };
}

export function computeNextDailyStreakOnWorkout(
  user: UserProfile,
  now: Date = new Date()
): {
  prevStreak: number;
  nextStreak: number;
  bestStreak: number;
  localDateKey: string;
  pausedSundayToday: boolean;
} {
  const summary = computeDailyStreakSummary(user, now);
  const todayKey = toLocalDateKey(now) || '';
  const prevStreak = summary.currentStreak;

  if (summary.trainedToday) {
    const nextStreak = Math.max(1, prevStreak);
    return {
      prevStreak,
      nextStreak,
      bestStreak: Math.max(summary.bestStreak, nextStreak),
      localDateKey: todayKey,
      pausedSundayToday: false,
    };
  }

  if (prevStreak > 0) {
    const nextStreak = prevStreak + 1;
    return {
      prevStreak,
      nextStreak,
      bestStreak: Math.max(summary.bestStreak, nextStreak),
      localDateKey: todayKey,
      pausedSundayToday: summary.pausedOnSunday,
    };
  }

  return {
    prevStreak: 0,
    nextStreak: 1,
    bestStreak: Math.max(summary.bestStreak, 1),
    localDateKey: todayKey,
    pausedSundayToday: false,
  };
}

export function playEvolutionSound(evolved: boolean): void {
  try {
    const ctx = getCombatAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      void ctx.resume();
    }
    const now = ctx.currentTime;

    if (evolved) {
      // Energetic power-up surge + ascending evolution chord
      const surge = ctx.createOscillator();
      const surgeGain = ctx.createGain();
      surge.type = 'sawtooth';
      surge.frequency.setValueAtTime(140, now);
      surge.frequency.exponentialRampToValueAtTime(520, now + 0.45);
      surgeGain.gain.setValueAtTime(0.001, now);
      surgeGain.gain.linearRampToValueAtTime(0.045, now + 0.08);
      surgeGain.gain.exponentialRampToValueAtTime(0.001, now + 0.48);
      surge.connect(surgeGain);
      surgeGain.connect(ctx.destination);
      surge.start(now);
      surge.stop(now + 0.5);

      const notes = [
        { freq: 523.25, start: 0.25, dur: 0.16, peak: 0.06 },
        { freq: 659.25, start: 0.37, dur: 0.16, peak: 0.065 },
        { freq: 783.99, start: 0.49, dur: 0.18, peak: 0.07 },
        { freq: 1046.5, start: 0.62, dur: 0.36, peak: 0.08 },
      ];
      for (const n of notes) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(n.freq, now + n.start);
        gain.gain.setValueAtTime(0.001, now + n.start);
        gain.gain.linearRampToValueAtTime(n.peak, now + n.start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + n.start + n.dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + n.start);
        osc.stop(now + n.start + n.dur + 0.02);
      }
    } else {
      const notes = [
        { freq: 587.33, start: 0, dur: 0.14, peak: 0.05 },
        { freq: 880, start: 0.1, dur: 0.24, peak: 0.06 },
      ];
      for (const n of notes) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(n.freq, now + n.start);
        gain.gain.setValueAtTime(0.001, now + n.start);
        gain.gain.linearRampToValueAtTime(n.peak, now + n.start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + n.start + n.dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + n.start);
        osc.stop(now + n.start + n.dur + 0.02);
      }
    }
  } catch {
    // ignore WebAudio restrictions
  }
}

export function getSurvivalWaveXpReward(waveNumber: number): number {
  const w = Math.max(1, Math.floor(waveNumber));
  return Math.round(25 + w * 9 + Math.floor(w / 5) * 10);
}

export function computeSurvivalRecordXpReward(
  clearedWave: number,
  prevBestWave: number
): {
  xpEarned: number;
  isNewRecord: boolean;
  nextBestWave: number;
} {
  const wave = Math.max(1, Math.floor(clearedWave));
  const best = Math.max(0, Math.floor(prevBestWave || 0));
  if (wave <= best) {
    return {
      xpEarned: 0,
      isNewRecord: false,
      nextBestWave: best,
    };
  }
  let xpEarned = 0;
  for (let w = best + 1; w <= wave; w++) {
    xpEarned += getSurvivalWaveXpReward(w);
  }
  return {
    xpEarned,
    isNewRecord: true,
    nextBestWave: wave,
  };
}

export function computeWorkoutCoinReward(
  baseVolumeXp: number,
  surpassedExerciseCount: number
): number {
  return Math.max(
    12,
    12 +
      Math.min(24, Math.floor(Math.max(0, baseVolumeXp) / 8)) +
      Math.min(12, Math.max(0, surpassedExerciseCount) * 4)
  );
}

export function computeStoryCoinReward(chapterNumber: number): number {
  const num = Math.max(1, Math.floor(chapterNumber));
  return 24 + Math.min(26, Math.floor(num / 3));
}

export function computeSurvivalCoinReward(
  user: Pick<UserProfile, 'survivalDailyCoins'>,
  clearedWave: number,
  isNewRecord: boolean,
  dateKey: string = toShopLocalDateKey(new Date())
): {
  coinsEarned: number;
  nextTracker: { dateKey: string; coinsEarned: number };
} {
  const prevTracker = user.survivalDailyCoins;
  const usedToday =
    prevTracker && prevTracker.dateKey === dateKey
      ? Math.max(0, Number(prevTracker.coinsEarned || 0))
      : 0;
  const remainingCap = Math.max(0, DAILY_SURVIVAL_COIN_CAP - usedToday);
  const rawCoins = isNewRecord
    ? 10 + Math.min(20, clearedWave * 2)
    : clearedWave >= 2
    ? 3
    : 1;
  const coinsEarned = Math.min(remainingCap, rawCoins);
  return {
    coinsEarned,
    nextTracker: {
      dateKey,
      coinsEarned: usedToday + coinsEarned,
    },
  };
}

export interface ShopTransactionResult {
  ok: boolean;
  error?: string;
  user?: UserProfile;
  balanceBefore: number;
  balanceAfter: number;
  deltaCoins: number;
  xpAdded?: number;
}

export function buyShopItemTransaction(
  user: UserProfile,
  itemId: string,
  dateKey: string = toShopLocalDateKey(new Date())
): ShopTransactionResult {
  const balanceBefore = Math.max(0, Math.floor(Number(user.coins || 0)));
  const rotation = getDailyShopRotation(dateKey);
  const item = rotation.items.find((i) => i.id === itemId);
  if (!item) {
    return {
      ok: false,
      error: 'Este objeto no está en la rotación diaria de hoy.',
      balanceBefore,
      balanceAfter: balanceBefore,
      deltaCoins: 0,
    };
  }

  const boughtToday = getUserDailyShopPurchasesCount(user, dateKey);
  if (boughtToday >= DAILY_ITEM_PURCHASE_LIMIT) {
    return {
      ok: false,
      error: `Alcanzaste el límite diario de compras (${DAILY_ITEM_PURCHASE_LIMIT}/${DAILY_ITEM_PURCHASE_LIMIT}). Vuelve mañana.`,
      balanceBefore,
      balanceAfter: balanceBefore,
      deltaCoins: 0,
    };
  }

  const currentInv = [...(user.inventory || [])];
  const existingIdx = currentInv.findIndex((e) => e.itemId === item.id);
  if (
    isSingleOwnershipCosmetic(item.category) &&
    existingIdx >= 0 &&
    currentInv[existingIdx].quantity > 0
  ) {
    return {
      ok: false,
      error: 'Ya posees este artículo estético en tu inventario.',
      balanceBefore,
      balanceAfter: balanceBefore,
      deltaCoins: 0,
    };
  }

  if (balanceBefore < item.price) {
    return {
      ok: false,
      error: `Necesitas ${item.price} monedas (tienes ${balanceBefore}).`,
      balanceBefore,
      balanceAfter: balanceBefore,
      deltaCoins: 0,
    };
  }

  if (existingIdx >= 0) {
    currentInv[existingIdx] = {
      ...currentInv[existingIdx],
      quantity: currentInv[existingIdx].quantity + 1,
      lastBuyPrice: item.price,
    };
  } else {
    currentInv.push({
      itemId: item.id,
      quantity: 1,
      lastBuyPrice: item.price,
    });
  }

  const balanceAfter = balanceBefore - item.price;
  const nextUser: UserProfile = {
    ...user,
    coins: balanceAfter,
    inventory: currentInv,
    shopDailyPurchases: {
      dateKey,
      itemsBought: boughtToday + 1,
    },
  };

  return {
    ok: true,
    user: nextUser,
    balanceBefore,
    balanceAfter,
    deltaCoins: -item.price,
  };
}

export function buyShopCharacterTransaction(
  user: UserProfile,
  charId: string,
  dateKey: string = toShopLocalDateKey(new Date())
): ShopTransactionResult {
  const balanceBefore = Math.max(0, Math.floor(Number(user.coins || 0)));
  const rotation = getDailyShopRotation(dateKey);
  const charDef = rotation.characters.find((c) => c.id === charId);
  if (!charDef) {
    return {
      ok: false,
      error: 'Este personaje no está en la rotación de tienda de hoy.',
      balanceBefore,
      balanceAfter: balanceBefore,
      deltaCoins: 0,
    };
  }

  const unlocked = getUnlockedCharacterIds(user);
  if (unlocked.includes(charDef.id)) {
    return {
      ok: false,
      error: `Ya tienes desbloqueado a ${charDef.name}.`,
      balanceBefore,
      balanceAfter: balanceBefore,
      deltaCoins: 0,
    };
  }

  const price = getCharacterShopPrice(charDef);
  if (balanceBefore < price) {
    return {
      ok: false,
      error: `Necesitas ${price} monedas para reclutar a ${charDef.name}.`,
      balanceBefore,
      balanceAfter: balanceBefore,
      deltaCoins: 0,
    };
  }

  const balanceAfter = balanceBefore - price;
  const nextUser: UserProfile = {
    ...user,
    coins: balanceAfter,
    unlockedChars: [...unlocked, charDef.id],
    // Always unlock newly bought characters in Phase 1 so they evolve with user progress
    charXpOffsets: {
      ...(user.charXpOffsets || {}),
      [charDef.id]: Math.max(0, Number(user.xp || 0)),
    },
  };

  return {
    ok: true,
    user: nextUser,
    balanceBefore,
    balanceAfter,
    deltaCoins: -price,
  };
}

export function sellInventoryItemTransaction(
  user: UserProfile,
  itemId: string
): ShopTransactionResult {
  const balanceBefore = Math.max(0, Math.floor(Number(user.coins || 0)));
  const currentInv = [...(user.inventory || [])];
  const idx = currentInv.findIndex((e) => e.itemId === itemId && e.quantity > 0);
  if (idx < 0) {
    return {
      ok: false,
      error: 'No tienes unidades disponibles para vender.',
      balanceBefore,
      balanceAfter: balanceBefore,
      deltaCoins: 0,
    };
  }

  const def = getShopItemById(itemId);
  const buyPrice = currentInv[idx].lastBuyPrice ?? def?.price ?? 0;
  const refund = getResaleValue(buyPrice);

  const nextQty = currentInv[idx].quantity - 1;
  const nextInv =
    nextQty > 0
      ? currentInv.map((e, i) => (i === idx ? { ...e, quantity: nextQty } : e))
      : currentInv.filter((_, i) => i !== idx);

  // Unequip if no copies remain
  const eq = { ...(user.equippedCosmetics || {}) };
  if (nextQty <= 0) {
    if (eq.auraId === itemId) eq.auraId = null;
    if (eq.titleId === itemId) eq.titleId = null;
    if (eq.emblemId === itemId) eq.emblemId = null;
    if (eq.pvpIntroId === itemId) eq.pvpIntroId = null;
    if (eq.pvpFinisherId === itemId) eq.pvpFinisherId = null;
  }

  const balanceAfter = balanceBefore + refund;
  return {
    ok: true,
    user: {
      ...user,
      coins: balanceAfter,
      inventory: nextInv,
      equippedCosmetics: eq,
    },
    balanceBefore,
    balanceAfter,
    deltaCoins: refund,
  };
}

export function consumeInventoryItemTransaction(
  user: UserProfile,
  itemId: string
): ShopTransactionResult {
  const balanceBefore = Math.max(0, Math.floor(Number(user.coins || 0)));
  const currentInv = [...(user.inventory || [])];
  const idx = currentInv.findIndex((e) => e.itemId === itemId && e.quantity > 0);
  if (idx < 0) {
    return {
      ok: false,
      error: 'No te quedan unidades de este objeto.',
      balanceBefore,
      balanceAfter: balanceBefore,
      deltaCoins: 0,
    };
  }

  const def = getShopItemById(itemId);
  const nextQty = currentInv[idx].quantity - 1;
  const nextInv =
    nextQty > 0
      ? currentInv.map((e, i) => (i === idx ? { ...e, quantity: nextQty } : e))
      : currentInv.filter((_, i) => i !== idx);

  let nextXp = Math.max(0, Number(user.xp || 0));
  let xpAdded = 0;
  if (def?.effectKind === 'xp' && (def.effectValue || 0) > 0) {
    xpAdded = Math.round(def.effectValue || 0);
    nextXp += xpAdded;
  }

  return {
    ok: true,
    user: {
      ...user,
      xp: nextXp,
      inventory: nextInv,
    },
    balanceBefore,
    balanceAfter: balanceBefore,
    deltaCoins: 0,
    xpAdded,
  };
}

export function equipCosmeticTransaction(
  user: UserProfile,
  itemId: string
): UserProfile {
  const def = getShopItemById(itemId);
  if (!def) return user;
  const owned = (user.inventory || []).some(
    (e) => e.itemId === itemId && e.quantity > 0
  );
  if (!owned) return user;

  const eq = { ...(user.equippedCosmetics || {}) };
  if (def.category === 'cosmetic_aura') {
    eq.auraId = eq.auraId === itemId ? null : itemId;
  } else if (def.category === 'cosmetic_title') {
    eq.titleId = eq.titleId === itemId ? null : itemId;
  } else if (def.category === 'cosmetic_emblem') {
    eq.emblemId = eq.emblemId === itemId ? null : itemId;
  } else if (def.category === 'pvp_intro') {
    eq.pvpIntroId = eq.pvpIntroId === itemId ? null : itemId;
  } else if (def.category === 'pvp_finisher') {
    eq.pvpFinisherId = eq.pvpFinisherId === itemId ? null : itemId;
  }
  return {
    ...user,
    equippedCosmetics: eq,
  };
}

export function computeStorySecondaryReward(chapterNumber: number): number {
  const num = Math.max(1, Math.floor(chapterNumber));
  return 18 + Math.min(22, Math.floor(num / 2));
}

export function computeRoomClearSecondaryReward(
  user: Pick<UserProfile, 'roomBestFloor' | 'roomBossMilestonesDefeated'>,
  clearedRoom: number
): {
  baseSecondary: number;
  firstBossBonus: number;
  totalSecondaryEarned: number;
  isBossRoom: boolean;
  isFirstBossMilestone: boolean;
  isNewBestFloor: boolean;
  nextBestFloor: number;
  nextBossMilestones: number[];
} {
  const room = Math.max(1, Math.floor(clearedRoom));
  const isBossRoom = room % 10 === 0;
  const isRespiteRoom = room % 5 === 0 && !isBossRoom;
  const prevBest = Math.max(0, Math.floor(Number(user.roomBestFloor || 0)));
  const isNewBestFloor = room > prevBest;
  const nextBestFloor = Math.max(prevBest, room);

  const prevMilestones = Array.isArray(user.roomBossMilestonesDefeated)
    ? user.roomBossMilestonesDefeated
        .map((n) => Math.floor(Number(n)))
        .filter((n) => Number.isFinite(n) && n > 0)
    : [];
  const isFirstBossMilestone = isBossRoom && !prevMilestones.includes(room);
  const nextBossMilestones = isFirstBossMilestone
    ? [...prevMilestones, room].sort((a, b) => a - b)
    : prevMilestones;

  const baseSecondary = isBossRoom
    ? 28 + Math.min(35, Math.floor(room / 2))
    : isRespiteRoom
    ? 4
    : 6 + Math.min(12, Math.floor(room / 4));
  const firstBossBonus = isFirstBossMilestone
    ? 40 + Math.min(60, Math.floor(room * 1.5))
    : 0;

  return {
    baseSecondary,
    firstBossBonus,
    totalSecondaryEarned: baseSecondary + firstBossBonus,
    isBossRoom,
    isFirstBossMilestone,
    isNewBestFloor,
    nextBestFloor,
    nextBossMilestones,
  };
}

export interface AccessoryTransactionResult {
  ok: boolean;
  error?: string;
  user?: UserProfile;
  balanceBefore: number;
  balanceAfter: number;
  deltaSecondary: number;
}

export function buyAccessoryShopItemTransaction(
  user: UserProfile,
  accessoryId: string,
  dateKey: string = toShopLocalDateKey(new Date())
): AccessoryTransactionResult {
  const balanceBefore = Math.max(0, Math.floor(Number(user.secondaryCoins || 0)));
  const rotation = getDailyAccessoryShopRotation(dateKey);
  const item = rotation.items.find((i) => i.id === accessoryId);
  if (!item) {
    return {
      ok: false,
      error: 'Este accesorio no forma parte de la rotación diaria de hoy.',
      balanceBefore,
      balanceAfter: balanceBefore,
      deltaSecondary: 0,
    };
  }

  const owned = getOwnedAccessoryIds(user);
  if (owned.includes(item.id)) {
    return {
      ok: false,
      error: 'Ya posees este accesorio en tu inventario.',
      balanceBefore,
      balanceAfter: balanceBefore,
      deltaSecondary: 0,
    };
  }

  const boughtToday = getUserAccessoryDailyPurchasesCount(user, dateKey);
  if (boughtToday >= ACCESSORY_DAILY_PURCHASE_LIMIT) {
    return {
      ok: false,
      error: `Límite diario alcanzado (${ACCESSORY_DAILY_PURCHASE_LIMIT}/${ACCESSORY_DAILY_PURCHASE_LIMIT} accesorios hoy). Vuelve mañana.`,
      balanceBefore,
      balanceAfter: balanceBefore,
      deltaSecondary: 0,
    };
  }

  if (balanceBefore < item.price) {
    return {
      ok: false,
      error: `Necesitas ${item.price} ${SECONDARY_CURRENCY_NAME} (tienes ${balanceBefore}).`,
      balanceBefore,
      balanceAfter: balanceBefore,
      deltaSecondary: 0,
    };
  }

  const balanceAfter = balanceBefore - item.price;
  const nextOwned = [...owned, item.id];
  const prevEq = { ...(user.equippedAccessories || {}) };
  const slotKey = getAccessorySlotKey(item.slot);
  // Auto-equip if that slot is currently empty for immediate gratification
  const nextEq = prevEq[slotKey] ? prevEq : { ...prevEq, [slotKey]: item.id };

  return {
    ok: true,
    user: {
      ...user,
      secondaryCoins: balanceAfter,
      ownedAccessories: nextOwned,
      equippedAccessories: nextEq,
      accessoryShopDailyPurchases: {
        dateKey,
        itemsBought: boughtToday + 1,
      },
    },
    balanceBefore,
    balanceAfter,
    deltaSecondary: -item.price,
  };
}

export function equipAccessoryTransaction(
  user: UserProfile,
  accessoryId: string | null,
  slotOverride?: keyof NonNullable<UserProfile['equippedAccessories']>
): UserProfile {
  if (!accessoryId) {
    if (!slotOverride) return user;
    return {
      ...user,
      equippedAccessories: {
        ...(user.equippedAccessories || {}),
        [slotOverride]: null,
      },
    };
  }
  const def = getAccessoryById(accessoryId);
  if (!def) return user;
  const owned = getOwnedAccessoryIds(user);
  if (!owned.includes(def.id)) return user;
  const slotKey = getAccessorySlotKey(def.slot);
  const currentEq = { ...(user.equippedAccessories || {}) };
  currentEq[slotKey] = currentEq[slotKey] === def.id ? null : def.id;
  return {
    ...user,
    equippedAccessories: currentEq,
  };
}



