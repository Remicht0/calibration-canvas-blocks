/// <reference types="node" />
// MIRE — export des cartes de partage (og:image).
//
// Un PNG 1-bit de 1200 x 630 par projet, plus la carte du studio, generes depuis
// la planche de chaque projet avec le noyau du site (src/lib/mire.ts : recadrage
// cover + seuil dur) et la fonte bitmap 3x5 (src/lib/glyphs.ts). Aucun navigateur,
// aucun filtre : decodage JPEG en pur JS, moyenne par bloc, seuillage, puis un PNG
// a 1 bit par pixel ecrit a la main (zlib de Node). Sortie : public/og/*.png.
//
//   bun run og

import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";
import { decode } from "jpeg-js";
import { projects, type Project } from "../src/lib/projects";
import { bitsFromRGBA, coverCrop, luminance, otsuThreshold, type Bits } from "../src/lib/mire";
import { drawText, mireText, textCols } from "../src/lib/glyphs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public", "og");

/* ---- format de la carte : 1200 x 630, pas de grille 30 px (40 x 21 cellules) ---- */
const W = 1200;
const H = 630;
const CELL = 30;
/** pas de la planche : la densite du site en bureau (72 colonnes a 1440 px) */
const IMG_CELL = 15;
/** unites de la fonte 3x5 : fractions entieres du pas de grille, comme les afficheurs du site */
const U_TITLE = CELL / 2; // 15
const U_LABEL = CELL / 3; // 10
const U_SMALL = CELL / 5; // 6

/* ---- trame 1 bit : 1 = encre ---- */
class Raster {
  ink: Uint8Array;
  fillStyle = "#000000";
  constructor(
    public w = W,
    public h = H,
  ) {
    this.ink = new Uint8Array(w * h);
  }
  fillRect(x: number, y: number, w: number, h: number) {
    const v = this.fillStyle.toUpperCase() === "#FFFFFF" ? 0 : 1;
    const x0 = Math.max(0, Math.round(x));
    const y0 = Math.max(0, Math.round(y));
    const x1 = Math.min(this.w, Math.round(x + w));
    const y1 = Math.min(this.h, Math.round(y + h));
    for (let yy = y0; yy < y1; yy++) this.ink.fill(v, yy * this.w + x0, yy * this.w + x1);
  }
}
// drawText n'utilise que fillStyle / fillRect : la trame tient lieu de contexte 2D.
const asCtx = (r: Raster) => r as unknown as CanvasRenderingContext2D;

/* ---- echantillonnage : JPEG -> cols x rows, recadrage cover, moyenne par bloc ---- */
function sampleJpeg(file: string, cols: number, rows: number): Uint8ClampedArray {
  const { width, height, data } = decode(readFileSync(file), { useTArray: true });
  const { sx, sy, sw, sh } = coverCrop(width, height, cols, rows);
  const out = new Uint8ClampedArray(cols * rows * 4);
  for (let cy = 0; cy < rows; cy++) {
    const y0 = Math.floor(sy + (cy / rows) * sh);
    const y1 = Math.max(y0 + 1, Math.floor(sy + ((cy + 1) / rows) * sh));
    for (let cx = 0; cx < cols; cx++) {
      const x0 = Math.floor(sx + (cx / cols) * sw);
      const x1 = Math.max(x0 + 1, Math.floor(sx + ((cx + 1) / cols) * sw));
      let r = 0;
      let g = 0;
      let b = 0;
      let n = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = (y * width + x) * 4;
          r += data[i]!;
          g += data[i + 1]!;
          b += data[i + 2]!;
          n++;
        }
      }
      const o = (cy * cols + cx) * 4;
      out[o] = r / n;
      out[o + 1] = g / n;
      out[o + 2] = b / n;
      out[o + 3] = 255;
    }
  }
  return out;
}

function blit(r: Raster, bits: Bits, ox: number, oy: number, cell: number) {
  r.fillStyle = "#000000";
  for (let y = 0; y < bits.rows; y++)
    for (let x = 0; x < bits.cols; x++)
      if (bits.data[y * bits.cols + x]) r.fillRect(ox + x * cell, oy + y * cell, cell, cell);
}

