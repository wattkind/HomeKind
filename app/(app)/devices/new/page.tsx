import { createClient, requireHousehold } from "@/lib/supabase/server";
import { NewDeviceFlow } from "@/components/new-device-flow";

export const dynamic = "force-dynamic";

export default async function NewDevicePage() {
  const { householdId } = await requireHousehold();
  const supabase = await createClient();

  const { data: rooms } = await supabase
    .from("rooms")
    .select("id, name")
    .eq("household_id", householdId)
    .order("name", { ascending: true });

  return (
    <div style={{ paddingBlock: "24px" }}>
      <p className="eyebrow">Add a device</p>
      <h1 style={{ marginBottom: "20px" }}>New device</h1>
      <NewDeviceFlow householdId={householdId} rooms={rooms ?? []} />
    </div>
  );
}
