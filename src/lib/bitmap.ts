// MIRE — noyau bitmap hybride.
// Une seule grille de blocs, trois lectures possibles de la meme source :
//   BIN  : seuil dur 1-bit (identite du site)
//   GRIS : quantification en N paliers (integration douce des photos)
//   BRUT : mosaique couleur, un bloc = un pixel (photo / video assumee)

import { coverCrop, luminance } from "@/lib/mire";

export type BitMode = "bin" | "gris" | "brut";

export type Sampled = {
  cols: number;
  rows: number;
  /** RGB par cellule, longueur cols*rows*3 */
  rgb: Uint8ClampedArray;
  /** luminance 0..1 par cellule */
  lum: Float32Array;
};

export type Source = HTMLImageElement | HTMLVideoElement;

const srcSize = (src: Source) =>
  src instanceof HTMLVideoElement
    ? { w: src.videoWidth, h: src.videoHeight }
    : { w: src.naturalWidth, h: src.naturalHeight };

export const isReady = (src: Source) => {
  const { w, h } = srcSize(src);
  return w > 0 && h > 0;
};

/** Reduit une source (image ou video) a une grille cols x rows, recadrage cover. */
export function sample(src: Source, cols: number, rows: number): Sampled | null {
  const { w: nw, h: nh } = srcSize(src);
  if (!nw || !nh) return null;
  const off = document.createElement("canvas");
  off.width = cols;
  off.height = rows;
  const c = off.getContext("2d", { willReadFrequently: true })!;
  c.imageSmoothingEnabled = true;
  const { sx, sy, sw, sh } = coverCrop(nw, nh, cols, rows);
  c.drawImage(src, sx, sy, sw, sh, 0, 0, cols, rows);
  const px = c.getImageData(0, 0, cols, rows).data;
  const n = cols * rows;
  const rgb = new Uint8ClampedArray(n * 3);
  const lum = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const r = px[i * 4]!;
    const g = px[i * 4 + 1]!;
    const b = px[i * 4 + 2]!;
    rgb[i * 3] = r;
    rgb[i * 3 + 1] = g;
    rgb[i * 3 + 2] = b;
    lum[i] = luminance(r, g, b);
  }
  return { cols, rows, rgb, lum };
}

/** Palier de gris quantifie (aucun degrade a l'interieur d'un bloc). */
function quantize(l: number, levels: number, gamma: number) {
  const v = Math.pow(Math.min(1, Math.max(0, l)), gamma);
  const step = Math.round(v * (levels - 1)) / (levels - 1);
  return Math.round(step * 255);
}

export type PaintOpts = {
  cell: number;
  mode: BitMode;
  /** 0..1 — composition par chute de blocs */
  progress: number;
  order: Float32Array;
  threshold?: number;
  /** nombre de paliers en mode GRIS */
  levels?: number;
  /** relevement des noirs : baisse le contraste percu */
  gamma?: number;
  negative?: boolean;
  /** loupe : cellule survolee + rayon en cellules, revele la matiere brute */
  lens?: { x: number; y: number; r: number } | null;
};

/** Peint la grille de blocs. Un seul remplissage par cellule, aucun anti-aliasing. */
export function paintBlocks(
  ctx: CanvasRenderingContext2D,
  s: Sampled,
  {
    cell,
    mode,
    progress,
    order,
    threshold = 0.45,
    levels = 5,
    gamma = 0.85,
    negative = false,
    lens = null,
  }: PaintOpts,
) {
  const { cols, rows, rgb, lum } = s;
  ctx.fillStyle = negative ? "#000000" : "#FFFFFF";
  ctx.fillRect(0, 0, cols * cell, rows * cell);

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = y * cols + x;
      if (order[i]! > progress) continue;

      let local: BitMode = mode;
      if (lens) {
        const d = Math.hypot(x - lens.x, y - lens.y);
        if (d <= lens.r) local = "brut";
        else if (d <= lens.r + 1.6 && mode !== "brut") local = "gris";
      }

      if (local === "brut") {
        ctx.fillStyle = `rgb(${rgb[i * 3]},${rgb[i * 3 + 1]},${rgb[i * 3 + 2]})`;
      } else if (local === "gris") {
        const g = quantize(negative ? 1 - lum[i]! : lum[i]!, levels, gamma);
        ctx.fillStyle = `rgb(${g},${g},${g})`;
      } else {
        const ink = negative ? lum[i]! >= threshold : lum[i]! < threshold;
        if (!ink) continue;
        ctx.fillStyle = negative ? "#FFFFFF" : "#000000";
      }
      ctx.fillRect(x * cell, y * cell, cell, cell);
    }
  }
}

export const isVideo = (src: string) => /\.(mp4|webm|mov|m4v)(\?|$)/i.test(src);
