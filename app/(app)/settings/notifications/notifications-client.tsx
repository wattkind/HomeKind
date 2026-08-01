"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { enablePush, disablePush, getPushStatus, type PushEnableResult, type PushStatus } from "@/lib/push/subscribe";
import { InstallPrompt } from "@/components/install-prompt";

const THRESHOLD_OPTIONS = [30, 60, 90] as const;

function pushStatusCopy(status: PushStatus, result: PushEnableResult | null): string | null {
  if (result === "denied") {
    return "Notifications are blocked for HomeKind in your browser settings. Allow them there, then try again.";
  }
  if (result === "unsupported" || status === "unsupported") {
    return "This browser doesn't support push notifications. The Home screen banner still shows up when a warranty's due, no notifications needed.";
  }
  if (result === "needs_install") {
    return "On iPhone and iPad, warranty notifications only work once HomeKind is installed to your Home Screen. Install it below, then come back and turn notifications on.";
  }
  if (result === "error") {
    return "Something went wrong turning notifications on. Try again in a moment.";
  }
  return null;
}

export function NotificationsClient({
  householdId,
  initialThresholdDays,
  hasWarranties,
}: {
  householdId: string;
  initialThresholdDays: 30 | 60 | 90;
  hasWarranties: boolean;
}) {
  const [thresholdDays, setThresholdDays] = useState<30 | 60 | 90>(initialThresholdDays);
  const [savingThreshold, setSavingThreshold] = useState(false);
  const [thresholdError, setThresholdError] = useState<string | null>(null);

  const [pushStatus, setPushStatus] = useState<PushStatus | "loading">("loading");
  const [enableResult, setEnableResult] = useState<PushEnableResult | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Only checks whether a subscription already exists — never requests
    // notification permission on its own.
    getPushStatus().then(setPushStatus);
  }, []);

  async function handleThresholdChange(value: 30 | 60 | 90) {
    setThresholdDays(value);
    setThresholdError(null);
    setSavingThreshold(true);

    const supabase = createClient();
    const { error } = await supabase
      .from("household_members")
      .update({ warranty_threshold_days: value })
      .eq("household_id", householdId);

    setSavingThreshold(false);

    if (error) {
      setThresholdError("We couldn't save that. Try again.");
      setThresholdDays(initialThresholdDays);
    }
  }

  async function handlePushToggle() {
    setBusy(true);
    setEnableResult(null);

    if (pushStatus === "subscribed") {
      await disablePush();
      setPushStatus("not_subscribed");
      setBusy(false);
      return;
    }

    // Explicit user action (this handler only ever runs from a button tap) —
    // this is the one place allowed to request notification permission.
    const result = await enablePush(householdId);
    setEnableResult(result);
    if (result === "subscribed") {
      setPushStatus("subscribed");
    }
    setBusy(false);
  }

  const statusCopy = pushStatusCopy(pushStatus === "loading" ? "not_subscribed" : pushStatus, enableResult);

  return (
    <div style={{ display: "grid", gap: "24px" }}>
      <div className="card">
        <h3>Remind me</h3>
        <p className="hint">Choose how far ahead of a warranty ending you want to be reminded.</p>
        <div role="radiogroup" aria-label="Warranty reminder lead time" style={{ display: "grid", gap: "10px", marginTop: "14px" }}>
          {THRESHOLD_OPTIONS.map((option) => (
            <label key={option} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <input
                type="radio"
                name="warranty-threshold"
                value={option}
                checked={thresholdDays === option}
                disabled={savingThreshold}
                onChange={() => void handleThresholdChange(option)}
              />
              {option} days before
            </label>
          ))}
        </div>
        {thresholdError ? <p className="hint" style={{ color: "var(--error-accent)" }}>{thresholdError}</p> : null}
      </div>

      <div className="card">
        <h3>Push notifications</h3>

        {!hasWarranties ? (
          <p>
            Once a device has a warranty end date saved, you&apos;ll be able to turn on push reminders here.
            The Home screen banner works everywhere in the meantime.
          </p>
        ) : (
          <>
            <p>
              Get a notification on this device when a warranty is about to end. You can turn this off any
              time.
            </p>
            <button
              type="button"
              className="button"
              disabled={busy || pushStatus === "loading" || pushStatus === "unsupported"}
              onClick={() => void handlePushToggle()}
            >
              {pushStatus === "subscribed" ? "Turn off notifications" : "Turn on notifications"}
            </button>
            {statusCopy ? <p className="hint" style={{ marginTop: "10px" }}>{statusCopy}</p> : null}
          </>
        )}

        <p className="hint" style={{ marginTop: "14px" }}>
          The Home screen banner (on the app&apos;s home page) shows upcoming warranties to everyone in your
          household, whether or not notifications are turned on.
        </p>

        <InstallPrompt />
      </div>
    </div>
  );
}