/* ---- composition du texte : cesure aux espaces, jamais dans un mot ---- */
function wrap(text: string, maxCols: number): string[] | null {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    if (textCols(word) > maxCols) return null;
    const next = line ? `${line} ${word}` : word;
    if (textCols(next) <= maxCols) line = next;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

const clip = (text: string, maxCols: number) => {
  const max = Math.floor((maxCols + 1) / 4);
  return text.length <= max ? text : text.slice(0, Math.max(0, max - 1)).trimEnd() + ".";
};

/* ---- carte projet : planche 34 x 42 a gauche (510 x 630), fiche a droite ---- */
function projectCard(p: Project): { raster: Raster; threshold: number } {
  const r = new Raster();
  const IMG_COLS = 510 / IMG_CELL; // 34
  const IMG_ROWS = H / IMG_CELL; // 42
  const px = sampleJpeg(p.image, IMG_COLS, IMG_ROWS);
  // seuil d'Otsu borne : une photo sombre ne devient pas un aplat noir
  const lum = new Float32Array(IMG_COLS * IMG_ROWS);
  for (let i = 0; i < lum.length; i++)
    lum[i] = luminance(px[i * 4]!, px[i * 4 + 1]!, px[i * 4 + 2]!);
  const threshold = otsuThreshold(lum);
  blit(r, bitsFromRGBA(px, IMG_COLS, IMG_ROWS, threshold), 0, 0, IMG_CELL);

  const x = IMG_COLS * IMG_CELL + CELL; // 540
  const maxW = W - x - CELL; // 630
  r.fillStyle = "#000000";

  // en-tete : MIRE a gauche, numero / annee a droite
  drawText(asCtx(r), "MIRE", U_LABEL, x, CELL);
  const ref = mireText(`${p.num} / ${p.year}`);
  drawText(asCtx(r), ref, U_LABEL, W - CELL - textCols(ref) * U_LABEL, CELL);

  // titre : grand si chaque mot tient, sinon un cran en dessous
  const title = mireText(p.title);
  let unit = U_TITLE;
  let lines = wrap(title, Math.floor(maxW / unit));
  if (!lines) {
    unit = U_LABEL;
    lines = wrap(title, Math.floor(maxW / unit)) ?? [clip(title, Math.floor(maxW / unit))];
  }
  let y = CELL * 4; // 120
  const yMax = H - CELL * 3;
  for (const l of lines) {
    if (y + 5 * unit > yMax) break;
    drawText(asCtx(r), l, unit, x, y);
    y += 6 * unit;
  }

  // pied : nature du projet
  const nature = clip(mireText(p.nature), Math.floor(maxW / U_SMALL));
  drawText(asCtx(r), nature, U_SMALL, x, H - CELL - 5 * U_SMALL);
  return { raster: r, threshold };
}

/* ---- carte du studio : bande de calibration + MIRE en blocs ---- */
function studioCard(): Raster {
  const r = new Raster();
  const cols = W / CELL;
  const rows = 6;
  let s = 2 * 104729;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280), s / 233280);
  r.fillStyle = "#000000";
  for (let x = 0; x < cols; x++) {
    // meme loi que CalibrationBand (bars.tsx) a t = 0 : hauteur quantifiee, seuil dur
    const phase = rnd() * Math.PI * 2;
    const width = 0.4 + rnd() * 1.4;
    const v = (Math.sin(phase * width) + 1) / 2;
    const h = Math.max(1, Math.round(v * rows));
    r.fillRect(x * CELL, (rows - h) * CELL, CELL, h * CELL);
  }
  const unit = CELL * 2; // 60 : un glyphe = 3 x 5 cellules de 2 x 2
  const word = "MIRE";
  const x = Math.round((W - textCols(word) * unit) / 2 / CELL) * CELL;
  drawText(asCtx(r), word, unit, x, CELL * 8);
  drawText(asCtx(r), "STUDIO DE DESIGN GRAPHIQUE", U_LABEL, x, H - CELL * 2 - U_LABEL);
  return r;
}

/* ---- PNG 1 bit (niveaux de gris, profondeur 1) ---- */
const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf: Uint8Array) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const u32 = (n: number) => {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n >>> 0);
  return b;
};
const chunk = (type: string, data: Uint8Array) => {
  const t = Buffer.from(type, "ascii");
  return Buffer.concat([u32(data.length), t, data, u32(crc32(Buffer.concat([t, data])))]);
};

