#!/usr/bin/env node
// Genera i PNG dell'icona PWA da public/icon.svg
// Uso: node scripts/build-icons.mjs

import sharp from "sharp";
import fs from "node:fs/promises";
import path from "node:path";

const SVG = path.resolve("public/icon.svg");
const PUBLIC = path.resolve("public");
const APP_DIR = path.resolve("app");

const TARGETS = [
  { size: 192, out: path.join(PUBLIC, "icon-192.png") },
  { size: 512, out: path.join(PUBLIC, "icon-512.png") },
  { size: 180, out: path.join(PUBLIC, "apple-icon.png") },
  { size: 32, out: path.join(PUBLIC, "favicon.ico") },       // PNG con estensione .ico (accettato dai browser moderni)
  { size: 32, out: path.join(APP_DIR, "favicon.ico") },
];

async function main() {
  const svg = await fs.readFile(SVG);
  for (const t of TARGETS) {
    await sharp(svg, { density: 384 })
      .resize(t.size, t.size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(t.out);
    console.log(`✓ ${path.relative(process.cwd(), t.out)} (${t.size}×${t.size})`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
