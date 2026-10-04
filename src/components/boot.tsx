import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { drawText, mireText, textCols } from "@/lib/glyphs";
import { captureInk } from "@/lib/ink";
import {
  bitUnit,
  blockifyText,
  cellSizeFor,
  fallOrder,
  prefersReducedMotion,
  scanLineTop,
  textBlockHeight,
  type Bits,
} from "@/lib/mire";
import { bySlug } from "@/lib/projects";
import { Bloc } from "@/components/bloc";

/* ------------------------------------------------------------------ */
/* Sequence de mise en route : la mire se charge, bloc par bloc        */
/* ------------------------------------------------------------------ */

const KEY = "mire-boot";

export function BootSequence() {
  const [done, setDone] = useState(true);
  const [pct, setPct] = useState(0);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (sessionStorage.getItem(KEY)) return;
    sessionStorage.setItem(KEY, "1");
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setDone(false);
  }, []);

  // le canvas n'existe qu'une fois done a false : l'animation part au rendu suivant
  useEffect(() => {
    if (done) return;
    document.documentElement.style.overflow = "hidden";

    const cv = canvas.current;
    let raf = 0;
    let dead = false;
    const t0 = performance.now();
    const DUR = 1700;

    const cell = cellSizeFor(window.innerWidth);
    const cols = Math.ceil(window.innerWidth / cell);
    const rows = Math.ceil(window.innerHeight / cell);
    // ordre pseudo-aleatoire stable, densite decroissante vers le bas
    const order = new Float32Array(cols * rows);
    let s = 7919;
    const rnd = () => ((s = (s * 9301 + 49297) % 233280), s / 233280);
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < cols; x++)
        order[y * cols + x] = Math.min(1, (y / rows) * 0.75 + rnd() * 0.55);

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (cv) {
      cv.width = cols * cell * dpr;
      cv.height = rows * cell * dpr;
      cv.style.width = `${cols * cell}px`;
      cv.style.height = `${rows * cell}px`;
    }

    const step = (t: number) => {
      if (dead) return;
      const k = Math.min(1, (t - t0) / DUR);
      setPct(Math.round(k * 100));
      const ctx = cv?.getContext("2d");
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.fillStyle = "#000000";
        ctx.fillRect(0, 0, cols * cell, rows * cell);
        ctx.fillStyle = "#FFFFFF";
        for (let i = 0; i < order.length; i++) {
          if (order[i]! > 1 - k) continue;
          ctx.fillRect((i % cols) * cell, Math.floor(i / cols) * cell, cell, cell);
        }
      }
      if (k < 1) raf = requestAnimationFrame(step);
      else {
        document.documentElement.style.overflow = "";
        setDone(true);
      }
    };
    raf = requestAnimationFrame(step);

    return () => {
      dead = true;
      cancelAnimationFrame(raf);
      document.documentElement.style.overflow = "";
    };
  }, [done]);

  if (done) return null;

  return (
    <div className="fixed inset-0 z-[200] overflow-hidden bg-black" aria-hidden="true">
      <canvas ref={canvas} className="block" />
      <div className="u-mono absolute inset-0 flex flex-col justify-between p-cell text-white mix-blend-difference">
        <div className="flex justify-between">
          <span>MIRE / MISE EN ROUTE</span>
          <span>1-BIT</span>
        </div>
        <div className="flex items-end justify-between">
          <span className="u-display text-[22vw] leading-[0.78] md:text-[10vw]">
            {String(pct).padStart(3, "0")}
          </span>
          <span>CALIBRATION DU SIGNAL</span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Curseur : une cellule de la grille, inversion pure                  */
/* ------------------------------------------------------------------ */

export function GridCursor() {
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(pointer: coarse)").matches) return;
    const el = box.current;
    if (!el) return;
    let cell = cellSizeFor(window.innerWidth);
    let x = -99;
    let y = -99;
    let raf = 0;
    let wiping = false;
    const draw = () => {
      raf = 0;
      cell = cellSizeFor(window.innerWidth);
      el.style.width = `${cell}px`;
      el.style.height = `${cell}px`;
      const cy = Math.floor(y / cell) * cell;
      el.style.transform = `translate3d(${Math.floor(x / cell) * cell}px, ${cy}px, 0)`;
      // sur la ligne rouge (ou le balayage rouge de la transition), la cellule
      // en difference donnerait du cyan : elle s'efface
      const line = scanLineTop(
        cell,
        window.scrollY,
        window.innerHeight,
        document.body.scrollHeight,
      );
      const onLine = cy < line + 10 && cy + cell > line;
      el.style.visibility = onLine || wiping ? "hidden" : "visible";
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(draw);
    };
    const move = (e: PointerEvent) => {
      x = e.clientX;
      y = e.clientY;
      schedule();
    };
    const onWipe = (e: Event) => {
      wiping = Boolean((e as CustomEvent<boolean>).detail);
      schedule();
    };
    // sur un lien, la cellule se creuse : un cadre blanc, inverse par le mode
    // difference. Jamais de rouge ici : le repere est unique, et un rouge en
    // difference sur fond blanc donnerait du cyan.
    const over = () => {
      const t = document.querySelectorAll("a:hover, button:hover").length > 0;
      el.style.outline = t ? `${cell / 4}px solid #FFFFFF` : "none";
      el.style.outlineOffset = `-${cell / 4}px`;
      el.style.background = t ? "transparent" : "#FFFFFF";
    };
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerover", over, { passive: true });
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    window.addEventListener("mire:wipe", onWipe);
    document.documentElement.classList.add("mire-nocursor");
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerover", over);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("mire:wipe", onWipe);
      document.documentElement.classList.remove("mire-nocursor");
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      ref={box}
      aria-hidden="true"
      className="pointer-events-none fixed left-0 top-0 z-[250] hidden bg-white mix-blend-difference md:block"
    />
  );
}

