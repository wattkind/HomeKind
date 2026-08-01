import Link from "next/link";

/**
 * Text wordmark for HomeKind, mirroring the .brand-mobile convention in
 * WattKindAI-Discovery's components/site-shell.tsx (Nunito, weight 850,
 * coral-text on the "Kind" half).
 */
export function Wordmark() {
  return (
    <Link
      href="/home"
      aria-label="HomeKind home"
      style={{
        display: "inline-flex",
        alignItems: "center",
        color: "var(--ink)",
        fontFamily: "Nunito, ui-rounded, 'Arial Rounded MT Bold', sans-serif",
        fontSize: "1.1rem",
        fontWeight: 850,
        textDecoration: "none",
      }}
    >
      Home<span className="brand-kind" style={{ color: "#b9383e" }}>Kind</span>
    </Link>
  );
}
