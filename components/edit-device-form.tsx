"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  DeviceFormFields,
  validateDeviceForm,
  type DeviceFormValues,
  type RoomOption,
} from "@/components/device-form";

export function EditDeviceForm({
  deviceId,
  initialValues,
  rooms,
}: {
  deviceId: string;
  initialValues: DeviceFormValues;
  rooms: RoomOption[];
}) {
  const router = useRouter();
  const [values, setValues] = useState<DeviceFormValues>(initialValues);
  const [nameError, setNameError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const validationError = validateDeviceForm(values);
    setNameError(validationError);
    if (validationError) return;

    setSaving(true);
    setError(null);

    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("devices")
      .update({
        name: values.name.trim(),
        brand: values.brand.trim() || null,
        model_number: values.model_number.trim() || null,
        purchase_date: values.purchase_date || null,
        purchase_price: values.purchase_price ? Number(values.purchase_price) : null,
        room_id: values.room_id || null,
        warranty_end: values.warranty_end || null,
      })
      .eq("id", deviceId);

    setSaving(false);

    if (updateError) {
      setError("We couldn't save your changes. Try again.");
      return;
    }

    router.push(`/devices/${deviceId}`);
  }

  return (
    <div style={{ display: "grid", gap: "16px", maxWidth: "480px" }}>
      {error ? (
        <div className="banner error" role="alert">
          <p>{error}</p>
        </div>
      ) : null}

      <DeviceFormFields values={values} onChange={setValues} rooms={rooms} nameError={nameError} />

      <div className="form-actions">
        <button type="button" className="button secondary" onClick={() => router.push(`/devices/${deviceId}`)} disabled={saving}>
          Cancel
        </button>
        <button type="button" className="button" onClick={() => void save()} disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}
