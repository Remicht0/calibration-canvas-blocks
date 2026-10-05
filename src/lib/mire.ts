// MIRE — moteur de rendu 1-bit par blocs + dissolution par chute de blocs.
// Aucun filtre CSS, aucun SVG : seuillage binaire dur en canvas.

export type Bits = {
  cols: number;
  rows: number;
  /** 1 = encre (bloc plein), 0 = vide */
  data: Uint8Array;
};

export const cellSizeFor = (width: number) => (width < 768 ? 16 : 20);

/** Pas de la fonte 3x5 en etiquette : un glyphe fait une cellule de haut (4 px bureau, 3 px mobile). */
export const bitUnit = (cell: number) => Math.round(cell / 5);

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

/**
 * Titre en blocs : sous ce nombre de colonnes par caractere, une lettre n'a plus
 * assez de cellules pour se lire (CARTE POSTALE en 393 px : moins de 2).
 */
export const TITLE_MIN_COLS = 3;
/** Interligne d'un titre sur plusieurs lignes : une rangee vide. */
const TITLE_GAP = 1;

/**
 * Decoupe d'un titre pour cols colonnes. Une seule ligne tant que chaque
 * caractere garde TITLE_MIN_COLS colonnes ; sinon des lignes d'au plus
 * cols / TITLE_MIN_COLS caracteres, coupees entre les mots, jamais dans un mot :
 * un mot seul trop long garde sa ligne.
 */
export function titleLines(text: string, cols: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length < 2 || cols / text.length >= TITLE_MIN_COLS) return [text];
  const max = Math.max(1, Math.floor(cols / TITLE_MIN_COLS));
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    if (line && line.length + 1 + w.length > max) {
      lines.push(line);
      line = w;
    } else line = line ? `${line} ${w}` : w;
  }
  lines.push(line);
  return lines;
}

type TitleLayout = {
  /** corps de la fonte, en px pour une cellule de 1 px */
  size: number;
  /** rangee de depart et hauteur (rangees) de chaque ligne */
  bands: { y: number; h: number }[];
  rows: number;
};

/**
 * Titre sur plusieurs lignes : un seul corps, celui qui fait tenir la ligne la
 * plus large sur cols colonnes ; chaque ligne occupe un nombre entier de
 * rangees, separees par TITLE_GAP. Hauteur = somme des lignes, sur la grille.
 */
function layoutTitle(
  c: CanvasRenderingContext2D,
  lines: string[],
  font: string,
  cols: number,
): TitleLayout {
  c.font = `100px ${font}`;
  const ms = lines.map((l) => c.measureText(l));
  const k = cols / Math.max(1, ...ms.map((m) => m.width));
  let y = 0;
  const bands = ms.map((m) => {
    const h = Math.max(1, Math.round((m.actualBoundingBoxAscent + m.actualBoundingBoxDescent) * k));
    const band = { y, h };
    y += h + TITLE_GAP;
    return band;
  });
  return { size: 100 * k, bands, rows: y - TITLE_GAP };
}

/**
 * Hauteur en px du texte compose pleine largeur (capitales, sans marge). Sous
 * TITLE_MIN_COLS colonnes par caractere, la hauteur des lignes empilees, calee
 * sur la grille ; `cell` est la cellule du site (celle de l'ecran par defaut).
 */
export function textBlockHeight(
  text: string,
  font: string,
  widthPx: number,
  cell = cellSizeFor(window.innerWidth),
): number {
  const c = document.createElement("canvas").getContext("2d")!;
  const cols = Math.max(1, Math.round(widthPx / cell));
  const lines = titleLines(text, cols);
  if (lines.length > 1) return layoutTitle(c, lines, font, cols).rows * cell;
  c.font = `100px ${font}`;
  const m = c.measureText(text);
  const size = (widthPx / Math.max(m.width, 1)) * 100;
  c.font = `${size}px ${font}`;
  const mm = c.measureText(text);
  return Math.max(1, mm.actualBoundingBoxAscent + mm.actualBoundingBoxDescent);
}

/**
 * Rend un texte en grille 1-bit (seuillage sur l'alpha), compose pleine largeur.
 * Sous TITLE_MIN_COLS colonnes par caractere, il passe sur plusieurs lignes
 * (titleLines), alignees selon `align` ; si rows ne suffit pas, le bloc est
 * reduit et centre plutot que coupe.
 */
