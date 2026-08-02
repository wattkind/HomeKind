// HomeKind service worker. Offline caching (app shell + previously-opened
// manual PDFs) lives here (P4); push notifications are added in P5.

const SW_VERSION = "v1";
const STATIC_CACHE = `homekind-static-${SW_VERSION}`;
const PAGES_CACHE = `homekind-pages-${SW_VERSION}`;
// Deliberately NOT tied to SW_VERSION: this cache holds manual/document
// PDFs the household has downloaded to their device. A service worker
// upgrade must never evict those — Supabase Storage is the source of
// truth, but the whole point of caching is to survive being offline even
// across app updates.
const MANUALS_CACHE = "homekind-manuals-v1";

const PRECACHE_URLS = [
  "/offline",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  // Header mark — the app shell has to render branded while offline.
  "/assets/brand/logos/homekind-mark-ui.png",
  "/assets/fonts/Inter-Variable.ttf",
  "/assets/fonts/Inter-OFL.txt",
  "/assets/fonts/Nunito-Variable.ttf",
  "/assets/fonts/Nunito-OFL.txt",
];

const MANUALS_MAX_ENTRIES = 20;
const PAGES_MAX_ENTRIES = 10;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => {
              if (key === MANUALS_CACHE) return false;
              const isOurs =
                key.startsWith("homekind-static-") || key.startsWith("homekind-pages-");
              if (!isOurs) return false;
              return key !== STATIC_CACHE && key !== PAGES_CACHE;
            })
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// --- offline caching (P4) ---

// Signed Supabase Storage URLs rotate their token query param on every
// issuance, so a manual re-opened later arrives with a different URL even
// though it's the same file. We strip the query string and cache keyed on
// pathname only, so repeat opens of the same document hit the cache
// regardless of which signed token fetched it this time.
function manualCacheKey(url) {
  const stripped = new URL(url);
  stripped.search = "";
  return new Request(stripped.toString());
}

function isManualRequest(url) {
  const isSupabaseHost = url.hostname.endsWith(".supabase.co");
  const isProjectHost = self.location.hostname === url.hostname;
  return (isSupabaseHost || isProjectHost) &&
    url.pathname.includes("/storage/v1/object/sign/device-documents/");
}

async function trimCache(cache, maxEntries) {
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;
  const excess = keys.length - maxEntries;
  for (let i = 0; i < excess; i += 1) {
    await cache.delete(keys[i]);
  }
}

async function handleManualRequest(request) {
  const cache = await caches.open(MANUALS_CACHE);
  const key = manualCacheKey(request.url);
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      await cache.put(key, response.clone());
      await trimCache(cache, MANUALS_MAX_ENTRIES);
    }
    return response;
  } catch (err) {
    const cached = await cache.match(key);
    if (cached) return cached;
    throw err;
  }
}

async function handleNavigation(request) {
  const pagesCache = await caches.open(PAGES_CACHE);
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      await pagesCache.put(request, response.clone());
      await trimCache(pagesCache, PAGES_MAX_ENTRIES);
    }
    return response;
  } catch (err) {
    const cachedPage = await pagesCache.match(request);
    if (cachedPage) return cachedPage;
    const staticCache = await caches.open(STATIC_CACHE);
    const offline = await staticCache.match("/offline");
    if (offline) return offline;
    throw err;
  }
}

function isStaticAsset(url) {
  if (url.origin !== self.location.origin) return false;
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/assets/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.webmanifest"
  );
}

async function handleStaticAsset(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  const networkFetch = fetch(request)
    .then((response) => {
      if (response && response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => undefined);

  if (cached) {
    // Revalidate in the background; don't block the response on it.
    networkFetch.catch(() => {});
    return cached;
  }
  const fresh = await networkFetch;
  if (fresh) return fresh;
  throw new Error("homekind-sw: static asset unavailable offline");
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (isManualRequest(url)) {
    event.respondWith(handleManualRequest(request));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(request));
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(handleStaticAsset(request));
    return;
  }

  // Everything else (API routes, Supabase auth/rest, cross-origin
  // requests) passes through untouched — we never cache authed JSON/HTML.
});

// --- push handlers (P5) ---
// Warranty-expiry and reminder push notifications go here.

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch (err) {
    return;
  }

  const { title, body, url } = payload;

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      data: { url },
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data && event.notification.data.url;
  if (!url) return;

  event.waitUntil(
    (async () => {
      const clientsList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const targetUrl = new URL(url, self.location.origin).href;
      for (const client of clientsList) {
        if (client.url === targetUrl && "focus" in client) {
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })()
  );
});
