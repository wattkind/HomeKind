"use client";

import { useEffect, useState } from "react";
import { isExpiringWithin, daysUntil } from "@/lib/warranty";

const DISMISS_KEY = "hk-warranty-banner-dismissed";

type BannerDevice = {
  id: string;
  name: string;
  warranty_end: string | null;
  deleted_at: string | null;
};

/**
 * Deterministic, non-cryptographic hash of the sorted (device_id, warranty_end)
 * pairs currently expiring. Used only to detect "is this the same set the
 * household already dismissed" — collisions aren't a security concern here,
 * just a UX one, and 31-bit djb2-style hashing over a small list is more than
 * enough. A changed or added warranty produces a different hash, so the
 * banner re-shows even though the localStorage key never changes.
 */
function hashExpiringSet(pairs: string[]): string {
  const joined = [...pairs].sort().join("|");
  let hash = 0;
  for (let i = 0; i < joined.length; i += 1) {
    hash = (hash * 31 + joined.charCodeAt(i)) | 0;
  }
  return String(hash);
}

/**
 * Self-contained warranty-expiry banner. Takes an already-fetched device list
 * (no data fetching of its own) so it can be dropped into the home page — or
 * anywhere else — without wiring up Supabase queries again.
 *
 * This is the universal fallback notification channel: unlike push, it has no
 * permission to ask for and runs for every household member regardless of
 * push-subscription status, so it deliberately writes NO warranty_notifications
 * rows. The schema's channel check allows 'banner' as a value, but nothing
 * ever inserts one — this component's own dismissal state (localStorage) is
 * the only "already seen" record it needs, and a server-side marker would
 * just be an unused write for a per-device UI element every member computes
 * independently on every page load.
 */
export function WarrantyBanner({
  devices,
  thresholdDays,
}: {
  devices: BannerDevice[];
  thresholdDays: number;
}) {
  const [dismissedHash, setDismissedHash] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const expiring = devices
    .filter((d) => !d.deleted_at && d.warranty_end && isExpiringWithin(d.warranty_end, thresholdDays))
    .sort((a, b) => (a.warranty_end ?? "").localeCompare(b.warranty_end ?? ""));

  const currentHash = hashExpiringSet(expiring.map((d) => `${d.id}:${d.warranty_end}`));

  useEffect(() => {
    setDismissedHash(window.localStorage.getItem(DISMISS_KEY));
    setHydrated(true);
  }, []);

  if (expiring.length === 0) return null;
  // Avoid a flash of the banner before we've had a chance to read localStorage.
  if (!hydrated) return null;
  if (dismissedHash === currentHash) return null;

  const handleDismiss = () => {
    window.localStorage.setItem(DISMISS_KEY, currentHash);
    setDismissedHash(currentHash);
  };

  const message =
    expiring.length === 1
      ? (() => {
          const [device] = expiring;
          const days = daysUntil(device.warranty_end as string);
          return days === 0
            ? `${device.name} warranty ends today`
            : `${device.name} warranty ends in ${days} days`;
        })()
      : `${expiring.length} warranties ending soon`;

  return (
    <div className="banner" role="status">
      <p>
        {message}{" "}
        <a href="/home?filter=expiring" className="text-link">
          View
        </a>
      </p>
      <button type="button" aria-label="Dismiss" onClick={handleDismiss}>
        &times;
      </button>
    </div>
  );
}
