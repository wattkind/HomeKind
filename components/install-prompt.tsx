"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone() {
  if (typeof window === "undefined") return false;
  const mediaStandalone =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(display-mode: standalone)").matches;
  const iosStandalone = (window.navigator as { standalone?: boolean }).standalone === true;
  return mediaStandalone || iosStandalone;
}

function isIosDevice() {
  if (typeof window === "undefined") return false;
  return /iPhone|iPad/.test(window.navigator.userAgent);
}

/**
 * Self-contained install prompt for the Settings/notifications surface.
 * Renders one of: an "installed" confirmation, an Android/Chromium install
 * button, iOS Safari "Add to Home Screen" steps, or nothing (desktop
 * browsers with no install path, or a state we can't detect).
 */
export function InstallPrompt() {
  const [standalone, setStandalone] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    setStandalone(isStandalone());
    setIsIos(isIosDevice());

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);

    const onInstalled = () => {
      setDeferredPrompt(null);
      setStandalone(true);
    };
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (standalone) {
    return <p className="hint">HomeKind is installed on this device.</p>;
  }

  if (deferredPrompt) {
    const handleInstall = () => {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.finally(() => setDeferredPrompt(null));
    };
    return (
      <button type="button" className="button" onClick={handleInstall}>
        Install HomeKind
      </button>
    );
  }

  if (isIos) {
    return (
      <div className="card">
        <p>To install HomeKind on this device:</p>
        <ol>
          <li>Open the Share menu in Safari.</li>
          <li>Choose &quot;Add to Home Screen&quot;.</li>
        </ol>
        <p className="hint">
          On iPhone and iPad, warranty push alerts only work once HomeKind is installed this
          way (iOS 16.4 and later).
        </p>
      </div>
    );
  }

  return null;
}
