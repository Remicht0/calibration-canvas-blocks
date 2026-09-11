import { useEffect, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { drawText, mireText, textCols } from "@/lib/glyphs";
import { bitUnit, blockifyText, cellSizeFor, fallOrder, textBlockHeight } from "@/lib/mire";
import { bySlug } from "@/lib/projects";

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
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      sessionStorage.setItem(KEY, "1");
      return;
    }
    sessionStorage.setItem(KEY, "1");
    setDone(false);
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
  }, []);

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
    const cell = cellSizeFor(window.innerWidth);
    el.style.width = `${cell}px`;
    el.style.height = `${cell}px`;
    let x = -99;
    let y = -99;
    let raf = 0;
    const draw = () => {
      raf = 0;
      el.style.transform = `translate3d(${Math.floor(x / cell) * cell}px, ${
        Math.floor(y / cell) * cell
      }px, 0)`;
    };
    const move = (e: PointerEvent) => {
      x = e.clientX;
      y = e.clientY;
      if (!raf) raf = requestAnimationFrame(draw);
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
    document.documentElement.classList.add("mire-nocursor");
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerover", over);
      document.documentElement.classList.remove("mire-nocursor");
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      ref={box}
      aria-hidden="true"
      className="pointer-events-none fixed left-0 top-0 z-[150] hidden bg-white mix-blend-difference md:block"
    />
  );
}

/* ------------------------------------------------------------------ */
/* Inversion du signal : touche N ou bouton                            */
/* ------------------------------------------------------------------ */