/* ------------------------------------------------------------------ */
/* Inversion du signal : touche N ou bouton, memorisee d'une visite a   */
/* l'autre. La classe est posee par NEGATIVE_BOOT_SCRIPT avant la       */
/* premiere peinture : le composant ne fait que la suivre et l'ecrire.  */
/* ------------------------------------------------------------------ */

const NEG_CLASS = "mire-negative";
const NEG_KEY = "mire-negative";

/**
 * Script d'amorce du document, pose dans le `<head>` (voir `__root.tsx`) : il
 * applique l'inversion memorisee avant que la moindre surface soit peinte.
 * Sans dependance, et muet si le stockage est refuse.
 */
export const NEGATIVE_BOOT_SCRIPT = `try{if(localStorage.getItem("${NEG_KEY}")==="1")document.documentElement.classList.add("${NEG_CLASS}")}catch(e){}`;

/** Drapeau memorise, ou null si rien n'est ecrit ou si le stockage est indisponible. */
function storedNegative(): boolean | null {
  try {
    const v = localStorage.getItem(NEG_KEY);
    return v === null ? null : v === "1";
  } catch {
    return null;
  }
}

// le rendu serveur n'a pas de couche de mise en page : useEffect y tient lieu de useLayoutEffect
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function NegativeSwitch() {
  const [neg, setNeg] = useState(false);

  // Le serveur ne connait pas le stockage : le bouton est rendu au positif, puis
  // rejoint la classe deja posee — avant la premiere peinture, donc sans
  // clignotement et sans ecart d'hydratation.
  useIsoLayoutEffect(() => {
    setNeg(document.documentElement.classList.contains(NEG_CLASS));
  }, []);

  // seul chemin d'ecriture : classe, stockage et aria-pressed bougent ensemble
  const apply = useCallback((next: boolean) => {
    document.documentElement.classList.toggle(NEG_CLASS, next);
    try {
      localStorage.setItem(NEG_KEY, next ? "1" : "0");
    } catch {
      // stockage refuse : l'inversion vaut pour la visite en cours, rien de plus
    }
    setNeg(next);
  }, []);

  const toggle = useCallback(() => {
    apply(!document.documentElement.classList.contains(NEG_CLASS));
  }, [apply]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (document.documentElement.classList.contains("mire-modal")) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (e.key === "n" || e.key === "N") toggle();
    };
    // retour arriere ou restauration bfcache : la page revient telle qu'elle etait,
    // on la remet d'accord avec le drapeau memorise (a defaut, avec sa propre classe)
    const onPageShow = () => {
      const next = storedNegative() ?? document.documentElement.classList.contains(NEG_CLASS);
      document.documentElement.classList.toggle(NEG_CLASS, next);
      setNeg(next);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [toggle]);

  return (
    <Bloc
      id="inverseur"
      onClick={toggle}
      pressed={neg}
      aria-keyshortcuts="n"
      aria-label={neg ? "Revenir au positif, touche N" : "Passer en négatif, touche N"}
      // en vertical-rl l'axe inline est vertical : px-cell / py-0 donnent haut-bas = 1 cellule, cotes = 0
      className="mire-noprint mire-chrome fixed right-0 top-1/2 z-[160] hidden h-auto w-cell2 -translate-y-1/2 px-cell py-0 md:inline-flex"
      style={{ writingMode: "vertical-rl" }}
    >
      {neg ? "POSITIF [N]" : "NEGATIF [N]"}
    </Bloc>
  );
}

