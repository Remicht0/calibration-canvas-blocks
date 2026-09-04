// MIRE — moteur de rendu 1-bit par blocs + dissolution par chute de blocs.
// Aucun filtre CSS, aucun SVG : seuillage binaire dur en canvas.

export type Bits = {
  cols: number;
  rows: number;
  /** 1 = encre (bloc plein), 0 = vide */
  data: Uint8Array;
};

export const cellSizeFor = (width: number) => (width < 768 ? 16 : 20);

/** Mouvement reduit demande par le systeme : tout se pose d'un coup, aucune chute. */
export const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Luminance relative 0..1 d'un pixel (Rec. 709), la seule mesure du seuil. */
export const luminance = (r: number, g: number, b: number) =>
  (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

/** Recadrage "cover" : la fenetre source qui remplit cols x rows sans deformation. */
export function coverCrop(nw: number, nh: number, cols: number, rows: number) {
  const ar = nw / nh;
  const target = cols / rows;
  let sw = nw;
  let sh = nh;
  if (ar > target) sw = nh * target;
  else sh = nw / target;
  return { sx: (nw - sw) / 2, sy: (nh - sh) / 2, sw, sh };
}

/**
 * Seuil dur sur un tampon RGBA de cols x rows : chaque cellule devient encre ou vide.
 * Aucune dependance au DOM : c'est le meme algorithme dans le navigateur et dans
 * l'export og:image (scripts/og.ts).
 */
export function bitsFromRGBA(
  px: ArrayLike<number>,
  cols: number,
  rows: number,
  threshold = 0.5,
): Bits {
  const data = new Uint8Array(cols * rows);
  for (let i = 0; i < cols * rows; i++) {
    const l = luminance(px[i * 4]!, px[i * 4 + 1]!, px[i * 4 + 2]!);
    data[i] = l < threshold ? 1 : 0;
  }
  return { cols, rows, data };
}

/**
 * Seuil d'Otsu : la coupure qui separe le mieux les cellules en deux classes
 * (encre / vide). Sert quand une image sombre ou claire ecraserait le seuil fixe.
 * Retour borne pour rester dans la plage de reglage du site.
 */
export function otsuThreshold(lum: ArrayLike<number>, min = 0.3, max = 0.6): number {
  const bins = 64;
  const hist = new Float64Array(bins);
  for (let i = 0; i < lum.length; i++) {
    const v = Math.min(bins - 1, Math.max(0, Math.floor(lum[i]! * bins)));
    hist[v] = hist[v]! + 1;
  }
  const total = lum.length || 1;
  let sum = 0;
  for (let b = 0; b < bins; b++) sum += b * hist[b]!;
  let wB = 0;
  let sumB = 0;
  let best = 0;
  let cut = Math.floor(((min + max) / 2) * bins);
  for (let b = 0; b < bins; b++) {
    wB += hist[b]!;
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += b * hist[b]!;
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > best) {
      best = between;
      cut = b;
    }
  }
  return Math.min(max, Math.max(min, (cut + 1) / bins));
}

/** Réduit une image en grille 1-bit : chaque cellule est noire pleine ou blanche pleine. */
export function blockifyImage(
  img: HTMLImageElement,
  cols: number,
  rows: number,
  threshold = 0.5,
): Bits {
  const off = document.createElement("canvas");
  off.width = cols;
  off.height = rows;
  const c = off.getContext("2d", { willReadFrequently: true })!;
  c.imageSmoothingEnabled = true;
  // recadrage "cover" : jamais de deformation
  const { sx, sy, sw, sh } = coverCrop(img.naturalWidth, img.naturalHeight, cols, rows);
  c.drawImage(img, sx, sy, sw, sh, 0, 0, cols, rows);
  return bitsFromRGBA(c.getImageData(0, 0, cols, rows).data, cols, rows, threshold);
}

/** Hauteur en px du texte compose pleine largeur (capitales, sans marge). */
export function textBlockHeight(text: string, font: string, widthPx: number): number {
  const c = document.createElement("canvas").getContext("2d")!;
  c.font = `100px ${font}`;
  const m = c.measureText(text);
  const size = (widthPx / Math.max(m.width, 1)) * 100;
  c.font = `${size}px ${font}`;
  const mm = c.measureText(text);
  return Math.max(1, mm.actualBoundingBoxAscent + mm.actualBoundingBoxDescent);
}

/** Rend un texte en grille 1-bit (seuillage sur l'alpha), compose pleine largeur. */
export function blockifyText(text: string, font: string, cols: number, rows: number): Bits {
  const scale = 6;
  const off = document.createElement("canvas");
  off.width = cols * scale;
  off.height = rows * scale;
  const c = off.getContext("2d", { willReadFrequently: true })!;
  c.fillStyle = "#000";
  c.textBaseline = "alphabetic";
  c.textAlign = "center";
  c.font = `100px ${font}`;
  const size = (off.width / Math.max(c.measureText(text).width, 1)) * 100;
  c.font = `${size}px ${font}`;
  const m = c.measureText(text);
  const h = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
  const baseline = (off.height - h) / 2 + m.actualBoundingBoxAscent;
  c.fillText(text, off.width / 2, baseline);

  const small = document.createElement("canvas");
  small.width = cols;
  small.height = rows;
  const s = small.getContext("2d", { willReadFrequently: true })!;
  s.imageSmoothingEnabled = true;
  s.drawImage(off, 0, 0, cols, rows);
  const px = s.getImageData(0, 0, cols, rows).data;
  const data = new Uint8Array(cols * rows);
  for (let i = 0; i < cols * rows; i++) data[i] = px[i * 4 + 3]! > 110 ? 1 : 0;
  return { cols, rows, data };
}

/**
 * Ordre de chute : les cellules du bas partent en premier, certaines colonnes
 * tiennent plus longtemps que les autres. Valeurs normalisées 0..1.
 */
export function fallOrder(cols: number, rows: number, seed = 1): Float32Array {
  let s = seed * 9301 + 49297;
  const rnd = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  const hold = new Float32Array(cols);
  for (let x = 0; x < cols; x++) hold[x] = Math.pow(rnd(), 3);
  const out = new Float32Array(cols * rows);
  let max = 0;
  for (let y = 0; y < rows; y++) {
    const vertical = rows > 1 ? 1 - y / (rows - 1) : 0;
    for (let x = 0; x < cols; x++) {
      const v = vertical * 0.6 + hold[x]! * 0.45 + rnd() * 0.22;
      out[y * cols + x] = v;
      if (v > max) max = v;
    }
  }
  for (let i = 0; i < out.length; i++) out[i] = out[i]! / (max || 1);
  return out;
}

export type DrawOpts = {
  cell: number;
  /** 0 = rien de posé, 1 = image complète */
  progress: number;
  /** true = blocs blancs sur fond noir */
  negative?: boolean;
};

/** Dessine la grille : les blocs se posent selon l'inverse de l'ordre de chute. */
export function drawBits(
  ctx: CanvasRenderingContext2D,
  bits: Bits,
  order: Float32Array,
  { cell, progress, negative = false }: DrawOpts,
) {
  const { cols, rows, data } = bits;
  ctx.fillStyle = negative ? "#000000" : "#FFFFFF";
  ctx.fillRect(0, 0, cols * cell, rows * cell);
  ctx.fillStyle = negative ? "#FFFFFF" : "#000000";
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = y * cols + x;
      if (!data[i]) continue;
      if (order[i]! > progress) continue;
      ctx.fillRect(x * cell, y * cell, cell, cell);
    }
  }
}
