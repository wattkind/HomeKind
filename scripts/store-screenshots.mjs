// Renders the store screenshots from the built app with fictional sample data, and
// the Google Play icon and feature graphic from the approved artwork.
//
//   npm run build
//   node scripts/store-screenshots.mjs [android|ios]      (default: android)
//
// Needs a Chromium: Google Chrome installed (used through Playwright's "chrome"
// channel) or a path in HOMEKIND_CHROMIUM. The script serves dist/ itself with
// `vite preview`, so nothing else has to be running.
//
// Sample data goes in through the app's own Restore flow (a generated backup zip),
// so the screens show exactly what a real household would see. Dates are relative
// to today so the warranty pills read "Ends in 24 days" and so on whenever this runs.
//
// Output:
//   android: docs/store-screenshots/android/NN-*.png at 1080x1920 (9:16, Play's phone
//            format), plus icon-512.png and feature-graphic.png (1024x500)
//   ios:     docs/store-screenshots/NN-*.png at 1320x2868 (the 6.9" App Store set)

import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { strToU8, zipSync } from 'fflate';
import { chromium } from 'playwright-core';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const target = process.argv[2] ?? 'android';

const PRESETS = {
  // CSS viewport and device scale factor chosen so the output is the store's exact size.
  android: {
    width: 405,
    height: 720,
    scale: 1080 / 405,
    outDir: 'docs/store-screenshots/android',
    // Makes src/platform/runtime.ts pick the Android wording (Google Drive, not iCloud).
    userAgent:
      'Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
  },
  ios: { width: 440, height: 956, scale: 3, outDir: 'docs/store-screenshots' },
};
const preset = PRESETS[target];
if (!preset) {
  console.error(`Unknown target "${target}". Use android or ios.`);
  process.exit(1);
}

const CREAM = '#FFF6EB';
const PORT = 4173;
const BASE = `http://localhost:${PORT}/`;

// ---- Sample data ---------------------------------------------------------------

const isoDate = (d) => d.toISOString().slice(0, 10);
const daysFromToday = (n) => {
  const d = new Date();
  d.setUTCHours(12, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + n);
  return isoDate(d);
};
const now = new Date().toISOString();
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const device = (n, fields) => ({ id: id(n), createdAt: now, updatedAt: now, ...fields });
const DEVICES = [
  device(1, {
    name: 'Dishwasher',
    room: 'Kitchen',
    brand: 'Bosch',
    model: 'SMS6HCI02A',
    purchaseDate: '2024-10-25',
    warrantyEndDate: daysFromToday(24),
  }),
  device(2, {
    name: 'Coffee machine',
    room: 'Kitchen',
    brand: 'Breville',
    model: 'BES870',
    purchaseDate: '2024-11-25',
    warrantyEndDate: daysFromToday(55),
  }),
  device(3, {
    name: 'Fridge',
    room: 'Kitchen',
    brand: 'Fisher & Paykel',
    model: 'RF522ADX5',
    purchaseDate: '2024-12-10',
    warrantyEndDate: daysFromToday(70),
  }),
  device(4, {
    name: 'Television',
    room: 'Living room',
    brand: 'LG',
    model: 'OLED55C3',
    purchaseDate: '2023-06-02',
    warrantyEndDate: daysFromToday(-123),
  }),
  device(5, {
    name: 'Air conditioner',
    room: 'Bedroom',
    brand: 'Daikin',
    model: 'FTXM35',
    purchaseDate: '2022-03-01',
    warrantyEndDate: '2027-03-01',
  }),
  device(6, { name: 'Lawn mower', room: 'Garage', brand: 'Honda', model: 'HRU196' }),
  device(7, {
    name: 'Washing machine',
    room: 'Laundry',
    brand: 'Miele',
    model: 'WED164',
    purchaseDate: '2025-03-12',
    warrantyEndDate: '2028-03-12',
  }),
];

