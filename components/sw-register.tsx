"use client";

import { useEffect } from "react";

/**
 * Registers the service worker in production only. Left as a no-op in
 * development so the placeholder sw.js (P4/P5 stubs) never intercepts the
 * dev server.
 */
export function SwRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Registration failures are non-fatal — the app still works online.
    });
  }, []);

  return null;
}