/* ------------------------------------------------------------------ */
/* Transition de page : une seule chute, de la page sortante a l'arrivee */
/* ------------------------------------------------------------------ */

const easeOutCubic = (k: number) => 1 - Math.pow(1 - k, 3);
const easeInOutCubic = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const seg = (k: number, a: number, b: number) => Math.min(1, Math.max(0, (k - a) / (b - a)));

const DISPLAY_FONT = "'Anton', sans-serif";

const DUR = 1500;
const COLLAPSE = 0.42; // fin de l'effondrement de la page sortante
const HOLD = 0.58; // fin du palier de calibration

/** Titre de la page de destination, lu sur le chemin vise avant que la route ne change. */
function titleFor(path: string): string {
  if (path === "/") return "MIRE";
  if (path.startsWith("/atelier")) return "ATELIER";
  if (path.startsWith("/contact")) return "CONTACT";
  const m = /^\/projet\/([^/]+)/.exec(path);
  return (m && bySlug(m[1]!)?.title) || "MIRE";
}

/**
 * Texte 3x5 en XOR par cellule : chaque bloc de glyphe est blanc si la cellule du
 * masque sous lui est noire, noir sinon, et rien n'est peint sur la rangee rouge.
 * Deux passes de drawText sous un decoupage rectangulaire : aucun demi-bloc.
 */
function drawTextXor(
  ctx: CanvasRenderingContext2D,
  text: string,
  unit: number,
  ox: number,
  oy: number,
  cell: number,
  ink: (gx: number, gy: number) => boolean | null,
) {
  const white = new Path2D();
  const black = new Path2D();
  const chars = text.length;
  for (let i = 0; i < chars; i++) {
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 3; x++) {
        const px = ox + (i * 4 + x) * unit;
        const py = oy + y * unit;
        const on = ink(Math.floor(px / cell), Math.floor(py / cell));
        if (on === null) continue;
        (on ? white : black).rect(px, py, unit, unit);
      }
    }
  }
  ctx.save();
  ctx.clip(white);
  ctx.fillStyle = "#FFFFFF";
  drawText(ctx, text, unit, ox, oy);
  ctx.restore();
  ctx.save();
  ctx.clip(black);
  ctx.fillStyle = "#000000";
  drawText(ctx, text, unit, ox, oy);
  ctx.restore();
}

/** Tout ce qui est fige au declenchement : la silhouette sortante, les ordres, le titre d'arrivee. */
type Fall = {
  t0: number;
  cell: number;
  cols: number;
  rows: number;
  n: number;
  unit: number;
  /** silhouette de la page sortante (1 = encre), ou null : on se replie sur `cover` */
  ink: Uint8Array | null;
  /** ordre de lachage : les cellules basses cedent d'abord, colonne par colonne */
  order: Float32Array;
  /** repli : recouvrement du haut vers le bas, le motif d'avant la capture */
  cover: Float32Array;
  /** vidage du bas vers le haut ; les cellules du titre d'arrivee resistent */
  fall: Float32Array;
  /** encre par colonne, et instant ou la crue prend le relais dans cette colonne */
  colInk: Int32Array;
  colRise: Float32Array;
  /** tampons de travail, alloues une fois par transition */
  released: Int32Array;
  top: Int32Array;
  state: Uint8Array;
  title: Bits;
  titleOrder: Float32Array;
  titleX: number;
  titleY: number;
  counterX: number;
  counterY: number;
};

