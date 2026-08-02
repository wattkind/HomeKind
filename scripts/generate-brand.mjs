#!/usr/bin/env node
/**
 * Generates the whole HomeKind brand asset set from two committed inputs:
 *
 *   public/assets/brand/source/homekind-mark-original.png   the approved mark artwork
 *   public/assets/brand/logos/homekind-{wordmark,tagline}.svg   the outlined type
 *
 * Everything else — marks, lockups, favicon, PWA icons and the social card — is derived
 * here, so there is exactly one place a size or a margin is decided. Run with:
 *
 *   node scripts/generate-brand.mjs
 *
 * The type SVGs come from scripts/lib/build-type.py and only need rebuilding if the
 * wordmark or tagline text changes. The source mark is never redrawn — see docs/BRAND.md.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const brand = path.join(root, "public/assets/brand");

const CREAM = "#fff6eb";
const PEACH = "#ffe9d6";

/** Trimmed source artwork plus its natural aspect ratio. */
async function loadMark() {
  const source = path.join(brand, "source/homekind-mark-original.png");
  const { data, info } = await sharp(await readFile(source))
    .trim({ threshold: 1 })
    .toBuffer({ resolveWithObject: true });
  return { data, aspect: info.width / info.height };
}

/**
 * The mark centred on a square canvas. `coverage` is the fraction of the canvas width
 * the artwork spans, which is what sets the clear space around it.
 */
async function square(mark, size, coverage, background) {
  const width = Math.round(size * coverage);
  const height = Math.round(width / mark.aspect);
  const art = await sharp(mark.data).resize(width, height).png().toBuffer();
  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: background ?? { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      {
        input: art,
        left: Math.round((size - width) / 2),
        top: Math.round((size - height) / 2),
      },
    ])
    .png()
    .toBuffer();
}

async function svgAtWidth(file, width) {
  const buf = await sharp(await readFile(path.join(brand, "logos", file)))
    .resize({ width })
    .png()
    .toBuffer();
  const { height } = await sharp(buf).metadata();
  return { buf, width, height };
}

async function write(relative, buffer) {
  const target = path.join(brand, relative);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, buffer);
  const { width, height } = await sharp(buffer).metadata();
  console.log(`  ${relative.padEnd(42)} ${width}x${height}`);
}

/** Horizontal lockup: mark, then the wordmark with the tagline optionally beneath it. */
async function horizontalLockup(mark, { withTagline }) {
  const margin = 64;
  const markSize = 400;
  const gap = 52;
  const typeWidth = 900;

  const wordmark = await svgAtWidth("homekind-wordmark.svg", typeWidth);
  const tagline = withTagline ? await svgAtWidth("homekind-tagline.svg", typeWidth) : null;
  const typeGap = 26;
  const typeHeight = wordmark.height + (tagline ? typeGap + tagline.height : 0);

  const width = margin * 2 + markSize + gap + typeWidth;
  const height = Math.max(markSize, typeHeight) + margin * 2;
  const typeLeft = margin + markSize + gap;
  const typeTop = Math.round((height - typeHeight) / 2);

  const layers = [
    { input: await square(mark, markSize, 1), left: margin, top: Math.round((height - markSize) / 2) },
    { input: wordmark.buf, left: typeLeft, top: typeTop },
  ];
  if (tagline) {
    layers.push({ input: tagline.buf, left: typeLeft, top: typeTop + wordmark.height + typeGap });
  }

  return sharp({ create: { width, height, channels: 4, background: CREAM } })
    .composite(layers)
    .png()
    .toBuffer();
}

/** Stacked lockup for square-ish placements: mark over wordmark over tagline. */
async function stackedLockup(mark) {
  const margin = 64;
  const markSize = 360;
  const typeWidth = 620;

  const wordmark = await svgAtWidth("homekind-wordmark.svg", typeWidth);
  const tagline = await svgAtWidth("homekind-tagline.svg", typeWidth);
  const markGap = 24;
  const typeGap = 22;

  const width = typeWidth + margin * 2;
  const height = margin * 2 + markSize + markGap + wordmark.height + typeGap + tagline.height;
  const centre = (w) => Math.round((width - w) / 2);
  const markTop = margin;
  const wordmarkTop = markTop + markSize + markGap;

  return sharp({ create: { width, height, channels: 4, background: CREAM } })
    .composite([
      { input: await square(mark, markSize, 1), left: centre(markSize), top: markTop },
      { input: wordmark.buf, left: centre(typeWidth), top: wordmarkTop },
      { input: tagline.buf, left: centre(typeWidth), top: wordmarkTop + wordmark.height + typeGap },
    ])
    .png()
    .toBuffer();
}

