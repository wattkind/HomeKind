"use client";

import { useState } from "react";
import type { DocumentRow } from "@/lib/types";
import { PdfViewer } from "@/components/pdf-viewer";
import { ImageViewer } from "@/components/image-viewer";

const GROUP_LABELS: Record<DocumentRow["type"], string> = {
  manual: "Manuals",
  receipt: "Receipts",
  other: "Other",
};

const GROUP_ORDER: DocumentRow["type"][] = ["manual", "receipt", "other"];

function isImage(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}

export function DocumentList({ documents }: { documents: DocumentRow[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  if (documents.length === 0) {
    return <p className="hint">No documents yet.</p>;
  }

  const groups = GROUP_ORDER.map((type) => ({
    type,
    label: GROUP_LABELS[type],
    items: documents.filter((doc) => doc.type === type),
  })).filter((group) => group.items.length > 0);

  return (
    <div style={{ display: "grid", gap: "20px" }}>
      {groups.map((group) => (
        <div key={group.type}>
          <h3 style={{ fontSize: "1.05rem", marginBottom: "10px" }}>{group.label}</h3>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "10px" }}>
            {group.items.map((doc) => {
              const isOpen = openId === doc.id;
              return (
                <li key={doc.id} className="card" style={{ display: "grid", gap: "10px" }}>
                  <button
                    type="button"
                    onClick={() => setOpenId(isOpen ? null : doc.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "12px",
                      background: "none",
                      border: "none",
                      padding: 0,
                      minHeight: "44px",
                      font: "inherit",
                      color: "var(--ink)",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <span>{doc.file_name}</span>
                    <span className="chip">{isOpen ? "Close" : "View"}</span>
                  </button>
                  {isOpen ? (
                    isImage(doc.mime_type) ? (
                      <ImageViewer storagePath={doc.storage_path} fileName={doc.file_name} />
                    ) : (
                      <PdfViewer storagePath={doc.storage_path} title={doc.file_name} />
                    )
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
