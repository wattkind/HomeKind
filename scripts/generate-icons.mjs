#!/usr/bin/env node
// Generates public/icons/{icon-192,icon-512,icon-maskable-512}.png from
// public/assets/favicon.png. Run with `node scripts/generate-icons.mjs`
// (sharp is a project dependency via the "sharp" override, or install it
// temporarily with `npx --yes sharp-cli` style usage if needed).
//
// Maskable icon: the favicon content is scaled to ~80% and centered on a
// #FFF6EB square, leaving the ~10%-per-side safe zone maskable icons need.

import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const source = path.join(root, "public/assets/favicon.png");
const outDir = path.join(root, "public/icons");

const BACKGROUND = "#fff6eb";

async function main() {
  await mkdir(outDir, { recursive: true });

  await sharp(source)
    .resize(192, 192, { fit: "cover" })
    .png()
    .toFile(path.join(outDir, "icon-192.png"));

  await sharp(source)
    .resize(512, 512, { fit: "cover" })
    .png()
    .toFile(path.join(outDir, "icon-512.png"));

  // Maskable: favicon at ~80% (410/512), centered on a solid safe-zone square.
  const maskableContentSize = Math.round(512 * 0.8);
  const maskableContent = await sharp(source)
    .resize(maskableContentSize, maskableContentSize, { fit: "cover" })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: BACKGROUND,
    },
  })
    .composite([
      {
        input: maskableContent,
        left: Math.round((512 - maskableContentSize) / 2),
        top: Math.round((512 - maskableContentSize) / 2),
      },
    ])
    .png()
    .toFile(path.join(outDir, "icon-maskable-512.png"));

  console.log("Generated icon-192.png, icon-512.png, icon-maskable-512.png in public/icons/");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