/** 1200x630 Open Graph card, matching the warm-field treatment of the sibling brands. */
async function socialCard(mark) {
  const W = 1200;
  const H = 630;
  const background = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
       <defs>
         <radialGradient id="glow">
           <stop stop-color="#FFC66A" stop-opacity=".45"/>
           <stop offset="1" stop-color="${CREAM}" stop-opacity="0"/>
         </radialGradient>
       </defs>
       <rect width="${W}" height="${H}" fill="${CREAM}"/>
       <circle cx="1010" cy="110" r="320" fill="url(#glow)"/>
       <path d="M0 505c220-100 390-22 590 45 200 67 410 52 610-70v150H0Z" fill="${PEACH}"/>
     </svg>`,
  );

  const markSize = 300;
  const typeWidth = 600;
  const wordmark = await svgAtWidth("homekind-wordmark.svg", typeWidth);
  const tagline = await svgAtWidth("homekind-tagline.svg", typeWidth);
  const typeGap = 26;
  const typeHeight = wordmark.height + typeGap + tagline.height;

  const markLeft = 110;
  const typeLeft = markLeft + markSize + 56;
  const centreLine = 275; // sits the composition above the peach wave
  const typeTop = Math.round(centreLine - typeHeight / 2);
  const byline = await svgAtWidth("homekind-byline.svg", 250);

  return sharp(background)
    .composite([
      { input: await square(mark, markSize, 1), left: markLeft, top: centreLine - markSize / 2 },
      { input: wordmark.buf, left: typeLeft, top: typeTop },
      { input: tagline.buf, left: typeLeft, top: typeTop + wordmark.height + typeGap },
      { input: byline.buf, left: markLeft + 10, top: H - 96 },
    ])
    .png()
    .toBuffer();
}

async function main() {
  const mark = await loadMark();
  console.log("Brand assets (public/assets/brand):");

  // Marks. 0.88 coverage leaves roughly the one-heart-width clear space the guide asks for.
  await write("logos/homekind-mark.png", await square(mark, 1024, 0.88));
  await write("logos/homekind-mark-cream.png", await square(mark, 1024, 0.88, CREAM));
  // Small transparent mark for in-product chrome, where CSS owns the surrounding space.
  // Kept light enough to sit in the service worker's precache list.
  await write("logos/homekind-mark-ui.png", await square(mark, 128, 1));

  // Lockups.
  await write("logos/homekind-logo.png", await horizontalLockup(mark, { withTagline: true }));
  await write("logos/homekind-logo-compact.png", await horizontalLockup(mark, { withTagline: false }));
  await write("logos/homekind-logo-stacked.png", await stackedLockup(mark));

  // Favicon and social card.
  const favicon = await square(mark, 512, 0.82, CREAM);
  await write("iconography/homekind-favicon.png", favicon);
  await write("social-card.png", await socialCard(mark));

  // App-facing copies: the favicon the document head points at, and the PWA icon set.
  console.log("App icons (public):");
  const app = async (relative, buffer) => {
    const target = path.join(root, "public", relative);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, buffer);
    const { width, height } = await sharp(buffer).metadata();
    console.log(`  ${relative.padEnd(42)} ${width}x${height}`);
  };

  await app("assets/favicon.png", favicon);
  await app("icons/apple-touch-icon.png", await square(mark, 180, 0.82, CREAM));
  await app("icons/icon-192.png", await square(mark, 192, 0.82, CREAM));
  await app("icons/icon-512.png", await square(mark, 512, 0.82, CREAM));
  // Maskable: keep the artwork inside the safe circle a launcher may crop to.
  await app("icons/icon-maskable-512.png", await square(mark, 512, 0.6, CREAM));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
