import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient, requireHousehold } from "@/lib/supabase/server";
import { daysUntil } from "@/lib/warranty";
import { DocumentList } from "@/components/document-list";
import { UploadDocument } from "@/components/upload-document";
import { DeviceManualFetch } from "@/components/device-manual-fetch";
import { RestoreDeviceCard, DeleteDeviceButton } from "@/components/device-actions";
import { getAiSettings } from "@/lib/ai/settings";

export const dynamic = "force-dynamic";

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

function warrantyLine(warrantyEnd: string | null): string {
  if (!warrantyEnd) return "No warranty on file";
  const days = daysUntil(warrantyEnd);
  if (days < 0) return `Warranty ended ${formatDate(warrantyEnd)}`;
  if (days === 0) return "Warranty ends today";
  return `Warranty ends ${formatDate(warrantyEnd)} (${days} day${days === 1 ? "" : "s"})`;
}

export default async function DeviceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { householdId } = await requireHousehold();
  const supabase = await createClient();

  const { data: device } = await supabase
    .from("devices")
    .select("id, name, brand, model_number, purchase_date, purchase_price, warranty_end, deleted_at, room:rooms(id, name)")
    .eq("id", id)
    .eq("household_id", householdId)
    .maybeSingle();

  if (!device) {
    notFound();
  }

  const room = Array.isArray(device.room) ? (device.room[0] ?? null) : device.room;

  if (device.deleted_at) {
    return (
      <div style={{ paddingBlock: "24px" }}>
        <RestoreDeviceCard deviceId={device.id} />
      </div>
    );
  }

  const { data: documents } = await supabase
    .from("documents")
    .select("*")
    .eq("device_id", device.id)
    .order("created_at", { ascending: false });

  const hasManual = (documents ?? []).some((doc) => doc.type === "manual");
  const brandModel = [device.brand, device.model_number].filter(Boolean).join(" · ");

  // Offer the automatic lookup only when it could actually work: no manual on
  // file yet, something to search on, and the household has it switched on.
  const trimmedBrand = device.brand?.trim() ?? "";
  const trimmedModel = device.model_number?.trim() ?? "";
  const aiSettings = await getAiSettings(householdId);
  const canAutoFetchManual =
    !hasManual && trimmedBrand.length > 0 && trimmedModel.length > 0 && aiSettings.autoFetchEnabled;

  return (
    <div style={{ display: "grid", gap: "24px", paddingBlock: "24px" }}>
      <div>
        <p className="eyebrow">Device</p>
        <h1>{device.name}</h1>
        {brandModel ? <p style={{ color: "var(--slate)" }}>{brandModel}</p> : null}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center", marginTop: "6px" }}>
          {room ? <span className="chip">{room.name}</span> : null}
        </div>
        <p style={{ color: device.warranty_end ? "var(--coral-text)" : "var(--stone)" }}>
          {warrantyLine(device.warranty_end)}
        </p>
        {device.purchase_date ? <p className="hint">Purchased {formatDate(device.purchase_date)}</p> : null}
        {device.purchase_price != null ? <p className="hint">Paid ${Number(device.purchase_price).toFixed(2)}</p> : null}
      </div>

      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
        <Link href={`/devices/${device.id}/edit`} className="button secondary">
          Edit device
        </Link>
      </div>

      {/* P6-UI: chat entry */}
      {hasManual ? (
        <Link href={`/devices/${device.id}/chat`} className="button">
          Chat about this device
        </Link>
      ) : (
        <div className="card">
          <p>Add a manual for this device to chat with it about troubleshooting and care.</p>
        </div>
      )}
      {/* /P6-UI: chat entry */}

      <div>
        <h2 style={{ marginBottom: "14px" }}>Documents</h2>
        <DocumentList documents={documents ?? []} />
      </div>

      {canAutoFetchManual ? (
        <DeviceManualFetch
          deviceId={device.id}
          householdId={householdId}
          brand={trimmedBrand}
          model={trimmedModel}
        />
      ) : null}

      <UploadDocument deviceId={device.id} householdId={householdId} />

      <DeleteDeviceButton deviceId={device.id} />
    </div>
  );
}
