// MIRE — carte d'encre de l'ecran : une valeur par cellule de grille, relevee sur
// la page telle qu'elle est composee a cet instant. Elle sert de matiere a la
// chute de la transition de page : ce que le visiteur regardait est ce qui tombe.
//
// Deux sources, parcourues dans l'ordre du document (donc parents avant enfants) :
//  - les canvas deja presents, redessines a l'echelle de la grille — ils portent
//    deja les bits (planches, titres en blocs, bandes de calibration) ;
//  - les surfaces du DOM dont le fond ou le filet resolus sont sombres (sections
//    `.on-black`, filets de separation, blocs en etat inverse).
// Tout le reste est du papier. Aucun rendu n'en depend : en cas d'echec la
// transition retombe sur son motif de recouvrement.

import { bitsFromRGBA, luminance } from "./mire";

/**
 * Elements susceptibles de porter une surface d'encre a l'echelle de la cellule.
 * Liste bornee : la capture a lieu au clic, elle ne peut pas parcourir tout le DOM.
 */
const SURFACES =
  "canvas,main,section,header,footer,nav,aside,article,[class*='bg-'],[class*='border-'],.u-bloc";

/**
 * Un filet plus fin qu'une cellule mais franc se cale sur la grille plutot que
 * de disparaitre au seuil. Le site n'a que deux filets (DESIGN.md section 1) :
 * `border-[10px]` en macro et `border-[3px]` en cadre — les deux passent ici.
 */
const SNAP = 3;

/** Canvas de travail hors DOM, reutilise d'une capture a l'autre (budget de rendu). */
let scratch: HTMLCanvasElement | null = null;

/** Luminance 0..1 d'une couleur calculee, ou null si elle est transparente ou illisible. */
function tone(color: string): number | null {
  const m = /^rgba?\(([^)]+)\)/.exec(color);
  if (!m) return null;
  const p = m[1]!
    .split(/[\s,/]+/)
    .filter(Boolean)
    .map((v) => parseFloat(v));
  if (p.length < 3 || p.some((v) => Number.isNaN(v))) return null;
  if (p.length > 3 && p[3]! < 0.5) return null;
  return luminance(p[0]!, p[1]!, p[2]!);
}

/**
 * Releve la carte d'encre du viewport sur une grille cols x rows au pas `cell`.
 * Retourne null si la page n'offre aucune surface lisible, ou si un tampon
 * illisible fait echouer la lecture : l'appelant doit alors se replier.
 */
export function captureInk(cell: number, cols: number, rows: number): Uint8Array | null {
  if (typeof document === "undefined" || cols < 1 || rows < 1) return null;
  try {
    const cv = (scratch ??= document.createElement("canvas"));
    if (cv.width !== cols || cv.height !== rows) {
      cv.width = cols;
      cv.height = rows;
    }
    const ctx = cv.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, cols, rows);
    // une unite du tampon = une cellule : tout se pose ensuite en pixels d'ecran
    ctx.setTransform(1 / cell, 0, 0, 1 / cell, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    const vw = window.innerWidth;
    const vh = window.innerHeight;

    /** Pose un filet : sous `SNAP` il garde son epaisseur, au-dela il prend la cellule entiere. */
    const filet = (x: number, y: number, w: number, h: number) => {
      if (h >= SNAP && h < cell) {
        y = Math.floor(y / cell) * cell;
        h = cell;
      }
      if (w >= SNAP && w < cell) {
        x = Math.floor(x / cell) * cell;
        w = cell;
      }
      ctx.fillRect(x, y, w, h);
    };

    /** Un cote de cadre : rien si la couleur est illisible. */
    const side = (color: string, x: number, y: number, w: number, h: number) => {
      const t = tone(color);
      if (t === null) return;
      ctx.fillStyle = t < 0.5 ? "#000000" : "#FFFFFF";
      filet(x, y, w, h);
    };

    for (const el of document.querySelectorAll<HTMLElement>(SURFACES)) {
      if (el.closest("[data-mire-nocapture]")) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      if (r.bottom <= 0 || r.top >= vh || r.right <= 0 || r.left >= vw) continue;

      if (el instanceof HTMLCanvasElement) {
        if (!el.width || !el.height) continue;
        ctx.drawImage(el, r.left, r.top, r.width, r.height);
        continue;
      }

      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.opacity === "0") continue;

      const bg = tone(cs.backgroundColor);
      if (bg !== null) {
        ctx.fillStyle = bg < 0.5 ? "#000000" : "#FFFFFF";
        ctx.fillRect(r.left, r.top, r.width, r.height);
      }

      // filets : ce sont eux qui donnent au site ses lignes franches
      const bt = parseFloat(cs.borderTopWidth) || 0;
      const bb = parseFloat(cs.borderBottomWidth) || 0;
      const bl = parseFloat(cs.borderLeftWidth) || 0;
      const br = parseFloat(cs.borderRightWidth) || 0;
      if (bt) side(cs.borderTopColor, r.left, r.top, r.width, bt);
      if (bb) side(cs.borderBottomColor, r.left, r.bottom - bb, r.width, bb);
      if (bl) side(cs.borderLeftColor, r.left, r.top, bl, r.height);
      if (br) side(cs.borderRightColor, r.right - br, r.top, br, r.height);
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    // meme seuil que partout ailleurs sur le site : `bitsFromRGBA`
    const { data } = bitsFromRGBA(ctx.getImageData(0, 0, cols, rows).data, cols, rows);
    // le signal inverse (touche N) porte sur `main` et le chrome : l'ecran montre
    // le negatif de ce que les styles declarent, la carte le suit
    const neg = document.documentElement.classList.contains("mire-negative") ? 1 : 0;
    let inked = 0;
    for (let i = 0; i < data.length; i++) {
      const v = data[i]! ^ neg;
      data[i] = v;
      inked += v;
    }
    // un ecran sans une seule cellule d'encre n'a pas de silhouette a faire tomber
    return inked ? data : null;
  } catch {
    return null;
  }
}
