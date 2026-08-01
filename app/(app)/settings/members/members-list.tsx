"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { HouseholdMember } from "@/lib/types";

function shortId(id: string): string {
  return id.slice(0, 8);
}

export function MembersList({
  members,
  currentUserId,
  isOwner,
}: {
  members: HouseholdMember[];
  currentUserId: string;
  isOwner: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  async function removeMember(userId: string) {
    setError(null);
    setBusyUserId(userId);

    const supabase = createClient();
    const { error: deleteError } = await supabase
      .from("household_members")
      .delete()
      .eq("user_id", userId);

    setBusyUserId(null);

    if (deleteError) {
      setError("We couldn't remove that member. Try again.");
      return;
    }

    router.refresh();
  }

  async function leaveHousehold() {
    if (!window.confirm("Leave this household? You'll lose access to its devices, manuals and receipts.")) {
      return;
    }
    await removeMember(currentUserId);
  }

  return (
    <div style={{ display: "grid", gap: "12px" }}>
      {error ? (
        <div className="banner error" role="alert">
          <p>{error}</p>
        </div>
      ) : null}

      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "10px" }}>
        {members.map((member) => {
          const isSelf = member.user_id === currentUserId;
          const canRemove = isOwner && !isSelf;

          return (
            <li
              key={member.user_id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px",
                padding: "10px 0",
                borderBottom: "1px solid var(--line)",
              }}
            >
              <span>
                {isSelf ? "You" : `Member ${shortId(member.user_id)}`}{" "}
                <span className="chip">{member.role}</span>
              </span>

              {canRemove ? (
                <button
                  type="button"
                  className="button secondary"
                  disabled={busyUserId === member.user_id}
                  onClick={() => {
                    if (window.confirm("Remove this member from the household?")) {
                      void removeMember(member.user_id);
                    }
                  }}
                >
                  Remove
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>

      <div>
        <button type="button" className="button secondary" onClick={() => void leaveHousehold()}>
          Leave household
        </button>
      </div>
    </div>
  );
}
