"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function RestoreDeviceCard({ deviceId }: { deviceId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function restore() {
    setBusy(true);
    setError(null);

    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("devices")
      .update({ deleted_at: null })
      .eq("id", deviceId);

    setBusy(false);

    if (updateError) {
      setError("We couldn't restore this device. Try again.");
      return;
    }

    router.refresh();
  }

  return (
    <div className="card" style={{ display: "grid", gap: "12px" }}>
      <h2>This device has been removed</h2>
      <p>Its manuals and receipts are kept safe — restore it to bring it back to your device list.</p>
      {error ? (
        <div className="banner error" role="alert">
          <p>{error}</p>
        </div>
      ) : null}
      <div>
        <button type="button" className="button" onClick={() => void restore()} disabled={busy}>
          {busy ? "Restoring…" : "Restore device"}
        </button>
      </div>
      <p className="hint">Deleting forever isn&apos;t available yet — restore is the only way back for now.</p>
    </div>
  );
}

export function DeleteDeviceButton({ deviceId }: { deviceId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    if (
      !window.confirm(
        "Remove this device from your list? Its manuals and receipts are kept, and you can restore it later.",
      )
    ) {
      return;
    }

    setBusy(true);
    setError(null);

    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("devices")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", deviceId);

    setBusy(false);

    if (updateError) {
      setError("We couldn't remove this device. Try again.");
      return;
    }

    router.push("/home");
  }

  return (
    <div style={{ display: "grid", gap: "8px" }}>
      {error ? (
        <div className="banner error" role="alert">
          <p>{error}</p>
        </div>
      ) : null}
      <button type="button" className="button secondary" onClick={() => void remove()} disabled={busy}>
        {busy ? "Removing…" : "Remove device"}
      </button>
    </div>
  );
}
