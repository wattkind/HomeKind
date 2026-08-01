import "server-only";

import webpush from "web-push";

// VAPID details are set lazily inside sendPush (not at module scope) so that
// importing this module during a build with no env configured never throws —
// mirrors the lazy-env pattern used by lib/supabase/*.
let vapidConfigured = false;

function ensureVapidConfigured() {
  if (vapidConfigured) return;

  const contact = process.env.VAPID_CONTACT;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;

  if (!contact || !publicKey || !privateKey) {
    throw new Error(
      "Missing VAPID_CONTACT, NEXT_PUBLIC_VAPID_PUBLIC_KEY or VAPID_PRIVATE_KEY. Generate a key pair with scripts/generate-vapid.mjs.",
    );
  }

  webpush.setVapidDetails(contact, publicKey, privateKey);
  vapidConfigured = true;
}

export type PushSendResult = "sent" | "gone" | "failed";

/**
 * Sends a single Web Push message. Returns "gone" when the push service
 * reports the subscription no longer exists (404/410 — the caller should
 * delete the push_subscriptions row), "failed" for any other error, "sent"
 * on success. Errors are logged by class/status only — payload content
 * (device names, notification body) must never reach logs.
 */
export async function sendPush(
  sub: { endpoint: string; p256dh: string; auth: string },
  payload: { title: string; body: string; url: string },
): Promise<PushSendResult> {
  ensureVapidConfigured();

  try {
    await webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      },
      JSON.stringify(payload),
    );
    return "sent";
  } catch (error) {
    const statusCode =
      error && typeof error === "object" && "statusCode" in error
        ? (error as { statusCode?: number }).statusCode
        : undefined;

    if (statusCode === 404 || statusCode === 410) {
      return "gone";
    }

    console.error(
      "push send failed",
      error instanceof Error ? error.name : "unknown_error",
      statusCode ?? "no_status",
    );
    return "failed";
  }
}
