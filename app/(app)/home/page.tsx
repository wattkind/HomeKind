import { createClient, requireHousehold } from "@/lib/supabase/server";
import { DeviceBrowser } from "@/components/device-browser";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; room?: string }>;
}) {
  const { user, householdId } = await requireHousehold();
  const { filter, room } = await searchParams;
  const supabase = await createClient();

  const [{ data: devices }, { data: rooms }, { data: membership }] = await Promise.all([
    supabase
      .from("devices")
      .select("id, name, brand, model_number, warranty_end, room:rooms(id, name)")
      .eq("household_id", householdId)
      .is("deleted_at", null)
      .order("name", { ascending: true }),
    supabase.from("rooms").select("id, name").eq("household_id", householdId).order("name", { ascending: true }),
    supabase
      .from("household_members")
      .select("warranty_threshold_days")
      .eq("household_id", householdId)
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  const warrantyThresholdDays = membership?.warranty_threshold_days ?? 30;

  return (
    <DeviceBrowser
      devices={(devices ?? []).map((device) => ({
        ...device,
        room: Array.isArray(device.room) ? (device.room[0] ?? null) : device.room,
      }))}
      rooms={rooms ?? []}
      warrantyThresholdDays={warrantyThresholdDays}
      initialFilter={filter === "expiring" ? "expiring" : null}
      initialRoomId={room ?? null}
      banner={undefined /* P5: warranty banner slot */}
    />
  );
}
