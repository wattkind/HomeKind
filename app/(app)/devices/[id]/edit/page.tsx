import { notFound } from "next/navigation";
import { createClient, requireHousehold } from "@/lib/supabase/server";
import { EditDeviceForm } from "@/components/edit-device-form";
import type { DeviceFormValues } from "@/components/device-form";

export const dynamic = "force-dynamic";

export default async function EditDevicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { householdId } = await requireHousehold();
  const supabase = await createClient();

  const [{ data: device }, { data: rooms }] = await Promise.all([
    supabase
      .from("devices")
      .select("id, name, brand, model_number, purchase_date, purchase_price, room_id, warranty_end")
      .eq("id", id)
      .eq("household_id", householdId)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase.from("rooms").select("id, name").eq("household_id", householdId).order("name", { ascending: true }),
  ]);

  if (!device) {
    notFound();
  }

  const initialValues: DeviceFormValues = {
    name: device.name,
    brand: device.brand ?? "",
    model_number: device.model_number ?? "",
    purchase_date: device.purchase_date ?? "",
    purchase_price: device.purchase_price != null ? String(device.purchase_price) : "",
    room_id: device.room_id ?? "",
    warranty_end: device.warranty_end ?? "",
  };

  return (
    <div style={{ paddingBlock: "24px" }}>
      <p className="eyebrow">Edit device</p>
      <h1 style={{ marginBottom: "20px" }}>{device.name}</h1>
      <EditDeviceForm deviceId={device.id} initialValues={initialValues} rooms={rooms ?? []} />
    </div>
  );
}
