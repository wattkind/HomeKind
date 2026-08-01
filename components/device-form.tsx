"use client";

import type { CSSProperties } from "react";

export type DeviceFormValues = {
  name: string;
  brand: string;
  model_number: string;
  purchase_date: string;
  purchase_price: string;
  room_id: string;
  warranty_end: string;
};

export const emptyDeviceFormValues: DeviceFormValues = {
  name: "",
  brand: "",
  model_number: "",
  purchase_date: "",
  purchase_price: "",
  room_id: "",
  warranty_end: "",
};

export type RoomOption = { id: string; name: string };

type FieldProps = {
  values: DeviceFormValues;
  onChange: (values: DeviceFormValues) => void;
};

function useSetter({ values, onChange }: FieldProps) {
  return function set<K extends keyof DeviceFormValues>(key: K, value: DeviceFormValues[K]) {
    onChange({ ...values, [key]: value });
  };
}

const selectStyle: CSSProperties = {
  width: "100%",
  padding: "13px 15px",
  border: "1px solid var(--line)",
  borderRadius: "12px",
  background: "white",
  fontFamily: "inherit",
  fontSize: "1rem",
};

/** Name, brand, model number — the "what is it" step. */
export function DeviceIdentityFields({ values, onChange, nameError }: FieldProps & { nameError?: string | null }) {
  const set = useSetter({ values, onChange });

  return (
    <div style={{ display: "grid", gap: "4px" }}>
      <div className="field">
        <label htmlFor="device-name">Name</label>
        <input
          id="device-name"
          type="text"
          value={values.name}
          onChange={(event) => set("name", event.target.value)}
          placeholder="e.g. Front-load washing machine"
          required
        />
        {nameError ? (
          <span className="hint" style={{ color: "var(--coral-text)" }}>
            {nameError}
          </span>
        ) : null}
      </div>

      <div className="field">
        <label htmlFor="device-brand">Brand</label>
        <input
          id="device-brand"
          type="text"
          value={values.brand}
          onChange={(event) => set("brand", event.target.value)}
          placeholder="e.g. Bosch"
        />
      </div>

      <div className="field">
        <label htmlFor="device-model">Model number</label>
        <input
          id="device-model"
          type="text"
          value={values.model_number}
          onChange={(event) => set("model_number", event.target.value)}
        />
      </div>
    </div>
  );
}

/** Purchase date + price — usually paired with room/warranty. */
export function DevicePurchaseFields({ values, onChange }: FieldProps) {
  const set = useSetter({ values, onChange });

  return (
    <div style={{ display: "grid", gap: "4px" }}>
      <div className="field">
        <label htmlFor="device-purchase-date">Purchase date</label>
        <input
          id="device-purchase-date"
          type="date"
          value={values.purchase_date}
          onChange={(event) => set("purchase_date", event.target.value)}
        />
      </div>

      <div className="field">
        <label htmlFor="device-purchase-price">Purchase price (AUD)</label>
        <input
          id="device-purchase-price"
          type="number"
          step="0.01"
          min="0"
          value={values.purchase_price}
          onChange={(event) => set("purchase_price", event.target.value)}
        />
      </div>
    </div>
  );
}

/** Room + warranty end date. */
export function DeviceRoomWarrantyFields({ values, onChange, rooms }: FieldProps & { rooms: RoomOption[] }) {
  const set = useSetter({ values, onChange });

  return (
    <div style={{ display: "grid", gap: "4px" }}>
      <div className="field">
        <label htmlFor="device-room">Room</label>
        <select
          id="device-room"
          value={values.room_id}
          onChange={(event) => set("room_id", event.target.value)}
          style={selectStyle}
        >
          <option value="">Unassigned</option>
          {rooms.map((room) => (
            <option key={room.id} value={room.id}>
              {room.name}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="device-warranty-end">Warranty ends</label>
        <input
          id="device-warranty-end"
          type="date"
          value={values.warranty_end}
          onChange={(event) => set("warranty_end", event.target.value)}
        />
      </div>
    </div>
  );
}

/** All fields at once — used by the edit page, which isn't a stepped wizard. */
export function DeviceFormFields({
  values,
  onChange,
  rooms,
  nameError,
}: FieldProps & { rooms: RoomOption[]; nameError?: string | null }) {
  return (
    <div style={{ display: "grid", gap: "4px" }}>
      <DeviceIdentityFields values={values} onChange={onChange} nameError={nameError} />
      <DevicePurchaseFields values={values} onChange={onChange} />
      <DeviceRoomWarrantyFields values={values} onChange={onChange} rooms={rooms} />
    </div>
  );
}

export function validateDeviceForm(values: DeviceFormValues): string | null {
  if (values.name.trim() === "") {
    return "Give the device a name to continue.";
  }
  return null;
}
