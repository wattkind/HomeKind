# HomeKind brand supplement

HomeKind is a WattKind AI product and inherits the family brand system. **The canonical
source of truth for colour, typography, tone, accessibility and motion is
[`BRAND-GUIDE.md` in `red3112/WattKind-AI`](https://github.com/red3112/WattKind-AI/blob/main/BRAND-GUIDE.md).**
Where this document and that guide disagree, the guide wins. This file only covers what is
specific to HomeKind: the mark, the wordmark, the tagline, and where the files live.

Machine-readable index of the HomeKind assets: [`public/assets/brand/manifest.json`](../public/assets/brand/manifest.json).

## The mark

The HomeKind mark is a **house whose walls and roof enclose the family brain-heart**, with
three warm sparkles resting in the lower right of the interior.

It carries the family relationship the same way its siblings do — one shared brain-heart, one
category object each:

| Brand | Mark |
| --- | --- |
| WattKind AI | brain-heart, freestanding, with sparkles |
| StudyKind | brain-heart above an open book |
| **HomeKind** | **brain-heart inside a house** |

The house is the container rather than a companion object, which is the point: HomeKind is
about what a home already holds. The brain is the memory of the household's devices, the heart
is the care taken with them, and the sparkles are the small moments of help — a warranty caught
before it lapses, a manual found without hunting for it.

### Canonical artwork

- Exact supplied source: [`public/assets/brand/source/homekind-mark-original.png`](../public/assets/brand/source/homekind-mark-original.png).
- **Do not redraw, trace, reinterpret or recreate the mark as SVG.** This is the same rule the
  family guide applies to the WattKind and StudyKind marks. Every other raster asset in this
  repository is derived from that one file by `scripts/generate-brand.mjs`.
- The supplied artwork has a transparent field outside the house outline. Where a solid field
  is wanted — dark surfaces, app icons, favicons — use a Cream `#FFF6EB` chip, never a
  recoloured mark.

### Files

| File | Use |
| --- | --- |
| `logos/homekind-mark.png` | 1024², transparent. The mark on its own. |
| `logos/homekind-mark-cream.png` | 1024², Cream field. For dark or busy surfaces. |
| `logos/homekind-mark-ui.png` | 128², transparent. In-product chrome, where CSS owns the spacing. |
| `logos/homekind-logo.png` | Horizontal lockup: mark, wordmark, tagline. The default logo. |
| `logos/homekind-logo-compact.png` | Horizontal lockup without the tagline. Headers, narrow bars. |
| `logos/homekind-logo-stacked.png` | Stacked lockup. Square-ish placements, covers, print. |
| `iconography/homekind-favicon.png` | 512², Cream field. Source for the browser and app icons. |
| `social-card.png` | 1200×630 Open Graph card. |

All paths are relative to `public/assets/brand/`.

### Clear space and minimum size

- Keep clear space of at least **one heart width** around the mark on every side — the same
  rule as the rest of the family. The generated square marks already carry it.
- Minimum width is **24px / 6mm**. Below about 28px the sparkles stop resolving; that is
  expected and acceptable, the house and heart still read.
- Do not stretch, rotate, recolour outside the approved palette, add strokes, shadows or glow,
  or place the mark on busy or low-contrast imagery.

## The wordmark

"Home" is Ink `#111827`; "Kind" carries the primary warm gradient (Coral `#FF6B6B` →
Tangerine `#FF8C3A`). Set in Nunito at weight 850.

- [`logos/homekind-wordmark.svg`](../public/assets/brand/logos/homekind-wordmark.svg) is the
  wordmark as **vector outlines**, so it renders identically with no font installed.
- [`logos/homekind-tagline.svg`](../public/assets/brand/logos/homekind-tagline.svg) and
  [`logos/homekind-byline.svg`](../public/assets/brand/logos/homekind-byline.svg) are the same
  treatment for the tagline and the "A WattKind AI product" byline, set in Inter at weight 500.

**One deliberate difference between the logo and the app.** In the logo files "Kind" uses the
raw Coral gradient, because there it is a mark. In the running product — `components/wordmark.tsx`
— "Kind" is set in Coral (text) `#B9383E`, because there it is text and has to clear WCAG AA.
Both are correct; do not "fix" either one to match the other.

## Messaging

- **Tagline:** Home support that remembers for you. ♥
- **Byline:** A WattKind AI product
- **Family line:** Same heart. Different focus. Always kind. ♥

The tagline follows the family pattern (`WattKind AI`: *Helpful AI for real life*;
`StudyKind`: *Study support that meets you where you are*) and is a promise the product
actually keeps: HomeKind holds the manuals, receipts and warranty dates so nobody in the
household has to.

Public contact stays `support@wattkind.ai` — one monitored address across the family.

## Colour, type, tone

Inherited unchanged from the family guide. The tokens are already mirrored in
[`app/globals.css`](../app/globals.css); do not introduce new colours or type scales here.
`docs` and product copy follow the family tone of voice: warm, supportive, clear, playful,
trustworthy, human-centred.

## Regenerating the assets

```bash
node scripts/generate-brand.mjs
```

Derives every mark, lockup, favicon, app icon and the social card from the supplied source
artwork and the outlined type. Run it after replacing the source artwork, and commit the
results.

The outlined type only needs rebuilding if the wordmark, tagline or byline **text** changes:

```bash
pip install fonttools uharfbuzz
python3 scripts/lib/build-type.py
```

That step shapes the string with HarfBuzz and pins the variable font to the right weight, so
the committed SVGs carry real kerning rather than a rasteriser's guess.

## Where the assets are used

| Surface | Asset |
| --- | --- |
| Browser tab | `public/assets/favicon.png` |
| iOS home screen | `public/icons/apple-touch-icon.png` |
| PWA install | `public/icons/icon-192.png`, `icon-512.png`, `icon-maskable-512.png` |
| Link previews | `public/assets/brand/social-card.png`, referenced from `app/layout.tsx` |
| App header | `logos/homekind-mark-ui.png` + the live-text wordmark |
| Support email | `email-signatures/homekind-support-email-signature.html` |

The mark is also mirrored into the family asset library at
`assets/brand/` in `red3112/WattKind-AI`, which is where the brand guide expects to find every
product's approved artwork.
