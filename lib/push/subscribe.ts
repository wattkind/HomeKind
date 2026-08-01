"use client";

import { createClient } from "@/lib/supabase/client";

export type PushEnableResult =
  | "subscribed"
  | "denied"
  | "unsupported"
  | "needs_install"
  | "error";

/**
 * Converts a base64url-encoded VAPID public key into the Uint8Array shape
 * PushManager.subscribe expects. Standard helper, copied verbatim from the
 * Web Push / Google recipe used everywhere this API appears.
 */
function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(new ArrayBuffer(rawData.length));
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function isStandalone(): boolean {
  const mediaStandalone =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(display-mode: standalone)").matches;
  const iosStandalone = (window.navigator as { standalone?: boolean }).standalone === true;
  return mediaStandalone || iosStandalone;
}

function isIosSafari(): boolean {
  return /iPhone|iPad/.test(window.navigator.userAgent);
}

function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/**
 * Requests notification permission (only ever call this from an explicit
 * user action — never on page load) and, if granted, subscribes to Web Push
 * and upserts the subscription row for this household.
 */
export async function enablePush(householdId: string): Promise<PushEnableResult> {
  if (!isPushSupported()) {
    return "unsupported";
  }

  // iOS 16.4+ only allows web push for PWAs installed to the Home Screen —
  // Safari itself (browser tab) never delivers push, even with permission
  // granted, so there's no point prompting until the app is installed.
  if (isIosSafari() && !isStandalone()) {
    return "needs_install";
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return "denied";
  }

  try {
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!publicKey) {
      return "error";
    }

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });

    const raw = subscription.toJSON();
    const endpoint = raw.endpoint;
    const p256dh = raw.keys?.p256dh;
    const auth = raw.keys?.auth;
    if (!endpoint || !p256dh || !auth) {
      return "error";
    }

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return "error";
    }

    const { error } = await supabase
      .from("push_subscriptions")
      .upsert(
        { user_id: user.id, household_id: householdId, endpoint, p256dh, auth },
        { onConflict: "endpoint" },
      );

    if (error) {
      return "error";
    }

    return "subscribed";
  } catch {
    return "error";
  }
}

/** Unsubscribes the browser's push subscription and removes its row. */
export async function disablePush(): Promise<void> {
  if (!isPushSupported()) return;

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;

  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();

  const supabase = createClient();
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
}

export type PushStatus = "subscribed" | "not_subscribed" | "unsupported";

export async function getPushStatus(): Promise<PushStatus> {
  if (!isPushSupported()) return "unsupported";

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  return subscription ? "subscribed" : "not_subscribed";
}
