import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActiveWorkout, UserProfile } from '../types/animefit';

export const INACTIVITY_THRESHOLD_MS = 24 * 60 * 60 * 1000;

const LOCAL_KEY = 'animefit_reminder_state_v1';
const REMINDER_DB_NAME = 'animefit-reminder-db';
const REMINDER_STORE_NAME = 'state';
const REMINDER_RECORD_KEY = 'current';

interface ReminderPersistedState {
  enabled: boolean;
  username?: string;
  lastActivityAt: number;
  lastNotifiedAt: number;
}

interface PeriodicSyncManagerLike {
  register: (tag: string, options?: { minInterval?: number }) => Promise<void>;
  unregister?: (tag: string) => Promise<void>;
}

interface SWRegistrationWithPeriodicSync extends ServiceWorkerRegistration {
  periodicSync?: PeriodicSyncManagerLike;
}

function getTodayDateKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function readLocalReminderState(): ReminderPersistedState {
  if (typeof window === 'undefined') {
    return { enabled: false, lastActivityAt: 0, lastNotifiedAt: 0 };
  }
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ReminderPersistedState>;
      return {
        enabled: Boolean(parsed.enabled),
        username: typeof parsed.username === 'string' ? parsed.username : undefined,
        lastActivityAt:
          typeof parsed.lastActivityAt === 'number' && Number.isFinite(parsed.lastActivityAt)
            ? parsed.lastActivityAt
            : 0,
        lastNotifiedAt:
          typeof parsed.lastNotifiedAt === 'number' && Number.isFinite(parsed.lastNotifiedAt)
            ? parsed.lastNotifiedAt
            : 0,
      };
    }
  } catch {
    // ignore storage errors
  }
  return { enabled: false, lastActivityAt: 0, lastNotifiedAt: 0 };
}

function writeLocalReminderState(state: ReminderPersistedState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LOCAL_KEY, JSON.stringify(state));
  } catch {
    // ignore storage errors
  }
}

function writeReminderStateToIDB(state: ReminderPersistedState): Promise<void> {
  if (typeof indexedDB === 'undefined') return Promise.resolve();
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(REMINDER_DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(REMINDER_STORE_NAME)) {
          db.createObjectStore(REMINDER_STORE_NAME);
        }
      };
      req.onsuccess = () => {
        const db = req.result;
        try {
          const tx = db.transaction(REMINDER_STORE_NAME, 'readwrite');
          tx.objectStore(REMINDER_STORE_NAME).put(state, REMINDER_RECORD_KEY);
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => {
            db.close();
            resolve();
          };
        } catch {
          db.close();
          resolve();
        }
      };
      req.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

function getLatestProfileActivityMs(
  user: UserProfile | null,
  activeWorkout: ActiveWorkout | null
): number {
  if (!user) return 0;
  let latest = 0;

  for (const h of user.history || []) {
    const t = new Date(h.date).getTime();
    if (Number.isFinite(t) && t > latest) {
      latest = t;
    }
  }

  if (activeWorkout?.startedAt && activeWorkout.startedAt > latest) {
    latest = activeWorkout.startedAt;
  }

  if (user.story?.lastChapterCompletedAt) {
    const t = new Date(user.story.lastChapterCompletedAt).getTime();
    if (Number.isFinite(t) && t > latest) {
      latest = t;
    }
  }

  return latest;
}

async function requestBrowserNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }
  try {
    const maybePromise = Notification.requestPermission();
    if (
      maybePromise &&
      typeof (maybePromise as Promise<NotificationPermission>).then === 'function'
    ) {
      return await maybePromise;
    }
  } catch {
    try {
      return await new Promise<NotificationPermission>((resolve) => {
        Notification.requestPermission((perm) => resolve(perm));
      });
    } catch {
      return Notification.permission;
    }
  }
  return Notification.permission;
}

