import Link from "next/link";

/**
 * HomeKind lockup for in-product chrome: the approved mark alongside the wordmark.
 *
 * The wordmark is live text rather than the logo artwork so it scales with the user's font
 * settings and stays selectable. This follows the family's typeset-lockup convention
 * (mark image + live-text wordmark), which replaced the older raster lockup with its
 * tagline baked in — see the .lockup classes in red3112/WattKind-AI assets/styles.css and
 * the matching components in the StudyKind and Discovery repos. Nunito, weight 850, with
 * Coral (text) for the "Kind" half — see docs/BRAND.md for why that differs from the raw
 * coral gradient in the logo files.
 *
 * Plain <img> rather than next/image: the header has to render offline, and the service
 * worker precaches this exact path (see public/sw.js) rather than an /_next/image URL.
 */
export function Wordmark() {
  return (
    <Link
      href="/home"
      aria-label="HomeKind home"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.5rem",
        color: "var(--ink)",
        fontFamily: "Nunito, ui-rounded, 'Arial Rounded MT Bold', sans-serif",
        fontSize: "1.1rem",
        fontWeight: 850,
        textDecoration: "none",
      }}
    >
      <img
        src="/assets/brand/logos/homekind-mark-ui.png"
        alt=""
        width={28}
        height={28}
        style={{ display: "block", width: "1.75rem", height: "1.75rem", objectFit: "contain" }}
      />
      <span>
        Home<span className="brand-kind" style={{ color: "#b9383e" }}>Kind</span>
      </span>
    </Link>
  );
}
