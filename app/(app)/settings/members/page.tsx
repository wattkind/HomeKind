import { createClient, requireHousehold } from "@/lib/supabase/server";
import { MembersList } from "./members-list";
import { InviteSection } from "./invite-section";

export const dynamic = "force-dynamic";

export default async function MembersSettingsPage() {
  const { user, householdId, role } = await requireHousehold();
  const supabase = await createClient();

  const { data: members } = await supabase
    .from("household_members")
    .select("household_id, user_id, role, warranty_threshold_days, created_at")
    .eq("household_id", householdId)
    .order("created_at", { ascending: true });

  const { data: invites } = await supabase
    .from("invites")
    .select("id, expires_at, created_at, accepted_at")
    .eq("household_id", householdId)
    .is("accepted_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });

  return (
    <div style={{ display: "grid", gap: "24px", paddingBlock: "24px" }}>
      <div>
        <p className="eyebrow">Settings</p>
        <h1>Members</h1>
      </div>

      <div className="card">
        <h3>Household members</h3>
        <MembersList members={members ?? []} currentUserId={user.id} isOwner={role === "owner"} />
      </div>

      <div className="card">
        <h3>Invite someone</h3>
        <InviteSection householdId={householdId} pendingInvites={invites ?? []} />
      </div>
    </div>
  );
}
