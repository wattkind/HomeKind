"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { createSignedUrl } from "@/lib/storage";

/**
 * Renders an image document from its storage path. Shows a small thumbnail
 * link that expands to a larger inline view when clicked (dialog-style
 * overlay would need extra chrome we don't need for v1).
 */
export function ImageViewer({ storagePath, fileName }: { storagePath: string; fileName: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    async function load() {
      const supabase = createClient();
      const signedUrl = await createSignedUrl(supabase, storagePath);
      if (!cancelled) {
        setUrl(signedUrl);
        setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [storagePath]);

  if (loading) {
    return <p className="hint">Loading {fileName}…</p>;
  }

  if (!url) {
    return <p className="hint">We couldn&apos;t open this image. Try again shortly.</p>;
  }

  return (
    <div
      style={
        expanded
          ? {
              position: "fixed",
              inset: 0,
              zIndex: 50,
              display: "grid",
              placeItems: "center",
              background: "rgba(17, 24, 39, .85)",
              padding: "20px",
            }
          : undefined
      }
      onClick={expanded ? () => setExpanded(false) : undefined}
    >
      <img
        src={url}
        alt={fileName}
        onClick={(event) => {
          event.stopPropagation();
          setExpanded((value) => !value);
        }}
        style={
          expanded
            ? { maxHeight: "90vh", maxWidth: "90vw", borderRadius: "12px", cursor: "zoom-out" }
            : { width: "100%", borderRadius: "16px", border: "1px solid var(--line)", cursor: "zoom-in" }
        }
      />
    </div>
  );
}