/**
 * Fige la transition au declenchement : la carte d'encre de la page sortante est
 * relevee ici, avant que la route ne change, et c'est elle qui tombe.
 * Tout ce que le clic paie tient ici ; le cout est publie en mesure
 * `mire:transition` (budget de rendu).
 */
function planFall(to: string): Fall {
  const cell = cellSizeFor(window.innerWidth);
  const cols = Math.ceil(window.innerWidth / cell);
  const rows = Math.ceil(window.innerHeight / cell);
  const n = cols * rows;

  const t0 = performance.now();
  const ink = captureInk(cell, cols, rows);

  // ordre de chute du site : les cellules basses lachent d'abord, certaines
  // colonnes tiennent plus longtemps que les autres
  const order = fallOrder(cols, rows, 61);

  let s = 4441;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280), s / 233280);

  // bruit par colonne : ni le recouvrement ni la crue ne montent droit
  const colOffset = new Float32Array(cols);
  const colRise = new Float32Array(cols);
  for (let x = 0; x < cols; x++) {
    colOffset[x] = rnd() * 0.22;
    colRise[x] = 0.18 + rnd() * 0.34;
  }

  const cover = new Float32Array(n);
  const fall = new Float32Array(n);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = y * cols + x;
      const v = y / Math.max(1, rows - 1);
      cover[i] = Math.min(1, v * 0.66 + colOffset[x]! + rnd() * 0.3);
      const hold = rnd() < 0.06 ? 0.3 : 0; // cellules isolees qui resistent
      fall[i] = Math.min(1, (1 - v) * 0.6 + colOffset[x]! + rnd() * 0.26 + hold);
    }
  }

  const colInk = new Int32Array(cols);
  if (ink) for (let i = 0; i < n; i++) if (ink[i]) colInk[i % cols] = colInk[i % cols]! + 1;

  // titre de destination, compose pleine largeur et centre ; s'il depasse la
  // hauteur d'ecran, on reduit sa largeur plutot que de le couper
  const text = mireText(titleFor(to));
  const rowsMax = Math.max(1, rows - 6);
  const needed = Math.ceil(textBlockHeight(text, DISPLAY_FONT, cols * cell) / cell);
  const rowsTitle = Math.min(needed, rowsMax);
  const colsTitle = needed > rowsMax ? Math.max(1, Math.floor((cols * rowsMax) / needed)) : cols;
  const title = blockifyText(text, DISPLAY_FONT, colsTitle, rowsTitle);
  const titleOrder = fallOrder(colsTitle, rowsTitle, 13);
  const titleX = Math.floor((cols - colsTitle) / 2);
  const titleY = Math.floor((rows - rowsTitle) / 2);

  // le titre d'arrivee est la derniere matiere que le masque lache : la page se
  // leve autour de lui, puis il tombe a son tour
  for (let y = 0; y < rowsTitle; y++) {
    for (let x = 0; x < colsTitle; x++) {
      if (!title.data[y * colsTitle + x]) continue;
      const i = (titleY + y) * cols + (titleX + x);
      fall[i] = Math.min(1, fall[i]! + 0.3);
    }
  }

  return {
    t0,
    cell,
    cols,
    rows,
    n,
    unit: bitUnit(cell),
    ink,
    order,
    cover,
    fall,
    colInk,
    colRise,
    released: new Int32Array(cols),
    top: new Int32Array(cols),
    state: new Uint8Array(n),
    title,
    titleOrder,
    titleX,
    titleY,
    // compteur cale sur la grille visible, a une cellule des bords bas et droit
    counterX: (Math.floor(window.innerWidth / cell) - 1 - textCols("000")) * cell,
    counterY: (Math.floor(window.innerHeight / cell) - 1 - 5) * cell,
  };
}

