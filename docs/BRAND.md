# HomeKind brand supplement

This is the product-level brand reference for the HomeKind app. It **defers to the
canonical WattKind AI brand sources** in `red3112/WattKind-AI`:

- `BRAND-GUIDE.md` (prose standard — see the HomeKind sections under Messaging and
  the Logo system)
- `assets/brand/tokens.json` (machine-readable token authority; mirrored here as
  `shared/brand-tokens.json` — re-copy from canonical when it changes, never edit
  the local copy independently)
- `assets/brand/` (approved artwork)

If anything here conflicts with those sources, the WattKind-AI repository wins.

## Identity

- **Name:** HomeKind — "Home" in Ink `#111827`, "Kind" in the primary warm gradient
  (in running text and the header wordmark, "Kind" uses AA-safe coral text `#B9383E`).
- **Primary line:** Home support that remembers for you.
- **Mark:** the shared WattKind brain-heart inside a house, three sparkles in the
  lower right of the interior — the family's container composition. The supplied
  master is `assets/brand/source/homekind-mark-original.png` in WattKind-AI;
  never redraw, trace or recreate it.
- **Tagline pairing:** Slate `#374151` + Coral text `#B9383E` (the accessible
  pairing this product established for the family).

## Local assets (this repository)

| File | What it is |
|---|---|
| `public/assets/brand/homekind-mark.png` | Canonical 1024×1024 transparent mark, copied from WattKind-AI |
| `public/assets/brand/homekind-logo.png` | Canonical 1480×528 horizontal lockup, copied from WattKind-AI |
| `public/assets/brand/homekind-mark-64.png` | Pre-scaled mark used by `components/wordmark.tsx` |
| `public/assets/brand/homekind-social-card.png` | 1200×630 sharing card — lockup centred on Cream |
| `public/assets/favicon.png` | The canonical HomeKind favicon (512, transparent) |
| `public/icons/icon-192.png`, `icon-512.png` | PWA icons — mark at 84% on Cream `#FFF6EB` |
| `public/icons/icon-maskable-512.png` | Maskable PWA icon — mark at 62% (safe zone) on Cream |

All of these derive mechanically from the approved artwork in WattKind-AI. To
update them, regenerate from the canonical files rather than editing the outputs;
the PWA icons and social card are simple PIL compositions (mark/lockup on Cream).

## Rules that bite

- The ♥ glyph lives in the logo mark only — never in copy. The only text ornament
  is the ✦ section eyebrow. No emoji decoration.
- The warm gradient is for fills, marks and the wordmark's "Kind" — never small text.
- On dark surfaces the transparent artwork sits on a Cream chip.
- Coral `#FF6B6B` fails AA as text; use `#B9383E` for coral text and links.
