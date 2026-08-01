// HomeKind service worker — placeholder for P0. Offline caching and push
// notifications are built out in later packages; this just installs cleanly
// and takes control so registration (components/sw-register.tsx) succeeds.

const SW_VERSION = "homekind-sw-v1";
void SW_VERSION;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// --- offline caching (P4) ---
// Precache app shell + runtime caching for manuals/receipts goes here.

// --- push handlers (P5) ---
// Warranty-expiry and reminder push notifications go here.