function tinyPdf(text) {
  // A minimal single-page PDF with one line of text; pdf.js renders it fine.
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    null,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  const stream = `BT /F1 24 Tf 72 760 Td (${text}) Tj ET`;
  objects[3] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  let out = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((obj, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const o of offsets) out += `${String(o).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return strToU8(out);
}

async function tinyPhoto() {
  return new Uint8Array(
    await sharp({ create: { width: 8, height: 8, channels: 3, background: '#FFE9D6' } })
      .png()
      .toBuffer(),
  );
}

async function sampleBackupZip() {
  const manual = tinyPdf('Bosch dishwasher manual');
  const receipt = await tinyPhoto();
  const attachment = (n, deviceId, fields, bytes) => ({
    id: id(100 + n),
    deviceId,
    byteSize: bytes.length,
    createdAt: now,
    updatedAt: now,
    ...fields,
  });
  const attachments = [
    attachment(
      1,
      id(1),
      { kind: 'pdf', label: 'Manual', mimeType: 'application/pdf', ext: 'pdf' },
      manual,
    ),
    attachment(
      2,
      id(1),
      { kind: 'photo', label: 'Receipt', mimeType: 'image/png', ext: 'png' },
      receipt,
    ),
  ];
  const manifest = {
    format: 'homekind-backup',
    formatVersion: 1,
    exportedAt: now,
    appVersion: '1.0.0',
    devices: DEVICES,
    attachments,
  };
  return zipSync({
    'data.json': strToU8(JSON.stringify(manifest, null, 2)),
    [`attachments/${id(1)}/${id(101)}.pdf`]: manual,
    [`attachments/${id(1)}/${id(102)}.png`]: receipt,
  });
}

// ---- Rendering ----------------------------------------------------------------

function startPreview() {
  // Run Vite's own entry point rather than `npx vite`, so killing this process kills the server.
  const vite = path.join(root, 'node_modules/vite/bin/vite.js');
  const child = spawn(process.execPath, [vite, 'preview', '--port', String(PORT), '--strictPort'], {
    cwd: root,
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  return new Promise((resolve, reject) => {
    child.stdout.on('data', (chunk) => {
      if (String(chunk).includes(String(PORT))) resolve(child);
    });
    child.on('exit', (code) => reject(new Error(`vite preview exited with ${code}`)));
  });
}

async function settle(page) {
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => {
    const main = document.getElementById('main');
    if (main) main.scrollTop = 0;
  });
  await page.waitForTimeout(250);
}

async function shoot(page, outDir, name) {
  await settle(page);
  const file = path.join(outDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`wrote ${path.relative(root, file)}`);
}

async function renderScreens() {
  const outDir = path.join(root, preset.outDir);
  await mkdir(outDir, { recursive: true });
  const preview = await startPreview();
  const launch = process.env.HOMEKIND_CHROMIUM
    ? { executablePath: process.env.HOMEKIND_CHROMIUM }
    : { channel: 'chrome' };
  const browser = await chromium.launch({ ...launch, headless: true });
  try {
    const context = await browser.newContext({
      viewport: { width: preset.width, height: preset.height },
      deviceScaleFactor: preset.scale,
      isMobile: true,
      hasTouch: true,
      locale: 'en-AU',
      colorScheme: 'light',
      ...(preset.userAgent ? { userAgent: preset.userAgent } : {}),
    });
    const page = await context.newPage();

    // Welcome, exactly as a first launch shows it.
    await page.goto(`${BASE}#/welcome`);
    await page.getByRole('button', { name: 'Get started' }).waitFor();
    await shoot(page, outDir, '06-welcome');
    await page.getByRole('button', { name: 'Get started' }).click();

    // Seed through Settings > Choose backup file.
    await page.goto(`${BASE}#/settings`);
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Choose backup file' }).click();
    const zip = await sampleBackupZip();
    await (
      await chooser
    ).setFiles({
      name: 'homekind-backup-sample.zip',
      mimeType: 'application/zip',
      buffer: Buffer.from(zip),
    });
    await page.getByRole('dialog').getByRole('button', { name: 'Restore', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Done' }).click();

    await page.goto(`${BASE}#/`);
    await page.getByText('Dishwasher').waitFor();
    await shoot(page, outDir, '01-devices');

    await page.goto(`${BASE}#/devices/${id(1)}`);
    await page.getByText('Photos and documents').waitFor();
    await shoot(page, outDir, '02-device');

    await page.goto(`${BASE}#/warranties`);
    await page.getByRole('heading', { level: 1, name: 'Warranties' }).waitFor();
    await shoot(page, outDir, '03-warranties');

    await page.goto(`${BASE}#/devices/new`);
    await page.getByRole('heading', { level: 1 }).waitFor();
    await shoot(page, outDir, '04-add-device');

    await page.goto(`${BASE}#/settings`);
    await page.getByRole('heading', { level: 1, name: 'Settings' }).waitFor();
    await shoot(page, outDir, '05-settings');
  } finally {
    await browser.close();
    preview.kill();
  }
}

// ---- Play graphics ------------------------------------------------------------

async function renderPlayGraphics() {
  const outDir = path.join(root, preset.outDir);
  // 512x512 store icon: the same composite as the launcher icon, no transparency.
  const icon = path.join(outDir, 'icon-512.png');
  await sharp(path.join(root, 'resources/icon.png'))
    .resize(512, 512)
    .flatten({ background: CREAM })
    .png()
    .toFile(icon);
  console.log(`wrote ${path.relative(root, icon)}`);

  // 1024x500 feature graphic: the approved lockup centred on Cream, nothing redrawn.
  const lockup = await sharp(path.join(root, 'public/brand/homekind-logo.png'))
    .resize({ width: 640 })
    .png()
    .toBuffer();
  const meta = await sharp(lockup).metadata();
  const feature = path.join(outDir, 'feature-graphic.png');
  await sharp({ create: { width: 1024, height: 500, channels: 4, background: CREAM } })
    .composite([
      {
        input: lockup,
        left: Math.round((1024 - meta.width) / 2),
        top: Math.round((500 - meta.height) / 2),
      },
    ])
    .flatten({ background: CREAM })
    .png()
    .toFile(feature);
  console.log(`wrote ${path.relative(root, feature)}`);
}

await renderScreens();
if (target === 'android') await renderPlayGraphics();