/**
 * Cout du travail paye par le clic — carte d'encre, ordres de chute, titre
 * d'arrivee et allocation du masque — publie en User Timing. C'est la mesure
 * qui verifie la regle du budget de rendu : le clic ne paie pas la transition.
 */
function publierLeCoutDuClic(start: number) {
  try {
    performance.measure("mire:transition", { start, end: performance.now() });
  } catch {
    // User Timing indisponible : la mesure n'est qu'un diagnostic
  }
}

const MENTION = "MIRE / RECALIBRAGE";

/** Une image de la transition, a l'avancement k (0 -> 1). */
function paint(ctx: CanvasRenderingContext2D, f: Fall, k: number, dpr: number) {
  const { cols, rows, cell, n, state } = f;
  const w = cols * cell;
  const h = rows * cell;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  let red = -1;
  // l'effondrement est opaque : le masque reproduit la page sortante, papier
  // compris, et la page d'arrivee se compose derriere sans se montrer
  let opaque = false;

  if (k < COLLAPSE) {
    // l'effondrement part lentement puis cede : la silhouette se lit avant de tomber
    const p = easeInOutCubic(seg(k, 0, COLLAPSE));
    const ink = f.ink;
    if (ink) {
      opaque = true;
      f.released.fill(0);
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const i = y * cols + x;
          if (ink[i] && f.order[i]! <= p) f.released[x] = f.released[x]! + 1;
        }
      }
      for (let x = 0; x < cols; x++) {
        // la matiere lachee s'empile au bas de sa colonne : le profil du tas est
        // l'histogramme d'encre de la page. La crue acheve de remplir l'ecran.
        const q = easeOutCubic(seg(p, f.colRise[x]!, 0.94));
        const pile = f.released[x]! + Math.round((rows - f.colInk[x]!) * q);
        f.top[x] = rows - Math.min(rows, pile);
      }
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const i = y * cols + x;
          state[i] = (ink[i] && f.order[i]! > p) || y >= f.top[x]! ? 1 : 0;
        }
      }
    } else {
      // repli : recouvrement du haut vers le bas, sans silhouette
      const c = easeOutCubic(seg(k, 0, COLLAPSE));
      for (let i = 0; i < n; i++) state[i] = f.cover[i]! <= c ? 1 : 0;
    }
  } else if (k < HOLD) {
    state.fill(1);
    // palier : un seul repere rouge balaye la surface noire
    red = Math.floor(seg(k, COLLAPSE, HOLD) * (rows - 1));
  } else {
    const p = easeInOutCubic(seg(k, HOLD, 1));
    for (let i = 0; i < n; i++) state[i] = f.fall[i]! > p ? 1 : 0;
  }

  if (opaque) {
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, w, h);
  }
  ctx.fillStyle = "#000000";
  for (let i = 0; i < n; i++) {
    if (!state[i]) continue;
    ctx.fillRect((i % cols) * cell, Math.floor(i / cols) * cell, cell, cell);
  }
  if (red >= 0) {
    ctx.fillStyle = "#FF0000";
    ctx.fillRect(0, red * cell, w, cell);
  }

  // titre d'arrivee : il se compose avec l'effondrement, tient au palier, et
  // resiste au vidage avant de tomber a son tour
  const pTitle = k < COLLAPSE ? easeOutCubic(seg(k, 0, COLLAPSE)) : 1;
  const { title, titleOrder, titleX, titleY } = f;
  ctx.fillStyle = "#FFFFFF";
  for (let y = 0; y < title.rows; y++) {
    const gy = titleY + y;
    if (gy === red) continue;
    for (let x = 0; x < title.cols; x++) {
      const i = y * title.cols + x;
      if (!title.data[i] || titleOrder[i]! > pTitle) continue;
      const gx = titleX + x;
      if (!state[gy * cols + gx]) continue;
      ctx.fillRect(gx * cell, gy * cell, cell, cell);
    }
  }

  const ink = (gx: number, gy: number) => (gy === red ? null : state[gy * cols + gx] === 1);
  drawTextXor(ctx, MENTION, f.unit, cell, cell, cell, ink);
  const count = String(Math.round(easeInOutCubic(k) * 100)).padStart(3, "0");
  drawTextXor(ctx, count, cell, f.counterX, f.counterY, cell, ink);
}

