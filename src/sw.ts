interface PrecacheManifestEntry {
  url: string;
  revision: string | null;
}

interface ExtendableEventLike extends Event {
  waitUntil(promise: Promise<unknown>): void;
}

interface FetchEventLike extends ExtendableEventLike {
  request: Request;
  respondWith(response: Response | Promise<Response>): void;
}

interface NotificationEventLike extends ExtendableEventLike {
  notification: Notification;
  action: string;
}

interface SyncEventLike extends ExtendableEventLike {
  tag: string;
}

interface WindowClientLike {
  url: string;
  focused: boolean;
  focus(): Promise<WindowClientLike>;
  navigate?(url: string): Promise<WindowClientLike | null>;
}

interface SWRegistrationLike {
  showNotification(title: string, options?: NotificationOptions): Promise<void>;
}

interface SWGlobal {
  __WB_MANIFEST: Array<PrecacheManifestEntry | string>;
  location: Location;
  registration: SWRegistrationLike;
  skipWaiting(): Promise<void>;
  clients: {
    claim(): Promise<void>;
    matchAll(options?: {
      type?: 'window' | 'worker' | 'sharedworker' | 'all';
      includeUncontrolled?: boolean;
    }): Promise<WindowClientLike[]>;
    openWindow(url: string): Promise<WindowClientLike | null>;
  };
  addEventListener(type: 'install', listener: (ev: ExtendableEventLike) => void): void;
  addEventListener(type: 'activate', listener: (ev: ExtendableEventLike) => void): void;
  addEventListener(type: 'fetch', listener: (ev: FetchEventLike) => void): void;
  addEventListener(type: 'notificationclick', listener: (ev: NotificationEventLike) => void): void;
  addEventListener(type: 'periodicsync', listener: (ev: SyncEventLike) => void): void;
  addEventListener(type: 'sync', listener: (ev: SyncEventLike) => void): void;
  addEventListener(type: 'message', listener: (ev: ExtendableEventLike & { data?: unknown }) => void): void;
}

interface ReminderRecord {
  enabled: boolean;
  username?: string;
  lastActivityAt: number;
  lastNotifiedAt: number;
}

const sw = self as unknown as SWGlobal;

const PRECACHE_NAME = 'animefit-precache-v2';
const RUNTIME_FONTS_CACHE = 'google-fonts-cache';
const RUNTIME_PORTRAITS_CACHE = 'anime-portraits-cache';
const REMINDER_DB_NAME = 'animefit-reminder-db';
const REMINDER_STORE_NAME = 'state';
const REMINDER_RECORD_KEY = 'current';
const INACTIVITY_THRESHOLD_MS = 24 * 60 * 60 * 1000;

const rawManifest = (self as unknown as SWGlobal).__WB_MANIFEST;
const manifestEntries: Array<PrecacheManifestEntry | string> = Array.isArray(
  rawManifest
)
  ? rawManifest
  : [];

function getPrecacheUrls(): string[] {
  const urls: string[] = [];
  for (const entry of manifestEntries) {
    const rawUrl = typeof entry === 'string' ? entry : entry.url;
    if (rawUrl) {
      urls.push(new URL(rawUrl, sw.location.origin).href);
    }
  }
  return Array.from(new Set(urls));
}

function openReminderDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(REMINDER_DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(REMINDER_STORE_NAME)) {
        db.createObjectStore(REMINDER_STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function readReminderState(): Promise<ReminderRecord | null> {
  try {
    const db = await openReminderDB();
    return await new Promise<ReminderRecord | null>((resolve) => {
      const tx = db.transaction(REMINDER_STORE_NAME, 'readonly');
      const req = tx.objectStore(REMINDER_STORE_NAME).get(REMINDER_RECORD_KEY);
      req.onsuccess = () => resolve((req.result as ReminderRecord) || null);
      req.onerror = () => resolve(null);
      tx.oncomplete = () => db.close();
    });
  } catch {
    return null;
  }
}

async function writeReminderState(record: ReminderRecord): Promise<void> {
  try {
    const db = await openReminderDB();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(REMINDER_STORE_NAME, 'readwrite');
      tx.objectStore(REMINDER_STORE_NAME).put(record, REMINDER_RECORD_KEY);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    });
  } catch {
    // ignore IDB errors inside SW
  }
}

