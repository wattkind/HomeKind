"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DOCUMENT_BUCKET, documentPath } from "@/lib/storage";
import { compressImage } from "@/lib/compress";
import {
  DeviceIdentityFields,
  DevicePurchaseFields,
  DeviceRoomWarrantyFields,
  emptyDeviceFormValues,
  validateDeviceForm,
  type DeviceFormValues,
  type RoomOption,
} from "@/components/device-form";
import { AutoFetchStep } from "@/components/auto-fetch-step";

type Step = 1 | 2 | 3;

type PendingUpload = {
  file: File;
  type: "manual" | "receipt";
};

export function NewDeviceFlow({ householdId, rooms }: { householdId: string; rooms: RoomOption[] }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [values, setValues] = useState<DeviceFormValues>(emptyDeviceFormValues);
  const [nameError, setNameError] = useState<string | null>(null);
  const [manualFile, setManualFile] = useState<File | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [failedUploads, setFailedUploads] = useState<string[]>([]);

  function goToStep2() {
    const error = validateDeviceForm(values);
    setNameError(error);
    if (error) return;
    setStep(2);
  }

  async function handleReceiptChange(file: File | null) {
    if (!file) {
      setReceiptFile(null);
      return;
    }
    setReceiptFile(await compressImage(file));
  }

  async function save() {
    setSaving(true);
    setSaveError(null);
    setFailedUploads([]);

    const supabase = createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data: device, error: insertError } = await supabase
      .from("devices")
      .insert({
        household_id: householdId,
        name: values.name.trim(),
        brand: values.brand.trim() || null,
        model_number: values.model_number.trim() || null,
        purchase_date: values.purchase_date || null,
        purchase_price: values.purchase_price ? Number(values.purchase_price) : null,
        room_id: values.room_id || null,
        warranty_end: values.warranty_end || null,
        created_by: user?.id ?? null,
      })
      .select("id")
      .single();

    if (insertError || !device) {
      setSaving(false);
      setSaveError("We couldn't save the device. Check your details and try again.");
      return;
    }

    const uploads: PendingUpload[] = [
      ...(manualFile ? [{ file: manualFile, type: "manual" as const }] : []),
      ...(receiptFile ? [{ file: receiptFile, type: "receipt" as const }] : []),
    ];

    const failures: string[] = [];

    for (const upload of uploads) {
      const path = documentPath(householdId, device.id, upload.file.name);

      const { error: uploadError } = await supabase.storage.from(DOCUMENT_BUCKET).upload(path, upload.file, {
        contentType: upload.file.type || undefined,
      });

      if (uploadError) {
        failures.push(upload.type === "manual" ? "manual" : "receipt");
        continue;
      }

      const { error: docError } = await supabase.from("documents").insert({
        device_id: device.id,
        household_id: householdId,
        type: upload.type,
        storage_path: path,
        file_name: upload.file.name,
        mime_type: upload.file.type || "application/octet-stream",
        size_bytes: upload.file.size,
        created_by: user?.id ?? null,
      });

      if (docError) {
        failures.push(upload.type === "manual" ? "manual" : "receipt");
      }
    }

    setSaving(false);

    if (failures.length > 0) {
      setFailedUploads(failures);
      // The device itself saved fine — let the person see the detail page
      // and retry the failed document from there rather than blocking here.
      setTimeout(() => router.push(`/devices/${device.id}`), 1500);
      return;
    }

    router.push(`/devices/${device.id}`);
  }

  return (
    <div style={{ display: "grid", gap: "20px", maxWidth: "480px" }}>
      <p className="hint">Step {step} of 3</p>

      {saveError ? (
        <div className="banner error" role="alert">
          <p>{saveError}</p>
        </div>
      ) : null}

      {failedUploads.length > 0 ? (
        <div className="banner" role="alert">
          <p>
            The device saved, but the {failedUploads.join(" and ")} didn&apos;t upload. Open the device and try
            adding it again from there.
          </p>
        </div>
      ) : null}

      {step === 1 ? (
        <>
          <DeviceIdentityFields values={values} onChange={setValues} nameError={nameError} />
          <div className="form-actions">
            <button type="button" className="button" onClick={goToStep2}>
              Next
            </button>
          </div>
        </>
      ) : null}

      {step === 2 ? (
        <>
          <AutoFetchStep brand={values.brand} model={values.model_number} onManualSelected={setManualFile} />

          <div className="field">
            <label htmlFor="receipt-upload">Receipt (optional)</label>
            <input
              id="receipt-upload"
              type="file"
              accept="image/*,application/pdf"
              capture="environment"
              onChange={(event) => void handleReceiptChange(event.target.files?.[0] ?? null)}
            />
          </div>

          <div className="form-actions">
            <button type="button" className="button secondary" onClick={() => setStep(1)}>
              Back
            </button>
            <button type="button" className="button" onClick={() => setStep(3)}>
              Next
            </button>
          </div>
        </>
      ) : null}

      {step === 3 ? (
        <>
          <DevicePurchaseFields values={values} onChange={setValues} />
          <DeviceRoomWarrantyFields values={values} onChange={setValues} rooms={rooms} />

          <div className="form-actions">
            <button type="button" className="button secondary" onClick={() => setStep(2)} disabled={saving}>
              Back
            </button>
            <button type="button" className="button" onClick={() => void save()} disabled={saving}>
              {saving ? "Saving…" : "Save device"}
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
