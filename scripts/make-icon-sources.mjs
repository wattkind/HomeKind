// Generates the source images that `capacitor-assets` needs to build the iOS
// app icon and launch screen: a flat Cream background with the approved
// HomeKind mark composited on top. The mark itself
// (resources/homekind-mark-original.png) is never redrawn or recoloured —
// this script only resizes it and pastes it onto a plain background.
//
// Run with: node scripts/make-icon-sources.mjs
//
// Outputs (all written to resources/):
//   icon.png              1024x1024, mark at ~78% width, centred, no transparency
//   icon-foreground.png   same artwork as icon.png, for adaptive/foreground use
//   icon-background.png   flat Cream, 1024x1024, no mark (background layer)
//   splash.png            2732x2732, mark at ~22% width, centred, on Cream
//   splash-dark.png       identical to splash.png (HomeKind does not design dark mode in v1)

import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const resourcesDir = path.join(root, 'resources');
const sourceMark = path.join(resourcesDir, 'homekind-mark-original.png');

const CREAM = '#FFF6EB';

/**
 * Build a square PNG of `canvasSize` x `canvasSize`, filled with `background`,
 * with the source mark resized so its width is `markFraction` of the canvas
 * and centred both horizontally and vertically.
 */
async function composeOnCream(canvasSize, markFraction, outPath) {
  const markWidth = Math.round(canvasSize * markFraction);

  const markBuffer = await sharp(sourceMark)
    .resize({ width: markWidth, height: markWidth, fit: 'contain' })
    .png()
    .toBuffer();

  const markMeta = await sharp(markBuffer).metadata();
  const left = Math.round((canvasSize - (markMeta.width ?? markWidth)) / 2);
  const top = Math.round((canvasSize - (markMeta.height ?? markWidth)) / 2);

  await sharp({
    create: {
      width: canvasSize,
      height: canvasSize,
      channels: 4,
      background: CREAM,
    },
  })
    .composite([{ input: markBuffer, left, top }])
    .flatten({ background: CREAM }) // guarantees no transparency in the output
    .png()
    .toFile(outPath);

  console.log(`wrote ${path.relative(root, outPath)}`);
}

async function flatCream(canvasSize, outPath) {
  await sharp({
    create: {
      width: canvasSize,
      height: canvasSize,
      channels: 4,
      background: CREAM,
    },
  })
    .png()
    .toFile(outPath);

  console.log(`wrote ${path.relative(root, outPath)}`);
}

async function main() {
  // 1024x1024 app icon: mark at ~78% width, centred, flat Cream, no transparency.
  await composeOnCream(1024, 0.78, path.join(resourcesDir, 'icon.png'));

  // Foreground layer for adaptive-icon-style generation: same composed artwork.
  await composeOnCream(1024, 0.78, path.join(resourcesDir, 'icon-foreground.png'));

  // Flat Cream background layer, no mark.
  await flatCream(1024, path.join(resourcesDir, 'icon-background.png'));

  // 2732x2732 splash screen: mark at ~22% width, centred, on Cream, no text.
  await composeOnCream(2732, 0.22, path.join(resourcesDir, 'splash.png'));

  // HomeKind does not design a dark-mode splash in v1; use the same artwork.
  await composeOnCream(2732, 0.22, path.join(resourcesDir, 'splash-dark.png'));
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