export function blockifyText(
  text: string,
  font: string,
  cols: number,
  rows: number,
  align: "center" | "left" = "center",
): Bits {
  const scale = 6;
  const off = document.createElement("canvas");
  off.width = cols * scale;
  off.height = rows * scale;
  const c = off.getContext("2d", { willReadFrequently: true })!;
  c.fillStyle = "#000";
  c.textBaseline = "alphabetic";
  const lines = titleLines(text, cols);
  if (lines.length > 1) {
    const lay = layoutTitle(c, lines, font, cols);
    const f = Math.min(1, rows / lay.rows);
    const x0 = ((cols - cols * f) / 2) * scale;
    const y0 = ((rows - lay.rows * f) / 2) * scale;
    c.textAlign = align;
    c.font = `${lay.size * f * scale}px ${font}`;
    lines.forEach((l, i) => {
      const m = c.measureText(l);
      const b = lay.bands[i]!;
      const h = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
      const top = y0 + b.y * f * scale;
      const baseline = top + (b.h * f * scale - h) / 2 + m.actualBoundingBoxAscent;
      c.fillText(l, align === "left" ? x0 : off.width / 2, baseline);
    });
  } else {
    c.textAlign = "center";
    c.font = `100px ${font}`;
    const size = (off.width / Math.max(c.measureText(text).width, 1)) * 100;
    c.font = `${size}px ${font}`;
    const m = c.measureText(text);
    const h = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
    const baseline = (off.height - h) / 2 + m.actualBoundingBoxAscent;
    c.fillText(text, off.width / 2, baseline);
  }

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

/**
 * Position de la ligne rouge (ScanLine) : 4 cellules du haut en tete de page,
 * 4 cellules du bas en fin de page, toujours calee sur le pas de grille.
 */
export function scanLineTop(
  cell: number,
  scrollY: number,
  innerHeight: number,
  scrollHeight: number,
): number {
  const max = scrollHeight - innerHeight;
  const p = max > 0 ? Math.min(1, scrollY / max) : 0;
  const span = innerHeight - cell * 8;
  return Math.round((cell * 4 + p * span) / cell) * cell;
}

/**
 * Usure sous le curseur : un voisinage CARRE de rayon r (jamais un disque),
 * les cellules a ordre de chute eleve (le bas des lettres) cedent d'abord.
 */
export function erode(
  wear: Float32Array,
  order: Float32Array,
  cols: number,
  rows: number,
  cx: number,
  cy: number,
  r: number,
  step: number,
): boolean {
  let changed = false;
  for (let y = Math.max(0, cy - r); y <= Math.min(rows - 1, cy + r); y++) {
    for (let x = Math.max(0, cx - r); x <= Math.min(cols - 1, cx + r); x++) {
      const i = y * cols + x;
      const next = Math.min(1, wear[i]! + step * (0.5 + order[i]!));
      if (next !== wear[i]) {
        wear[i] = next;
        changed = true;
      }
    }
  }
  return changed;
}

/** Guerison par ordre de chute : a k = 1, plus aucune usure. */
export function heal(wear: Float32Array, order: Float32Array, k: number) {
  for (let i = 0; i < wear.length; i++) if (order[i]! <= k) wear[i] = 0;
}

export type DrawOpts = {
  cell: number;
  /** 0 = rien de posé, 1 = image complète ; un tableau = un progress par rangée */
  progress: number | Float32Array;
  /** true = blocs blancs sur fond noir */
  negative?: boolean;
  /** usure par cellule 0..1 : a 1, le bloc est parti (erosion sous le curseur) */
  wear?: Float32Array;
};

/** Dessine la grille : les blocs se posent selon l'inverse de l'ordre de chute. */
export function drawBits(
  ctx: CanvasRenderingContext2D,
  bits: Bits,
  order: Float32Array,
  { cell, progress, negative = false, wear }: DrawOpts,
) {
  const { cols, rows, data } = bits;
  ctx.fillStyle = negative ? "#000000" : "#FFFFFF";
  ctx.fillRect(0, 0, cols * cell, rows * cell);
  ctx.fillStyle = negative ? "#FFFFFF" : "#000000";
  for (let y = 0; y < rows; y++) {
    const p = typeof progress === "number" ? progress : progress[y]!;
    for (let x = 0; x < cols; x++) {
      const i = y * cols + x;
      if (!data[i]) continue;
      if (order[i]! > p) continue;
      if (wear && wear[i]! >= 1) continue;
      ctx.fillRect(x * cell, y * cell, cell, cell);
    }
  }
}
