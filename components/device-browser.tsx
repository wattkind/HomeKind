"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { matchesQuery } from "@/lib/search";
import { isExpiringWithin } from "@/lib/warranty";
import { DeviceCard, type DeviceCardData } from "@/components/device-card";

export type RoomOption = { id: string; name: string };

export function DeviceBrowser({
  devices,
  rooms,
  warrantyThresholdDays,
  initialFilter,
  initialRoomId,
  banner,
}: {
  devices: DeviceCardData[];
  rooms: RoomOption[];
  warrantyThresholdDays: number;
  initialFilter?: "expiring" | null;
  initialRoomId?: string | null;
  banner?: ReactNode;
}) {
  const [query, setQuery] = useState("");
  const [roomId, setRoomId] = useState<string | null>(initialRoomId ?? null);
  const [expiringOnly, setExpiringOnly] = useState(initialFilter === "expiring");

  const filtered = useMemo(() => {
    return devices.filter((device) => {
      if (!matchesQuery(device, query)) return false;
      if (roomId && device.room?.id !== roomId) return false;
      if (expiringOnly) {
        if (!device.warranty_end) return false;
        if (!isExpiringWithin(device.warranty_end, warrantyThresholdDays)) return false;
      }
      return true;
    });
  }, [devices, query, roomId, expiringOnly, warrantyThresholdDays]);

  const hasAnyDevices = devices.length > 0;

  return (
    <div style={{ display: "grid", gap: "16px", paddingBlock: "20px" }}>
      {/* P5: warranty banner slot */}
      {banner}

      {hasAnyDevices ? (
        <>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="device-search" className="sr-only">
              Search devices
            </label>
            <input
              id="device-search"
              type="search"
              placeholder="Search by name, brand or model"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>

          <div style={{ display: "flex", gap: "10px", overflowX: "auto", paddingBottom: "4px" }}>
            <button
              type="button"
              className={`chip ${roomId === null && !expiringOnly ? "active" : ""}`}
              onClick={() => {
                setRoomId(null);
                setExpiringOnly(false);
              }}
            >
              All
            </button>
            <button
              type="button"
              className={`chip ${expiringOnly ? "active" : ""}`}
              onClick={() => setExpiringOnly((value) => !value)}
            >
              Warranty expiring
            </button>
            {rooms.map((room) => (
              <button
                key={room.id}
                type="button"
                className={`chip ${roomId === room.id ? "active" : ""}`}
                onClick={() => setRoomId((current) => (current === room.id ? null : room.id))}
              >
                {room.name}
              </button>
            ))}
          </div>
        </>
      ) : null}

      {!hasAnyDevices ? (
        <div className="empty-state">
          <h2>No devices yet</h2>
          <p>Add your first device to keep its manual, receipt and warranty together.</p>
          <Link href="/devices/new" className="button">
            Add a device
          </Link>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <h2>No matches</h2>
          <p>Try a different search or clear the filters above.</p>
        </div>
      ) : (
        <div className="device-list">
          {filtered.map((device) => (
            <DeviceCard key={device.id} device={device} />
          ))}
        </div>
      )}
    </div>
  );
}
