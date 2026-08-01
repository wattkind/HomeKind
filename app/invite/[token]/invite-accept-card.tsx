"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const ERROR_COPY: Record<string, string> = {
  invalid_token: "This invite link isn't valid. Ask whoever sent it for a fresh one.",
  invite_expired: "This invite has expired. Ask whoever sent it for a fresh one.",
  already_accepted: "This invite has already been used by someone else.",
  not_authenticated: "You need to be signed in to accept an invite.",
};

export function InviteAcceptCard({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function acceptInvite() {
    setError(null);
    setSubmitting(true);

    try {
      const response = await fetch("/api/invites/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { code?: string } | null;
        const code = body?.code ?? "invalid_token";
        setError(ERROR_COPY[code] ?? "We couldn't add you to this household. Try again.");
        setSubmitting(false);
        return;
      }

      router.push("/home");
      router.refresh();
    } catch {
      setError("Something went wrong. Check your connection and try again.");
      setSubmitting(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: "16px" }}>
      {error ? (
        <div className="banner error" role="alert">
          <p>{error}</p>
        </div>
      ) : (
        <p>You&apos;ve been invited to join a household on HomeKind. Accepting will give you access to its devices, manuals and receipts.</p>
      )}

      <div className="form-actions">
        <button type="button" className="button" onClick={() => void acceptInvite()} disabled={submitting}>
          {submitting ? "Joining…" : "Join household"}
        </button>
      </div>
    </div>
  );
}
