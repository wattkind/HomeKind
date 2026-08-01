import Link from "next/link";
import { daysUntil } from "@/lib/warranty";

export type DeviceCardData = {
  id: string;
  name: string;
  brand: string | null;
  model_number: string | null;
  warranty_end: string | null;
  room: { id: string; name: string } | null;
};

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

function warrantyLine(warrantyEnd: string | null): string {
  if (!warrantyEnd) {
    return "No warranty on file";
  }

  const days = daysUntil(warrantyEnd);
  if (days < 0) {
    return `Warranty ended ${formatDate(warrantyEnd)}`;
  }
  if (days === 0) {
    return "Warranty ends today";
  }
  return `Warranty ends ${formatDate(warrantyEnd)} (${days} day${days === 1 ? "" : "s"})`;
}

export function DeviceCard({ device }: { device: DeviceCardData }) {
  const brandModel = [device.brand, device.model_number].filter(Boolean).join(" · ");
  const hasWarranty = Boolean(device.warranty_end);

  return (
    <Link href={`/devices/${device.id}`} className="card" style={{ display: "grid", gap: "8px", textDecoration: "none" }}>
      <h3 style={{ fontSize: "1.15rem" }}>{device.name}</h3>
      {brandModel ? <p style={{ margin: 0, color: "var(--slate)" }}>{brandModel}</p> : null}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center" }}>
        {device.room ? <span className="chip">{device.room.name}</span> : null}
      </div>
      <p style={{ margin: 0, fontSize: "0.88rem", color: hasWarranty ? "var(--coral-text)" : "var(--stone)" }}>
        {warrantyLine(device.warranty_end)}
      </p>
    </Link>
  );
}
