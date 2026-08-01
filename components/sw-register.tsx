"use client";

import { useEffect } from "react";

/**
 * Registers the service worker in production only. Left as a no-op in
 * development so sw.js never intercepts the dev server.
 *
 * Uses a skipWaiting model: a new service worker activates and takes
 * control as soon as it's ready, with no "update available" prompt. That's
 * a deliberate simplicity trade-off for this app — controllerchange and
 * updatefound are both handled silently.
 */
export function SwRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          registration.addEventListener("updatefound", () => {
            // New worker installs and activates itself (skipWaiting in
            // sw.js) — nothing to do here.
          });
        })
        .catch(() => {
          // Registration failures are non-fatal — the app still works online.
        });
    };

    navigator.serviceWorker.addEventListener("controllerchange", () => {
      // The new service worker has taken over. No reload prompt — the
      // next navigation simply picks up the new worker.
    });

    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register);
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}
