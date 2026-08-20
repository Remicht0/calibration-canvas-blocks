import { useEffect, useRef, useState } from "react";
import {
  blockifyImage,
  blockifyText,
  cellSizeFor,
  drawBits,
  fallOrder,
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

export function BlockType({
  text,
  className = "",
  loop = true,
}: {
  text: string;
  className?: string;
  loop?: boolean;
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
    let raf = 0;
    let dead = false;

    const paint = (progress: number) => {
      const ctx = cv.getContext("2d");
      if (!ctx || !bits || !order) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      ctx.scale(dpr, dpr);
      drawBits(ctx, bits, order, { cell, progress });
    };

    const build = () => {
      cell = cellSizeFor(window.innerWidth);
      const w = el.clientWidth;
      const cols = Math.max(8, Math.floor(w / cell));
      const rows = Math.max(
        3,
        Math.round(textBlockHeight(text, DISPLAY_FONT, cols * cell) / cell),
      );
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.style.width = `${cols * cell}px`;
      cv.style.height = `${rows * cell}px`;
      cv.width = cols * cell * dpr;
      cv.height = rows * cell * dpr;
      bits = blockifyText(text, DISPLAY_FONT, cols, rows);
      order = fallOrder(cols, rows, 13);
    };

    // sequence : compose -> tient -> se dissout -> se recompose
    const phases = loop
      ? [
          { d: 1200, from: 0, to: 1 },
          { d: 1400, from: 1, to: 1 },
          { d: 900, from: 1, to: 0 },
          { d: 1200, from: 0, to: 1 },
        ]
      : [{ d: 1200, from: 0, to: 1 }];

    const run = () => {
      let i = 0;
      let t0 = performance.now();
      const step = (t: number) => {
        if (dead) return;
        const ph = phases[i]!;
        const k = Math.min(1, (t - t0) / ph.d);
        paint(ph.from + (ph.to - ph.from) * k);
        if (k >= 1) {
          if (i < phases.length - 1) {
            i++;
            t0 = t;
          } else return;
        }
        raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    };

    const start = () => {
      build();
      run();
    };

    if (document.fonts?.ready) document.fonts.ready.then(start);
    else start();

    const ro = new ResizeObserver(() => {
      build();
      paint(1);
    });
    ro.observe(el);

    return () => {
      dead = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [text, loop]);

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
      const max = document.body.scrollHeight - window.innerHeight;
      const p = max > 0 ? Math.min(1, window.scrollY / max) : 0;
      const span = window.innerHeight - cell * 8;
      setTop(Math.round((cell * 4 + p * span) / cell) * cell);
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
      className="pointer-events-none fixed left-0 z-50 h-[10px] w-full bg-mire-red"
      style={{ top }}
    />
  );
}
