import { createClient, requireHousehold } from "@/lib/supabase/server";
import { NotificationsClient } from "./notifications-client";

export const dynamic = "force-dynamic";

export default async function NotificationsSettingsPage() {
  const { user, householdId } = await requireHousehold();
  const supabase = await createClient();

  const { data: member } = await supabase
    .from("household_members")
    .select("warranty_threshold_days")
    .eq("household_id", householdId)
    .eq("user_id", user.id)
    .maybeSingle();

  const { count: warrantyCount } = await supabase
    .from("devices")
    .select("id", { count: "exact", head: true })
    .eq("household_id", householdId)
    .is("deleted_at", null)
    .not("warranty_end", "is", null);

  return (
    <div style={{ display: "grid", gap: "24px", paddingBlock: "24px" }}>
      <div>
        <p className="eyebrow">Settings</p>
        <h1>Notifications</h1>
      </div>

      <NotificationsClient
        householdId={householdId}
        initialThresholdDays={member?.warranty_threshold_days ?? 30}
        hasWarranties={(warrantyCount ?? 0) > 0}
      />
    </div>
  );
}