/**
 * Une seule chute, d'un bout a l'autre. Au declenchement de la navigation — donc
 * avant que la route ne change et que la page sortante ne disparaisse — sa
 * silhouette est relevee en carte d'encre ; ce sont ses blocs qui tombent, leur
 * chute devient le masque, et la page d'arrivee se leve de la meme matiere.
 */
export function RouteWipe() {
  const router = useRouter();
  const shell = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const box = shell.current;
    const cv = canvas.current;
    if (!box || !cv) return;

    let raf = 0;
    let dead = false;
    /** La chute en cours, ou null entre deux navigations. */
    let live: Fall | null = null;
    // aucun bitmap tant qu'aucune transition ne tourne
    cv.width = 0;
    cv.height = 0;

    const show = (v: boolean) => {
      box.style.visibility = v ? "visible" : "hidden";
      window.dispatchEvent(new CustomEvent("mire:wipe", { detail: v }));
    };

    const stop = () => {
      cancelAnimationFrame(raf);
      live = null;
      // le masque est invisible entre deux navigations : son bitmap n'a pas a
      // rester alloue
      cv.width = 0;
      cv.height = 0;
      show(false);
    };

    // le masque est taille une fois pour l'ecran de depart. S'il ne le couvre
    // plus — fenetre agrandie, rotation, barre d'adresse qui se retracte — il
    // laisserait une bande de page a nu : on le retire net plutot que de
    // masquer a moitie.
    const onResize = () => {
      if (!live) return;
      if (live.cols * live.cell < window.innerWidth || live.rows * live.cell < window.innerHeight) {
        stop();
      }
    };

    const start = (to: string) => {
      cancelAnimationFrame(raf);
      const f = planFall(to);
      live = f;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = f.cols * f.cell * dpr;
      cv.height = f.rows * f.cell * dpr;
      cv.style.width = `${f.cols * f.cell}px`;
      cv.style.height = `${f.rows * f.cell}px`;
      show(true);
      publierLeCoutDuClic(f.t0);

      const step = (t: number) => {
        if (dead) return;
        const k = Math.min(1, (t - f.t0) / DUR);
        try {
          const ctx = cv.getContext("2d");
          if (ctx) paint(ctx, f, k, dpr);
        } catch {
          // une image qui ne se peint pas ne doit pas laisser un masque fige
          stop();
          return;
        }
        if (k < 1) raf = requestAnimationFrame(step);
        else stop();
      };
      raf = requestAnimationFrame(step);
    };

    // `onBeforeNavigate` est emis avant que React ne compose la page d'arrivee :
    // le DOM sous nos pieds est encore celui que le visiteur regarde
    const off = router.subscribe("onBeforeNavigate", (e) => {
      if (!e.fromLocation || !e.pathChanged) return;
      if (prefersReducedMotion()) return;
      // la transition ne doit jamais empecher la navigation : si la chute ne
      // peut pas etre preparee, on navigue sans masque plutot que de casser
      try {
        start(e.toLocation.pathname);
      } catch {
        stop();
      }
    });
    window.addEventListener("resize", onResize);

    return () => {
      dead = true;
      off();
      window.removeEventListener("resize", onResize);
      // meme sortie que la fin d'une chute : bitmap libere, masque cache, et le
      // signal `mire:wipe` remis a faux pour le curseur
      stop();
    };
  }, [router]);

  return (
    <div
      ref={shell}
      // la capture d'encre ne se releve jamais elle-meme
      data-mire-nocapture=""
      className="pointer-events-none fixed inset-0 z-[195] overflow-hidden"
      style={{ visibility: "hidden" }}
      aria-hidden="true"
    >
      <canvas ref={canvas} className="block" />
    </div>
  );
}