async function showNotificationThroughPWA(
  title: string,
  body: string
): Promise<boolean> {
  if (
    typeof window === 'undefined' ||
    !('Notification' in window) ||
    window.isSecureContext === false
  ) {
    return false;
  }
  if (Notification.permission !== 'granted') {
    return false;
  }

  if ('serviceWorker' in navigator) {
    try {
      const reg = await Promise.race<ServiceWorkerRegistration | null>([
        navigator.serviceWorker.ready,
        new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 1500)),
      ]);
      if (reg && typeof reg.showNotification === 'function') {
        await reg.showNotification(title, {
          body,
          icon: '/pwa-192x192.png',
          badge: '/pwa-192x192.png',
          tag: 'animefit-inactivity-24h',
          data: { url: '/' },
        });
        return true;
      }
    } catch {
      // Fallback below
    }
  }

  try {
    new Notification(title, {
      body,
      icon: '/pwa-192x192.png',
      tag: 'animefit-inactivity-24h',
    });
    return true;
  } catch {
    return false;
  }
}

interface UseInactivityNotificationsOptions {
  user: UserProfile | null;
  activeWorkout: ActiveWorkout | null;
  onNotify?: (msg: string) => void;
}

export function useInactivityNotifications({
  user,
  activeWorkout,
  onNotify,
}: UseInactivityNotificationsOptions) {
  const supported =
    typeof window !== 'undefined' &&
    'Notification' in window &&
    window.isSecureContext !== false;

  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(() =>
    supported ? Notification.permission : 'unsupported'
  );
  const [persisted, setPersisted] = useState<ReminderPersistedState>(() =>
    readLocalReminderState()
  );
  const [periodicSyncActive, setPeriodicSyncActive] = useState(false);

  const prevUserMetricsRef = useRef<{
    username: string;
    steps: number;
    sleepHours: number;
  } | null>(null);

  const persistAll = useCallback((next: ReminderPersistedState) => {
    setPersisted(next);
    writeLocalReminderState(next);
    void writeReminderStateToIDB(next);
  }, []);

  const refreshPermission = useCallback((): NotificationPermission | 'unsupported' => {
    if (!supported) {
      setPermission('unsupported');
      return 'unsupported';
    }
    const current = Notification.permission;
    setPermission(current);
    return current;
  }, [supported]);

  // Sync permission state if changed in browser or Android/iOS system settings
  useEffect(() => {
    if (!supported) {
      setPermission('unsupported');
      return;
    }
    const syncPerm = () => setPermission(Notification.permission);
    syncPerm();
    document.addEventListener('visibilitychange', syncPerm);
    window.addEventListener('focus', syncPerm);

    let permStatus: PermissionStatus | null = null;
    if (navigator.permissions?.query) {
      void navigator.permissions
        .query({ name: 'notifications' as PermissionName })
        .then((status) => {
          permStatus = status;
          status.addEventListener?.('change', syncPerm);
        })
        .catch(() => {});
    }

    return () => {
      document.removeEventListener('visibilitychange', syncPerm);
      window.removeEventListener('focus', syncPerm);
      permStatus?.removeEventListener?.('change', syncPerm);
    };
  }, [supported]);

  // Track genuine user activity updates (workouts, active workout, story chapters, steps/sleep increases)
  useEffect(() => {
    if (!user) return;
    const todayKey = getTodayDateKey();
    const todayLog = user.wellness?.logs?.[todayKey];
    const currSteps = Number(todayLog?.steps || 0);
    const currSleep = Number(todayLog?.sleepHours || 0);

    const prevMetrics = prevUserMetricsRef.current;
    const sameUser = prevMetrics?.username === user.username;
    const wellnessIncreased =
      sameUser &&
      (currSteps > prevMetrics.steps || currSleep > prevMetrics.sleepHours);

    prevUserMetricsRef.current = {
      username: user.username,
      steps: currSteps,
      sleepHours: currSleep,
    };

    const profileLatestMs = getLatestProfileActivityMs(user, activeWorkout);
    const liveActivityMs = wellnessIncreased ? Date.now() : 0;
    const nextActivityAt = Math.max(
      persisted.username === user.username ? persisted.lastActivityAt : 0,
      profileLatestMs,
      liveActivityMs
    );

    const fallbackInitMs =
      nextActivityAt > 0
        ? nextActivityAt
        : persisted.enabled
        ? Date.now()
        : 0;

    if (
      fallbackInitMs !== persisted.lastActivityAt ||
      persisted.username !== user.username
    ) {
      persistAll({
        ...persisted,
        username: user.username,
        lastActivityAt: fallbackInitMs,
      });
    }
  }, [user, activeWorkout, persisted, persistAll]);

  // Register Periodic Background Sync on PWA if supported & enabled
  useEffect(() => {
    if (
      !user ||
      !persisted.enabled ||
      permission !== 'granted' ||
      !('serviceWorker' in navigator)
    ) {
      setPeriodicSyncActive(false);
      return;
    }

    let cancelled = false;
    void navigator.serviceWorker.ready
      .then(async (reg) => {
        const pReg = reg as SWRegistrationWithPeriodicSync;
        if (!pReg.periodicSync) return;
        try {
          if (navigator.permissions?.query) {
            const pStatus = await navigator.permissions.query({
              name: 'periodic-background-sync' as PermissionName,
            });
            if (pStatus.state === 'denied') return;
          }
          await pReg.periodicSync.register('animefit-inactivity-reminder', {
            minInterval: 6 * 60 * 60 * 1000,
          });
          if (!cancelled) setPeriodicSyncActive(true);
        } catch {
          if (!cancelled) setPeriodicSyncActive(false);
        }
      })
      .catch(() => {
        if (!cancelled) setPeriodicSyncActive(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user, persisted.enabled, permission]);

  // Evaluate 24-hour inactivity while open / on visibility resume / on timer
  useEffect(() => {
    if (!user || !supported || !persisted.enabled || permission !== 'granted') {
      return;
    }

    let timer: number | null = null;

    const evaluateAndMaybeNotify = async () => {
      const latest = readLocalReminderState();
      if (!latest.enabled || !latest.lastActivityAt) return;

      const now = Date.now();
      const sinceActivity = now - latest.lastActivityAt;
      const sinceNotified = latest.lastNotifiedAt
        ? now - latest.lastNotifiedAt
        : Infinity;

      if (
        sinceActivity >= INACTIVITY_THRESHOLD_MS &&
        sinceNotified >= INACTIVITY_THRESHOLD_MS
      ) {
        const title = `⚡ ¡${user.username}, tu Ki te espera!`;
        const body =
          'Han pasado más de 24 horas sin actividad registrada. ¡Completa una rutina hoy para seguir evolucionando!';
        const shown = await showNotificationThroughPWA(title, body);
        if (shown) {
          persistAll({
            ...latest,
            username: user.username,
            lastNotifiedAt: now,
          });
        }
      }
    };

    const scheduleCheck = () => {
      if (timer !== null) window.clearTimeout(timer);
      const now = Date.now();
      const baseActivity = persisted.lastActivityAt || now;
      const remaining = Math.max(
        5000,
        baseActivity + INACTIVITY_THRESHOLD_MS - now
      );
      const waitMs = Math.min(remaining, 15 * 60 * 1000);
      timer = window.setTimeout(() => {
        void evaluateAndMaybeNotify().finally(scheduleCheck);
      }, waitMs);
    };

    const handleVisible = () => {
      if (document.visibilityState === 'visible') {
        void evaluateAndMaybeNotify();
        if (navigator.serviceWorker?.controller) {
          navigator.serviceWorker.controller.postMessage({
            type: 'CHECK_INACTIVITY_REMINDER',
          });
        }
      }
    };

    void evaluateAndMaybeNotify();
    scheduleCheck();
    document.addEventListener('visibilitychange', handleVisible);
    window.addEventListener('pageshow', handleVisible);

    return () => {
      if (timer !== null) window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', handleVisible);
      window.removeEventListener('pageshow', handleVisible);
    };
  }, [user, supported, persisted.enabled, persisted.lastActivityAt, permission, persistAll]);

  const enableReminderState = useCallback(() => {
    const baseActivity =
      persisted.lastActivityAt > 0
        ? persisted.lastActivityAt
        : Math.max(getLatestProfileActivityMs(user, activeWorkout), Date.now());

    const next: ReminderPersistedState = {
      enabled: true,
      username: user?.username,
      lastActivityAt: baseActivity,
      lastNotifiedAt: persisted.lastNotifiedAt,
    };
    persistAll(next);
  }, [persisted.lastActivityAt, persisted.lastNotifiedAt, user, activeWorkout, persistAll]);

  const requestNotificationPermission = useCallback(async (): Promise<
    NotificationPermission | 'unsupported'
  > => {
    if (!supported) {
      setPermission('unsupported');
      onNotify?.(
        'Este navegador o dispositivo no soporta notificaciones web locales.'
      );
      return 'unsupported';
    }

    let currentPerm = Notification.permission;
    if (currentPerm === 'default') {
      currentPerm = await requestBrowserNotificationPermission();
    }
    setPermission(currentPerm);

    if (currentPerm === 'granted') {
      enableReminderState();
      onNotify?.(
        '🔔 ¡Notificaciones activadas! Recibirás recordatorios si pasas 24 horas sin actividad.'
      );
    } else if (currentPerm === 'denied') {
      onNotify?.(
        'El permiso de notificaciones está bloqueado en el dispositivo o navegador.'
      );
    } else {
      onNotify?.(
        'No se completó el permiso. Toca "Activar notificaciones" para intentarlo de nuevo.'
      );
    }
    return currentPerm;
  }, [supported, enableReminderState, onNotify]);

  const toggleNotifications = useCallback(async () => {
    if (!supported) {
      setPermission('unsupported');
      onNotify?.('Tu navegador no soporta notificaciones locales.');
      return;
    }

    if (persisted.enabled && Notification.permission === 'granted') {
      const next: ReminderPersistedState = {
        ...persisted,
        enabled: false,
        username: user?.username,
      };
      persistAll(next);
      if ('serviceWorker' in navigator) {
        void navigator.serviceWorker.ready
          .then((reg) => {
            const pReg = reg as SWRegistrationWithPeriodicSync;
            return pReg.periodicSync?.unregister?.('animefit-inactivity-reminder');
          })
          .catch(() => {});
      }
      onNotify?.('Recordatorios de inactividad desactivados.');
      return;
    }

    await requestNotificationPermission();
  }, [supported, persisted, user?.username, persistAll, onNotify, requestNotificationPermission]);

  const sendTestNotification = useCallback(async () => {
    if (!supported) {
      setPermission('unsupported');
      onNotify?.('Tu navegador no soporta notificaciones locales.');
      return;
    }

    let currentPerm = Notification.permission;
    if (currentPerm === 'default') {
      currentPerm = await requestBrowserNotificationPermission();
    }
    setPermission(currentPerm);

    if (currentPerm !== 'granted') {
      onNotify?.(
        currentPerm === 'denied'
          ? 'Notificaciones bloqueadas. Habilítalas en los ajustes del sistema o navegador.'
          : 'Acepta el permiso de notificaciones del navegador para probar el aviso.'
      );
      return;
    }

    const title = user
      ? `⚡ ¡${user.username}, hora de entrenar!`
      : '⚡ ¡Tu Ki te espera en AnimeFit!';
    const body =
      'Así se verá tu recordatorio local PWA cuando pasen 24 horas sin actividad registrada.';
    const ok = await showNotificationThroughPWA(title, body);
    if (ok) {
      onNotify?.('Notificación de prueba enviada.');
    } else {
      onNotify?.('No se pudo mostrar la notificación en este navegador.');
    }
  }, [supported, user, onNotify]);

  const hoursSinceActivity = useMemo(() => {
    if (!persisted.lastActivityAt) return null;
    const diff = Math.max(0, Date.now() - persisted.lastActivityAt);
    return Math.floor(diff / (60 * 60 * 1000));
  }, [persisted.lastActivityAt]);

  return {
    supported,
    permission,
    enabled: persisted.enabled && permission === 'granted',
    periodicSyncActive,
    lastActivityAt: persisted.lastActivityAt || null,
    hoursSinceActivity,
    requestNotificationPermission,
    refreshPermission,
    toggleNotifications,
    sendTestNotification,
  };
}
