"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type PendingInvite = {
  id: string;
  expires_at: string;
  created_at: string;
  accepted_at: string | null;
};

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function InviteSection({
  householdId,
  pendingInvites,
}: {
  householdId: string;
  pendingInvites: PendingInvite[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busyInviteId, setBusyInviteId] = useState<string | null>(null);

  async function createInvite() {
    setError(null);
    setCreating(true);
    setShareLink(null);
    setCopied(false);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("You need to be signed in to create an invite.");
        return;
      }

      const tokenBytes = crypto.getRandomValues(new Uint8Array(32));
      const token = toBase64Url(tokenBytes);
      const tokenHash = await sha256Hex(token);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const { error: insertError } = await supabase.from("invites").insert({
        household_id: householdId,
        token_hash: tokenHash,
        created_by: user.id,
        expires_at: expiresAt,
      });

      if (insertError) {
        setError("We couldn't create an invite. Try again.");
        return;
      }

      const base = process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin;
      setShareLink(`${base}/invite/${token}`);
      router.refresh();
    } finally {
      setCreating(false);
    }
  }

  async function copyLink() {
    if (!shareLink) return;
    await navigator.clipboard.writeText(shareLink);
    setCopied(true);
  }

  async function revokeInvite(id: string) {
    setError(null);
    setBusyInviteId(id);

    const supabase = createClient();
    const { error: deleteError } = await supabase.from("invites").delete().eq("id", id);

    setBusyInviteId(null);

    if (deleteError) {
      setError("We couldn't revoke that invite. Try again.");
      return;
    }

    router.refresh();
  }

  return (
    <div style={{ display: "grid", gap: "16px" }}>
      {error ? (
        <div className="banner error" role="alert">
          <p>{error}</p>
        </div>
      ) : null}

      <p>Anyone with this link can join your household within 7 days. Only share it with people you trust.</p>

      <div>
        <button type="button" className="button" onClick={() => void createInvite()} disabled={creating}>
          {creating ? "Creating…" : "Create invite link"}
        </button>
      </div>

      {shareLink ? (
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="invite-link">Share this link</label>
          <input id="invite-link" type="text" readOnly value={shareLink} onFocus={(event) => event.target.select()} />
          <div className="form-actions" style={{ marginTop: "10px" }}>
            <button type="button" className="button secondary" onClick={() => void copyLink()}>
              {copied ? "Copied" : "Copy link"}
            </button>
          </div>
          <p className="hint">Expires in 7 days.</p>
        </div>
      ) : null}

      {pendingInvites.length > 0 ? (
        <div>
          <h3 style={{ fontSize: "1.1rem", marginBottom: "10px" }}>Pending invites</h3>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "10px" }}>
            {pendingInvites.map((invite) => (
              <li
                key={invite.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "12px",
                  padding: "10px 0",
                  borderBottom: "1px solid var(--line)",
                }}
              >
                <span>Expires {new Date(invite.expires_at).toLocaleDateString("en-AU")}</span>
                <button
                  type="button"
                  className="button secondary"
                  disabled={busyInviteId === invite.id}
                  onClick={() => void revokeInvite(invite.id)}
                >
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