export function NegativeSwitch() {
  const [neg, setNeg] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("mire-negative", neg);
  }, [neg]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (e.key === "n" || e.key === "N") setNeg((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <button
      type="button"
      onClick={() => setNeg((v) => !v)}
      aria-pressed={neg}
      aria-keyshortcuts="n"
      aria-label={neg ? "Revenir au positif, touche N" : "Passer en négatif, touche N"}
      className="mire-noprint u-mono fixed right-0 top-1/2 z-[160] hidden -translate-y-1/2 border-[3px] px-[6px] py-cell md:block"
      style={{
        writingMode: "vertical-rl",
        background: "#FFFFFF",
        color: "#000000",
        borderColor: "#000000",
      }}
    >
      {neg ? "POSITIF [N]" : "NEGATIF [N]"}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Transition de page : masque plein ecran en chute de blocs           */
/* ------------------------------------------------------------------ */

const easeOutCubic = (k: number) => 1 - Math.pow(1 - k, 3);
const easeInOutCubic = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const seg = (k: number, a: number, b: number) => Math.min(1, Math.max(0, (k - a) / (b - a)));

const DISPLAY_FONT = "'Anton', sans-serif";

/** Titre de la page de destination, lu sur le chemin deja change au declenchement. */
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

export function RouteWipe() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const canvas = useRef<HTMLCanvasElement>(null);
  const [on, setOn] = useState(false);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    setOn(true);
    const cv = canvas.current;
    let raf = 0;
    let dead = false;
    // trois temps : recouvrement, palier de calibration, chute
    const DUR = 1500;
    const A = 0.4; // fin du recouvrement
    const B = 0.56; // fin du palier
    const t0 = performance.now();

    const cell = cellSizeFor(window.innerWidth);
    const cols = Math.ceil(window.innerWidth / cell);
    const rows = Math.ceil(window.innerHeight / cell);
    const n = cols * rows;

    let s = 4441;
    const rnd = () => ((s = (s * 9301 + 49297) % 233280), s / 233280);

    // bruit par colonne : la vague ne descend pas droit
    const colOffset = new Float32Array(cols);
    for (let x = 0; x < cols; x++) colOffset[x] = rnd() * 0.22;

    // recouvrement : du haut vers le bas, densite croissante
    const cover = new Float32Array(n);
    // chute : du bas vers le haut, quelques cellules tiennent plus longtemps
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

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (cv) {
      cv.width = cols * cell * dpr;
      cv.height = rows * cell * dpr;
      cv.style.width = `${cols * cell}px`;
      cv.style.height = `${rows * cell}px`;
    }

    // etat du masque ce frame : 1 = cellule noire
    const state = new Uint8Array(n);
    const u = bitUnit(cell);
    const MENTION = "MIRE / RECALIBRAGE";
    // compteur cale sur la grille visible, a une cellule des bords bas et droit
    const counterX = (Math.floor(window.innerWidth / cell) - 1 - textCols("000")) * cell;
    const counterY = (Math.floor(window.innerHeight / cell) - 1 - 5) * cell;

    // titre de destination, compose pleine largeur et centre ; s'il depasse la
    // hauteur d'ecran, on reduit sa largeur plutot que de le couper
    const title = mireText(titleFor(path));
    const rowsMax = Math.max(1, rows - 6);
    const needed = Math.ceil(textBlockHeight(title, DISPLAY_FONT, cols * cell) / cell);
    const rowsTitle = Math.min(needed, rowsMax);
    const colsTitle = needed > rowsMax ? Math.max(1, Math.floor((cols * rowsMax) / needed)) : cols;
    const titleBits = blockifyText(title, DISPLAY_FONT, colsTitle, rowsTitle);
    const titleOrder = fallOrder(colsTitle, rowsTitle, 13);
    const titleX = Math.floor((cols - colsTitle) / 2);
    const titleY = Math.floor((rows - rowsTitle) / 2);

    const step = (t: number) => {
      if (dead) return;
      const k = Math.min(1, (t - t0) / DUR);
      const ctx = cv?.getContext("2d");
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, cols * cell, rows * cell);

        let red = -1;
        if (k < A) {
          const p = easeOutCubic(seg(k, 0, A));
          for (let i = 0; i < n; i++) state[i] = cover[i]! <= p ? 1 : 0;
        } else if (k < B) {
          state.fill(1);
          // palier : un seul repere rouge balaye la surface noire
          red = Math.floor(seg(k, A, B) * (rows - 1));
        } else {
          const p = easeInOutCubic(seg(k, B, 1));
          for (let i = 0; i < n; i++) state[i] = fall[i]! > p ? 1 : 0;
        }

        ctx.fillStyle = "#000000";
        for (let i = 0; i < n; i++) {
          if (!state[i]) continue;
          ctx.fillRect((i % cols) * cell, Math.floor(i / cols) * cell, cell, cell);
        }
        if (red >= 0) {
          ctx.fillStyle = "#FF0000";
          ctx.fillRect(0, red * cell, cols * cell, cell);
        }

        // titre : se compose avec le masque, tient au palier, tombe avec lui
        const pTitle = k < A ? easeOutCubic(seg(k, 0, A)) : 1;
        ctx.fillStyle = "#FFFFFF";
        for (let y = 0; y < rowsTitle; y++) {
          const gy = titleY + y;
          if (gy === red) continue;
          for (let x = 0; x < colsTitle; x++) {
            const i = y * colsTitle + x;
            if (!titleBits.data[i] || titleOrder[i]! > pTitle) continue;
            const gx = titleX + x;
            if (!state[gy * cols + gx]) continue;
            ctx.fillRect(gx * cell, gy * cell, cell, cell);
          }
        }

        const ink = (gx: number, gy: number) => (gy === red ? null : state[gy * cols + gx] === 1);
        drawTextXor(ctx, MENTION, u, cell, cell, cell, ink);
        const count = String(Math.round(easeInOutCubic(k) * 100)).padStart(3, "0");
        drawTextXor(ctx, count, cell, counterX, counterY, cell, ink);
      }
      if (k < 1) raf = requestAnimationFrame(step);
      else setOn(false);
    };
    raf = requestAnimationFrame(step);
    return () => {
      dead = true;
      cancelAnimationFrame(raf);
    };
  }, [path]);

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[195] overflow-hidden"
      style={{ visibility: on ? "visible" : "hidden" }}
      aria-hidden="true"
    >
      <canvas ref={canvas} className="block" />
    </div>
  );
}
