import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient, requireHousehold } from "@/lib/supabase/server";
import { ChatPanel } from "@/components/chat-panel";

export const dynamic = "force-dynamic";

export default async function DeviceChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { householdId } = await requireHousehold();
  const supabase = await createClient();

  const { data: device } = await supabase
    .from("devices")
    .select("id, name, brand, model_number, deleted_at")
    .eq("id", id)
    .eq("household_id", householdId)
    .maybeSingle();

  if (!device || device.deleted_at) {
    notFound();
  }

  const { data: manual } = await supabase
    .from("documents")
    .select("file_name")
    .eq("device_id", device.id)
    .eq("type", "manual")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const deviceLabel = [device.name, [device.brand, device.model_number].filter(Boolean).join(" · ")]
    .filter(Boolean)
    .join(" — ");

  return (
    <div style={{ display: "grid", gap: "16px", paddingBlock: "24px" }}>
      <div>
        <Link href={`/devices/${device.id}`} className="text-link">
          ← Back to {device.name}
        </Link>
      </div>

      <div>
        <p className="eyebrow">Chat</p>
        <h1 style={{ fontSize: "1.75rem" }}>{device.name}</h1>
      </div>

      {manual ? (
        <ChatPanel deviceId={device.id} deviceLabel={deviceLabel} manualFileName={manual.file_name} />
      ) : (
        <div className="card">
          <p>
            Add a manual for this device before chatting with it — the assistant answers from the
            device&rsquo;s stored manual only.
          </p>
          <Link href={`/devices/${device.id}`} className="button secondary" style={{ marginTop: "8px" }}>
            Back to device
          </Link>
        </div>
      )}
    </div>
  );
}
