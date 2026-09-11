import { useEffect, useRef, useState } from "react";
import {
  blockifyImage,
  blockifyText,
  cellSizeFor,
  drawBits,
  erode,
  fallOrder,
  heal,
  prefersReducedMotion,
  scanLineTop,
  textBlockHeight,
  type Bits,
} from "@/lib/mire";

/* ------------------------------------------------------------------ */
/* Image 1-bit qui se compose par chute de blocs a l'entree en ecran   */
/* ------------------------------------------------------------------ */

export function BlockImage({
  src,
  alt,
  negative = false,
  threshold = 0.45,
  ratio = 1.25,
  className = "",
}: {
  src: string;
  alt: string;
  negative?: boolean;
  threshold?: number;
  ratio?: number;
  className?: string;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const raf = useRef(0);

  useEffect(() => {
    const el = wrap.current;
    const cv = canvas.current;
    if (!el || !cv) return;
    let bits: Bits | null = null;
    let order: Float32Array | null = null;
    let cell = cellSizeFor(window.innerWidth);
    let cols = 0;
    let rows = 0;
    let progress = 0;
    let running = false;
    let dead = false;

    const img = new Image();
    img.decoding = "async";

    const paint = () => {
      const ctx = cv.getContext("2d");
      if (!ctx || !bits || !order) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      ctx.scale(dpr, dpr);
      drawBits(ctx, bits, order, { cell, progress, negative });
    };

    const build = () => {
      if (!img.complete || img.naturalWidth === 0) return;
      cell = cellSizeFor(window.innerWidth);
      const w = el.clientWidth;
      cols = Math.max(4, Math.floor(w / cell));
      rows = Math.max(4, Math.round(cols * ratio));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.style.width = `${cols * cell}px`;
      cv.style.height = `${rows * cell}px`;
      cv.width = cols * cell * dpr;
      cv.height = rows * cell * dpr;
      bits = blockifyImage(img, cols, rows, threshold);
      order = fallOrder(cols, rows, cols * 7 + rows);
      paint();
    };

    const animate = () => {
      if (running || dead) return;
      if (prefersReducedMotion()) {
        progress = 1;
        paint();
        return;
      }
      running = true;
      const t0 = performance.now();
      const step = (t: number) => {
        const k = Math.min(1, (t - t0) / 1100);
        progress = k;
        paint();
        if (k < 1) raf.current = requestAnimationFrame(step);
        else running = false;
      };
      raf.current = requestAnimationFrame(step);
    };

    img.onload = () => {
      build();
      if (io) io.observe(el);
    };
    img.src = src;

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) animate();
      },
      { threshold: 0.15 },
    );

    const ro = new ResizeObserver(() => {
      build();
    });
    ro.observe(el);

    return () => {
      dead = true;
      cancelAnimationFrame(raf.current);
      io.disconnect();
      ro.disconnect();
    };
  }, [src, negative, threshold, ratio]);

  return (
    <div ref={wrap} className={className} role="img" aria-label={alt}>
      <canvas ref={canvas} className="block" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Titre display rendu en blocs : dissolution puis recomposition       */
/* ------------------------------------------------------------------ */

const DISPLAY_FONT = "'Anton', sans-serif";

/** Largeur de la bande, en cellules, ou la ligne rouge lit un titre bloc par bloc. */
const SCAN_BAND = 6;
/** Erosion sous le curseur : rayon du carre (cellules), usure par frame, duree de guerison. */
const WEAR_R = 2;
const WEAR_STEP = 0.12;
const HEAL_MS = 700;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export function BlockType({
  text,
  className = "",
  loop = true,
  drive = "time",
  erodible = true,
  negative = false,
}: {
  text: string;
  className?: string;
  loop?: boolean;
  /** time : sequence temporelle ; scan : la ligne rouge efface ce qu'elle lit, recompose ce qu'elle relit */
  drive?: "time" | "scan";
  /** le curseur use les blocs (pointeur fin seulement), ils se reposent quand il part */
  erodible?: boolean;
  /** blocs blancs sur fond noir (page d'erreur) */
  negative?: boolean;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = wrap.current;
    const cv = canvas.current;
    if (!el || !cv) return;
    let bits: Bits | null = null;
    let order: Float32Array | null = null;
    let cell = cellSizeFor(window.innerWidth);
    let cols = 0;
    let rows = 0;
    let raf = 0;
    let dead = false;
    const reduced = prefersReducedMotion();
    const scan = drive === "scan" && !reduced;
    const erodes = erodible && !reduced && !window.matchMedia("(pointer: coarse)").matches;

    // usure sous le curseur : cellule survolee, puis guerison chronometree
    let wear = new Float32Array(0);
    let hot: { x: number; y: number } | null = null;
    let healT0 = -1;

    // sequence : compose -> tient -> se dissout -> se recompose
    const phases = loop
      ? [
          { d: 1200, from: 0, to: 1 },
          { d: 1400, from: 1, to: 1 },
          { d: 900, from: 1, to: 0 },
          { d: 1200, from: 0, to: 1 },
        ]
      : [{ d: 1200, from: 0, to: 1 }];
    let phase = -1;
    let t0 = 0;
    let seq = reduced ? 1 : 0;

    // lecture par la ligne rouge : un progress par rangee, recalcule au defilement
    let pr = new Float32Array(0);
    let mix = new Float32Array(0);
    let dirty = false;

    const schedule = () => {
      if (!raf && !dead) raf = requestAnimationFrame(tick);
    };

    const paint = () => {
      const ctx = cv.getContext("2d");
      if (!ctx || !bits || !order) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      ctx.scale(dpr, dpr);
      let progress: number | Float32Array = seq;
      if (scan) {
        for (let y = 0; y < rows; y++) mix[y] = Math.min(seq, pr[y]!);
        progress = mix;
      }
      drawBits(ctx, bits, order, { cell, progress, negative, ...(erodes ? { wear } : {}) });
    };

    const build = () => {
      cell = cellSizeFor(window.innerWidth);
      const w = el.clientWidth;
      cols = Math.max(8, Math.floor(w / cell));
      rows = Math.max(3, Math.round(textBlockHeight(text, DISPLAY_FONT, cols * cell) / cell));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.style.width = `${cols * cell}px`;
      cv.style.height = `${rows * cell}px`;
      cv.width = cols * cell * dpr;
      cv.height = rows * cell * dpr;
      bits = blockifyText(text, DISPLAY_FONT, cols, rows);
      order = fallOrder(cols, rows, 13);
      pr = new Float32Array(rows).fill(1);
      mix = new Float32Array(rows);
      wear = new Float32Array(cols * rows);
      dirty = scan;
    };

    // Une rangee est lue quand la ligne rouge l'a depassee de SCAN_BAND cellules ;
    // sous la ligne elle tient ; entre les deux, fallOrder decide bloc par bloc.
    const readScan = () => {
      const top = cv.getBoundingClientRect().top;
      const line = scanLineTop(
        cell,
        window.scrollY,
        window.innerHeight,
        document.body.scrollHeight,
      );
      for (let y = 0; y < rows; y++)
        pr[y] = clamp01((top + y * cell - line) / (SCAN_BAND * cell) + 1);
    };

    const tick = (t: number) => {
      raf = 0;
      if (dead) return;
      let busy = false;
      if (phase >= 0 && phase < phases.length) {
        const ph = phases[phase]!;
        const k = Math.min(1, (t - t0) / ph.d);
        seq = ph.from + (ph.to - ph.from) * k;
        if (k >= 1) {
          phase++;
          t0 = t;
        }
        busy = phase < phases.length;
      }
      if (dirty) {
        dirty = false;
        readScan();
      }
      if (erodes && order) {
        if (hot) {
          erode(wear, order, cols, rows, hot.x, hot.y, WEAR_R, WEAR_STEP);
          busy = true;
        } else if (healT0 >= 0) {
          const k = Math.min(1, (t - healT0) / HEAL_MS);
          heal(wear, order, k);
          if (k >= 1) healT0 = -1;
          else busy = true;
        }
      }
      paint();
      if (busy) schedule();
    };

    const onPointerMove = (ev: PointerEvent) => {
      const r = cv.getBoundingClientRect();
      hot = {
        x: Math.floor(((ev.clientX - r.left) / r.width) * cols),
        y: Math.floor(((ev.clientY - r.top) / r.height) * rows),
      };
      healT0 = -1;
      schedule();
    };
    const onPointerLeave = () => {
      hot = null;
      healT0 = performance.now();
      schedule();
    };
    if (erodes) {
      cv.addEventListener("pointermove", onPointerMove);
      cv.addEventListener("pointerleave", onPointerLeave);
    }

    const start = () => {
      build();
      if (!reduced) {
        phase = 0;
        t0 = performance.now();
      }
      schedule();
    };

    if (document.fonts?.ready) document.fonts.ready.then(start);
    else start();

    // onglet cache : la boucle s'arrete, les horloges de phase reprennent la ou elles etaient
    let hiddenAt = -1;
    const onVisible = () => {
      if (document.hidden) {
        hiddenAt = performance.now();
        cancelAnimationFrame(raf);
        raf = 0;
      } else {
        if (hiddenAt >= 0) {
          const gap = performance.now() - hiddenAt;
          t0 += gap;
          if (healT0 >= 0) healT0 += gap;
          hiddenAt = -1;
        }
        schedule();
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    const onScroll = () => {
      dirty = true;
      schedule();
    };
    // hors ecran, la ligne rouge n'a rien a lire : aucune ecoute
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          window.addEventListener("scroll", onScroll, { passive: true });
          window.addEventListener("resize", onScroll);
          onScroll();
        } else {
          window.removeEventListener("scroll", onScroll);
          window.removeEventListener("resize", onScroll);
        }
      }
    });
    if (scan) io.observe(el);

    const ro = new ResizeObserver(() => {
      build();
      schedule();
    });
    ro.observe(el);

    return () => {
      dead = true;
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      cv.removeEventListener("pointermove", onPointerMove);
      cv.removeEventListener("pointerleave", onPointerLeave);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [text, loop, drive, erodible, negative]);

  return (
    <div ref={wrap} className={className}>
      <h1 className="sr-only">{text}</h1>
      <canvas ref={canvas} className="block" aria-hidden="true" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Fond de l'index : l'image du projet survole se compose en negatif   */
/* ------------------------------------------------------------------ */

export function BlockBackdrop({ src }: { src: string | null }) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = wrap.current;
    const cv = canvas.current;
    if (!el || !cv) return;
    let raf = 0;
    let dead = false;
    let bits: Bits | null = null;
    let order: Float32Array | null = null;
    let cell = cellSizeFor(window.innerWidth);
    let cols = 0;
    let rows = 0;
    let progress = 0;

    const size = () => {
      cell = cellSizeFor(window.innerWidth);
      cols = Math.max(4, Math.ceil(el.clientWidth / cell));
      rows = Math.max(4, Math.ceil(el.clientHeight / cell));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.style.width = `${cols * cell}px`;
      cv.style.height = `${rows * cell}px`;
      cv.width = cols * cell * dpr;
      cv.height = rows * cell * dpr;
    };

    const paint = () => {
      const ctx = cv.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      ctx.scale(dpr, dpr);
      if (!bits || !order) {
        ctx.fillStyle = "#000000";
        ctx.fillRect(0, 0, cols * cell, rows * cell);
        return;
      }
      drawBits(ctx, bits, order, { cell, progress, negative: true });
    };

    size();

    const animate = (target: number) => {
      cancelAnimationFrame(raf);
      if (prefersReducedMotion()) {
        progress = target;
        paint();
        return;
      }
      const from = progress;
      const t0 = performance.now();
      const dur = 700;
      const step = (t: number) => {
        if (dead) return;
        const k = Math.min(1, (t - t0) / dur);
        progress = from + (target - from) * k;
        paint();
        if (k < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    };

    if (!src) {
      animate(0);
    } else {
      const img = new Image();
      img.onload = () => {
        if (dead) return;
        size();
        bits = blockifyImage(img, cols, rows, 0.45);
        order = fallOrder(cols, rows, cols + 3);
        progress = 0;
        animate(1);
      };
      img.src = src;
    }

    const ro = new ResizeObserver(() => {
      size();
      paint();
    });
    ro.observe(el);

    return () => {
      dead = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [src]);

  return (
    <div ref={wrap} className="absolute inset-0 overflow-hidden bg-black" aria-hidden="true">
      <canvas ref={canvas} className="block" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Ligne rouge : tete de lecture, unique element colore du site        */
/* ------------------------------------------------------------------ */

export function ScanLine() {
  const [top, setTop] = useState(0);

  useEffect(() => {
    const cell = cellSizeFor(window.innerWidth);
    let raf = 0;
    const update = () => {
      raf = 0;
      setTop(scanLineTop(cell, window.scrollY, window.innerHeight, document.body.scrollHeight));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="mire-keep pointer-events-none fixed left-0 z-[130] h-[10px] w-full bg-mire-red"
      style={{ top }}
    />
  );
}
