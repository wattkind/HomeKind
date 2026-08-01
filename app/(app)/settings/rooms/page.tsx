import { createClient, requireHousehold } from "@/lib/supabase/server";
import { RoomsManager, type RoomWithCount } from "@/components/rooms-manager";

export const dynamic = "force-dynamic";

export default async function RoomsSettingsPage() {
  const { householdId } = await requireHousehold();
  const supabase = await createClient();

  const [{ data: rooms }, { data: devices }] = await Promise.all([
    supabase.from("rooms").select("id, name").eq("household_id", householdId).order("name", { ascending: true }),
    supabase.from("devices").select("room_id").eq("household_id", householdId).is("deleted_at", null),
  ]);

  const counts = new Map<string, number>();
  for (const device of devices ?? []) {
    if (!device.room_id) continue;
    counts.set(device.room_id, (counts.get(device.room_id) ?? 0) + 1);
  }

  const roomsWithCounts: RoomWithCount[] = (rooms ?? []).map((room) => ({
    ...room,
    device_count: counts.get(room.id) ?? 0,
  }));

  return (
    <div style={{ paddingBlock: "24px" }}>
      <p className="eyebrow">Settings</p>
      <h1 style={{ marginBottom: "20px" }}>Rooms</h1>
      <RoomsManager householdId={householdId} rooms={roomsWithCounts} />
    </div>
  );
}
