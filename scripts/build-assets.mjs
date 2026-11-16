// Regenerates web/assets: logo and favicon set, social sharing card, and the product screenshot used on the
// home page (taken from the seeded demonstration data). Requires Playwright with Chromium installed:
//   node scripts/build-assets.mjs
/* global Image, document -- used inside page.evaluate(), which runs in the browser */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'web/assets');
fs.mkdirSync(out, { recursive: true });
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const MARK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
<rect width="64" height="64" rx="14" fill="#172554"/>
<path d="M32 10 L50 17 V31 C50 42.5 42.5 50.5 32 54.5 C21.5 50.5 14 42.5 14 31 V17 Z" fill="none" stroke="#fff" stroke-width="4" stroke-linejoin="round"/>
<path d="M23.5 32 L29.5 38 L41 26" fill="none" stroke="#fff" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
`;
fs.writeFileSync(path.join(out, 'logo.svg'), MARK);
fs.writeFileSync(path.join(out, 'favicon.svg'), MARK);

const browser = await chromium.launch();
const page = await browser.newPage();

async function renderPng(html, width, height, file) {
  await page.setViewportSize({ width, height });
  await page.setContent(`<!doctype html><html><head><style>html,body{margin:0;padding:0;width:${width}px;height:${height}px;overflow:hidden}</style></head><body>${html}</body></html>`);
  const buf = await page.screenshot({ type: 'png', omitBackground: true });
  if (file) fs.writeFileSync(path.join(out, file), buf);
  return buf;
}
const icon = (size, radius = true) => MARK.replace('rx="14"', radius ? 'rx="14"' : 'rx="0"').replace('<svg ', `<svg width="${size}" height="${size}" `);

const png16 = await renderPng(icon(16), 16, 16, null);
const png32 = await renderPng(icon(32), 32, 32, null);
await renderPng(icon(180, false), 180, 180, 'apple-touch-icon.png');
await renderPng(icon(192), 192, 192, 'icon-192.png');
await renderPng(icon(512), 512, 512, 'logo-512.png');

// favicon.ico containing PNG-encoded 16x16 and 32x32 images.
const images = [[16, png16], [32, png32]];
const header = Buffer.alloc(6); header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(images.length, 4);
let offset = 6 + 16 * images.length;
const dir = images.map(([size, buf]) => {
  const e = Buffer.alloc(16);
  e.writeUInt8(size, 0); e.writeUInt8(size, 1); e.writeUInt8(0, 2); e.writeUInt8(0, 3);
  e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6); e.writeUInt32LE(buf.length, 8); e.writeUInt32LE(offset, 12);
  offset += buf.length;
  return e;
});
fs.writeFileSync(path.join(out, 'favicon.ico'), Buffer.concat([header, ...dir, ...images.map(([, b]) => b)]));

// Social sharing card (1200x630).
await renderPng(`<div style="width:1200px;height:630px;background:#172554;color:#fff;font-family:Inter,system-ui,-apple-system,'Segoe UI',sans-serif;display:flex;flex-direction:column;justify-content:center;padding:0 90px;box-sizing:border-box">
  <div style="display:flex;align-items:center;gap:22px;margin-bottom:44px">${icon(88)}<span style="font-size:34px;font-weight:700;letter-spacing:.01em">DPA Zambia</span></div>
  <div style="font-size:64px;font-weight:800;line-height:1.1;letter-spacing:-.02em;max-width:980px">Data protection compliance for organisations in Zambia</div>
  <div style="font-size:30px;line-height:1.4;margin-top:30px;color:#c7d2fe;max-width:960px">Assess, evidence and manage compliance with the Data Protection Act No. 3 of 2021.</div>
</div>`, 1200, 630, 'og-image.png');

// Product screenshot from the seeded demonstration data.
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zcip-assets-'));
const env = { ...process.env, DATA_DIR: dataDir, PORT: '3977', HOST: '127.0.0.1', DEMO_PASSWORD: 'Screenshot-2026-only' };
execFileSync(process.execPath, ['--disable-warning=ExperimentalWarning', path.join(root, 'scripts/seed-demo.js')], { env, stdio: 'ignore' });
const server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', path.join(root, 'server/index.js')], { env, stdio: 'ignore' });
try {
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch('http://127.0.0.1:3977/api/health')).ok) break; } catch { /* starting */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: 'light' });
  const app = await ctx.newPage();
  await app.goto('http://127.0.0.1:3977/app');
  await app.fill('#l-email', 'owner@acme.example');
  await app.fill('#l-pw', env.DEMO_PASSWORD);
  await app.click('form[data-form="login"] button');
  await app.waitForSelector('.circle');
  const png = await app.screenshot({ type: 'png' });
  await ctx.close();
  // Encode JPEG and WebP at two widths using the browser's canvas encoder.
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.setContent('<!doctype html><html><body></body></html>');
  const encoded = await page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const outs = {};
    for (const w of [1280, 640]) {
      const c = document.createElement('canvas');
      c.width = w; c.height = Math.round((img.height * w) / img.width);
      const g = c.getContext('2d');
      g.imageSmoothingQuality = 'high';
      g.drawImage(img, 0, 0, c.width, c.height);
      outs[`dashboard-${w}.jpg`] = c.toDataURL('image/jpeg', 0.82).split(',')[1];
      outs[`dashboard-${w}.webp`] = c.toDataURL('image/webp', 0.8).split(',')[1];
    }
    return outs;
  }, png.toString('base64'));
  for (const [name, b64] of Object.entries(encoded)) fs.writeFileSync(path.join(out, name), Buffer.from(b64, 'base64'));
} finally {
  server.kill();
  await browser.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
}
for (const f of fs.readdirSync(out).sort()) console.log(`${f.padEnd(24)} ${fs.statSync(path.join(out, f)).size} bytes`);