function png1bit(r: Raster): Buffer {
  const { w, h } = r;
  const stride = Math.ceil(w / 8);
  const raw = new Uint8Array((stride + 1) * h); // filtre 0 en tete de ligne
  for (let y = 0; y < h; y++) {
    const row = y * (stride + 1) + 1;
    for (let x = 0; x < w; x++) {
      // profondeur 1 : bit a 1 = blanc, bit a 0 = noir
      if (!r.ink[y * w + x]) raw[row + (x >> 3)]! |= 0x80 >> (x & 7);
    }
  }
  const ihdr = Buffer.concat([u32(w), u32(h), Buffer.from([1, 0, 0, 0, 0])]);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", new Uint8Array(0)),
  ]);
}

/* ---- ICO : un conteneur autour du PNG 32 px (favicon.ico de secours) ---- */
function ico(png: Buffer, size: number): Buffer {
  const head = Buffer.alloc(6 + 16);
  head.writeUInt16LE(0, 0); // reserve
  head.writeUInt16LE(1, 2); // type : icone
  head.writeUInt16LE(1, 4); // une image
  head[6] = size;
  head[7] = size;
  head[8] = 0; // palette
  head[9] = 0;
  head.writeUInt16LE(1, 10); // plans
  head.writeUInt16LE(1, 12); // bits par pixel
  head.writeUInt32LE(png.length, 14);
  head.writeUInt32LE(22, 18); // decalage de l'image
  return Buffer.concat([head, png]);
}

/* ---- icone : un M en 5 x 5 blocs, blanc sur noir, centre sur une grille de 8 ---- */
// A 3 colonnes le M de la fonte se lit comme un H une fois agrandi ; l'icone
// a son propre M, a 5 colonnes, dessine bloc par bloc comme le reste.
const ICON_M = ["10001", "11011", "10101", "10001", "10001"];

function icon(size: number): Raster {
  const r = new Raster(size, size);
  r.fillStyle = "#000000";
  r.fillRect(0, 0, size, size);
  const unit = Math.floor(size / 8); // le glyphe occupe 5 x 5 unites sur 8 x 8
  const ox = Math.round((size - 5 * unit) / 2);
  const oy = Math.round((size - 5 * unit) / 2);
  r.fillStyle = "#FFFFFF";
  for (let y = 0; y < 5; y++)
    for (let x = 0; x < 5; x++)
      if (ICON_M[y]![x] === "1") r.fillRect(ox + x * unit, oy + y * unit, unit, unit);
  return r;
}

function faviconSvg(): string {
  // 16 x 16, unite 2 : le meme M, en rectangles pleins, sans anti-aliasing
  const rects: string[] = [];
  for (let y = 0; y < 5; y++)
    for (let x = 0; x < 5; x++)
      if (ICON_M[y]![x] === "1")
        rects.push(`<rect x="${3 + x * 2}" y="${3 + y * 2}" width="2" height="2" fill="#FFFFFF"/>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges"><rect width="16" height="16" fill="#000000"/>${rects.join("")}</svg>\n`;
}

/* ---- export ---- */
mkdirSync(OUT, { recursive: true });
const ICONS = join(ROOT, "public", "icons");
mkdirSync(ICONS, { recursive: true });
const write = (name: string, r: Raster, note = "") => {
  const file = join(OUT, `${name}.png`);
  writeFileSync(file, png1bit(r));
  const ink = r.ink.reduce((a, b) => a + b, 0);
  const pct = String(Math.round((ink / (W * H)) * 100)).padStart(2);
  console.log(
    `${name.padEnd(12)} ${W}x${H} 1-bit  ${String(statSync(file).size).padStart(6)} o  encre ${pct} %  ${note}`,
  );
};
write("mire", studioCard());
for (const p of projects) {
  const { raster, threshold } = projectCard(p);
  write(p.slug, raster, `seuil ${threshold.toFixed(2)}`);
}

// icones : PWA, ecran d'accueil iOS, favicon PNG-dans-ICO et SVG
for (const [name, size] of [
  ["icon-192", 192],
  ["icon-512", 512],
  ["apple-touch-icon", 180],
] as const) {
  writeFileSync(join(ICONS, `${name}.png`), png1bit(icon(size)));
  console.log(`${name.padEnd(17)} ${size}x${size} 1-bit`);
}
writeFileSync(join(ROOT, "public", "favicon.ico"), ico(png1bit(icon(32)), 32));
writeFileSync(join(ROOT, "public", "favicon.svg"), faviconSvg());
console.log("favicon.ico 32x32 (PNG 1-bit) + favicon.svg");
