// MIRE — noyau bitmap hybride.
// Une seule grille de blocs, trois lectures possibles de la meme source :
//   BIN  : seuil dur 1-bit (identite du site)
//   GRIS : quantification en N paliers (integration douce des photos)
//   BRUT : mosaique couleur, un bloc = un pixel (photo / video assumee)
// et, sur les planches de projet, une quatrieme a la demande du visiteur :
//   NET  : l'image d'origine, nette, dans ses couleurs, entiere dans le cadre

import { coverCrop, luminance } from "@/lib/mire";

/** Les trois lectures en blocs : les seules qu'une planche peut avoir par defaut. */
export type BitMode = "bin" | "gris" | "brut";

/** Lecture courante d'une planche : en blocs, ou NET (choisie par le visiteur, jamais par defaut). */
export type ReadMode = BitMode | "net";

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
// canvas de travail partage : une video est echantillonnee a chaque image,
// un canvas neuf par appel ferait tourner le ramasse-miettes en continu
let work: HTMLCanvasElement | null = null;

/**
 * Rend le bitmap du canvas de travail. La derniere trame echantillonnee y
 * reste sinon pour la duree de l'onglet : sur le miroir, c'est le visage du
 * visiteur, lisible par n'importe quel script de la page longtemps apres
 * « SOURCE FERMEE ». Mettre la largeur a 0 vide le backing store sans
 * detruire le canvas partage — sample() le redimensionne au prochain appel.
 */
export function releaseSampleBuffer() {
  if (!work) return;
  work.width = 0;
  work.height = 0;
}

export function sample(src: Source, cols: number, rows: number): Sampled | null {
  const { w: nw, h: nh } = srcSize(src);
  if (!nw || !nh) return null;
  const off = (work ??= document.createElement("canvas"));
  if (off.width !== cols) off.width = cols;
  if (off.height !== rows) off.height = rows;
  const c = off.getContext("2d", { willReadFrequently: true })!;
  c.clearRect(0, 0, cols, rows);
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
  /** loupe : cellule survolee + rayon en cellules (carre de Tchebychev), revele la matiere brute */
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
        // voisinage carre (distance de Tchebychev) : aucune courbe sur la mire
        const d = Math.max(Math.abs(x - lens.x), Math.abs(y - lens.y));
        if (d <= lens.r) local = "brut";
        else if (d <= lens.r + 1 && mode !== "brut") local = "gris";
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

/**
 * Taux d'encrage 0..1 de la planche entiere, dans le mode demande :
 * BIN = part des cellules encrees ; GRIS = noirceur moyenne des paliers ;
 * BRUT = noirceur moyenne de la matiere. C'est la mesure affichee sous la planche.
 */
export function inkRatio(
  s: Sampled,
  mode: BitMode,
  { threshold = 0.45, levels = 5, gamma = 0.85 }: Pick<PaintOpts, "threshold" | "levels" | "gamma">,
): number {
  const n = s.lum.length;
  if (!n) return 0;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const l = s.lum[i]!;
    if (mode === "bin") sum += l < threshold ? 1 : 0;
    else if (mode === "gris") sum += 1 - quantize(l, levels, gamma) / 255;
    else sum += 1 - l;
  }
  return sum / n;
}

/** Histogramme de luminance : part normalisee par tranche (somme = 1), meme parcours qu'inkRatio. */
export function histogram(s: Sampled, bins = 20): Float32Array {
  const h = new Float32Array(bins);
  const n = s.lum.length;
  if (!n) return h;
  for (let i = 0; i < n; i++) {
    const b = Math.min(bins - 1, Math.max(0, Math.floor(s.lum[i]! * bins)));
    h[b] = h[b]! + 1;
  }
  for (let b = 0; b < bins; b++) h[b] = h[b]! / n;
  return h;
}

/**
 * NET : l'image d'origine, nette et dans ses couleurs, entiere dans le cadre
 * (contenue, centree : rien de l'oeuvre n'est coupe ; marges papier dans la
 * page, encre sous le masque noir du plein cadre). Elle se
 * pose cellule par cellule dans l'ordre de chute des blocs, la dissolution
 * reste le seul mouvement. Le canvas est a la resolution de l'ecran (dpr) :
 * aucune cellule n'y est visible une fois la planche posee.
 */
export function paintNet(
  ctx: CanvasRenderingContext2D,
  src: Source,
  {
    cols,
    rows,
    cell,
    progress,
    order,
    ground = "#FFFFFF",
  }: {
    cols: number;
    rows: number;
    cell: number;
    progress: number;
    order: Float32Array;
    /** couleur des marges et des cellules pas encore tombees */
    ground?: string;
  },
) {
  const W = cols * cell;
  const H = rows * cell;
  ctx.fillStyle = ground;
  ctx.fillRect(0, 0, W, H);
  if (progress <= 0) return;
  const { w, h } = srcSize(src);
  if (!w || !h) return;
  const k = Math.min(W / w, H / h);
  const dw = w * k;
  const dh = h * k;
  ctx.save();
  if (progress < 1) {
    ctx.beginPath();
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < cols; x++)
        if (order[y * cols + x]! <= progress) ctx.rect(x * cell, y * cell, cell, cell);
    ctx.clip();
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, (W - dw) / 2, (H - dh) / 2, dw, dh);
  ctx.restore();
}

export const isVideo = (src: string) => /\.(mp4|webm|mov|m4v)(\?|$)/i.test(src);
