import Image from "next/image";
import Link from "next/link";

/**
 * HomeKind wordmark: the approved house mark (public/assets/brand/, from the
 * canonical WattKind-AI library) beside the text treatment that mirrors the
 * .brand-mobile convention in WattKindAI-Discovery's components/site-shell.tsx
 * (Nunito, weight 850, coral-text on the "Kind" half).
 */
export function Wordmark() {
  return (
    <Link
      href="/home"
      aria-label="HomeKind home"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.45rem",
        color: "var(--ink)",
        fontFamily: "Nunito, ui-rounded, 'Arial Rounded MT Bold', sans-serif",
        fontSize: "1.1rem",
        fontWeight: 850,
        textDecoration: "none",
      }}
    >
      <Image
        src="/assets/brand/homekind-mark-64.png"
        alt=""
        width={26}
        height={26}
        priority
      />
      Home<span className="brand-kind" style={{ color: "#b9383e" }}>Kind</span>
    </Link>
  );
}