async function showWorkoutReminderNotification(username?: string): Promise<void> {
  const title = username
    ? `⚡ ¡${username}, tu Ki te espera!`
    : '⚡ ¡Tu Ki te espera en AnimeFit!';
  await sw.registration.showNotification(title, {
    body: 'Han pasado más de 24 horas sin actividad registrada. ¡Completa una rutina hoy para seguir evolucionando!',
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: 'animefit-inactivity-24h',
    data: { url: '/' },
  });
}

async function checkAndNotifyInactivity(): Promise<void> {
  const notifApi = (self as unknown as { Notification?: { permission?: string } })
    .Notification;
  if (notifApi && notifApi.permission !== 'granted') {
    return;
  }

  const state = await readReminderState();
  if (!state || !state.enabled || !state.lastActivityAt) return;

  const now = Date.now();
  const elapsedSinceActivity = now - state.lastActivityAt;
  const elapsedSinceNotified = state.lastNotifiedAt
    ? now - state.lastNotifiedAt
    : Infinity;

  if (
    elapsedSinceActivity >= INACTIVITY_THRESHOLD_MS &&
    elapsedSinceNotified >= INACTIVITY_THRESHOLD_MS
  ) {
    await showWorkoutReminderNotification(state.username);
    await writeReminderState({
      ...state,
      lastNotifiedAt: now,
    });
  }
}

async function cacheFirst(request: Request, cacheName: string): Promise<Response> {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && (response.status === 200 || response.type === 'opaque')) {
    void cache.put(request, response.clone());
  }
  return response;
}

sw.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const urls = getPrecacheUrls();
      if (urls.length > 0) {
        const cache = await caches.open(PRECACHE_NAME);
        await Promise.all(
          urls.map((u) => cache.add(u).catch(() => undefined))
        );
      }
      await sw.skipWaiting();
    })()
  );
});

sw.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([
        PRECACHE_NAME,
        RUNTIME_FONTS_CACHE,
        RUNTIME_PORTRAITS_CACHE,
      ]);
      const keys = await caches.keys();
      await Promise.all(
        keys.map((k) => (keep.has(k) ? Promise.resolve(false) : caches.delete(k)))
      );
      await sw.clients.claim();
    })()
  );
});

sw.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/.well-known/')
  ) {
    return;
  }

  if (
    /^https:\/\/fonts\.(googleapis|gstatic)\.com$/i.test(url.origin)
  ) {
    event.respondWith(cacheFirst(request, RUNTIME_FONTS_CACHE));
    return;
  }

  if (url.origin === 'https://s4.anilist.co') {
    event.respondWith(cacheFirst(request, RUNTIME_PORTRAITS_CACHE));
    return;
  }

  if (url.origin !== sw.location.origin) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          return await fetch(request);
        } catch {
          const cache = await caches.open(PRECACHE_NAME);
          const fallback =
            (await cache.match(new URL('/', sw.location.origin).href)) ||
            (await cache.match(new URL('/index.html', sw.location.origin).href));
          return fallback || Response.error();
        }
      })()
    );
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(PRECACHE_NAME);
      const cached = await cache.match(request);
      if (cached) return cached;
      return fetch(request);
    })()
  );
});

sw.addEventListener('periodicsync', (event) => {
  if (event.tag === 'animefit-inactivity-reminder') {
    event.waitUntil(checkAndNotifyInactivity());
  }
});

sw.addEventListener('sync', (event) => {
  if (event.tag === 'animefit-inactivity-check') {
    event.waitUntil(checkAndNotifyInactivity());
  }
});

sw.addEventListener('message', (event) => {
  const data = event.data as { type?: string; username?: string } | undefined;
  if (!data?.type) return;

  if (data.type === 'CHECK_INACTIVITY_REMINDER') {
    event.waitUntil(checkAndNotifyInactivity());
  } else if (data.type === 'SHOW_TEST_REMINDER') {
    event.waitUntil(showWorkoutReminderNotification(data.username));
  }
});

sw.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl =
    (event.notification.data as { url?: string } | undefined)?.url || '/';
  const resolvedUrl = new URL(targetUrl, sw.location.origin).href;

  event.waitUntil(
    (async () => {
      const clientList = await sw.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });
      for (const client of clientList) {
        if (client.url.startsWith(sw.location.origin)) {
          await client.focus();
          return;
        }
      }
      await sw.clients.openWindow(resolvedUrl);
    })()
  );
});
