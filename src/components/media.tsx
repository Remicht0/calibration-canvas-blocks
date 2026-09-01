import { useCallback, useEffect, useRef, useState } from "react";
import { cellSizeFor, fallOrder } from "@/lib/mire";
import {
  isReady,
  isVideo,
  paintBlocks,
  sample,
  type BitMode,
  type Sampled,
  type Source,
} from "@/lib/bitmap";

const LABEL: Record<BitMode, string> = {
  bin: "BIN 1-BIT",
  gris: "GRIS 5 PALIERS",
  brut: "BRUT MOSAIQUE",
};

const CYCLE: BitMode[] = ["bin", "gris", "brut"];

/* ------------------------------------------------------------------ */
/* Media hybride : photo ou video reduite a la grille de blocs.         */
/* Trois lectures (BIN / GRIS / BRUT) + loupe de matiere au survol.     */
/* ------------------------------------------------------------------ */

export function HybridMedia({
  src,
  alt,
  ratio = 0.62,
  mode: initial = "gris",
  levels = 5,
  gamma = 0.85,
  threshold = 0.45,
  lensRadius = 3.5,
  controls = true,
  className = "",
}: {
  src: string;
  alt: string;
  ratio?: number;
  mode?: BitMode;
  levels?: number;
  gamma?: number;
  threshold?: number;
  lensRadius?: number;
  controls?: boolean;
  className?: string;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const modeRef = useRef<BitMode>(initial);
  const [mode, setMode] = useState<BitMode>(initial);
  const video = isVideo(src);

  const apply = useCallback((m: BitMode) => {
    modeRef.current = m;
    setMode(m);
  }, []);

  useEffect(() => {
    const el = wrap.current;
    const cv = canvas.current;
    if (!el || !cv) return;

    let dead = false;
    let raf = 0;
    let media: Source | null = null;
    let data: Sampled | null = null;
    let order: Float32Array = new Float32Array(0);
    let cell = cellSizeFor(window.innerWidth);
    let cols = 0;
    let rows = 0;
    let progress = 0;
    let entered = false;
    let lens: { x: number; y: number; r: number } | null = null;

    const draw = () => {
      const ctx = cv.getContext("2d");
      if (!ctx || !data) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      paintBlocks(ctx, data, {
        cell,
        mode: modeRef.current,
        progress,
        order,
        threshold,
        levels,
        gamma,
        lens,
      });
    };

    const build = () => {
      if (!media || !isReady(media)) return;
      cell = cellSizeFor(window.innerWidth);
      cols = Math.max(6, Math.floor(el.clientWidth / cell));
      rows = Math.max(4, Math.round(cols * ratio));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.style.width = `${cols * cell}px`;
      cv.style.height = `${rows * cell}px`;
      cv.width = cols * cell * dpr;
      cv.height = rows * cell * dpr;
      order = fallOrder(cols, rows, cols * 5 + rows);
      data = sample(media, cols, rows);
      draw();
    };

    const compose = () => {
      const t0 = performance.now() - progress * 1000;
      const step = (t: number) => {
        if (dead || !visible) return;
        progress = Math.min(1, (t - t0) / 1000);
        if (media instanceof HTMLVideoElement && isReady(media))
          data = sample(media, cols, rows);
        draw();
        if (progress < 1 || media instanceof HTMLVideoElement)
          raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    };

    if (video) {
      const v = document.createElement("video");
      v.src = src;
      v.muted = true;
      v.loop = true;
      v.playsInline = true;
      v.crossOrigin = "anonymous";
      v.onloadeddata = () => {
        if (dead) return;
        media = v;
        build();
        io.observe(el);
      };
      media = null;
    } else {
      const img = new Image();
      img.decoding = "async";
      img.onload = () => {
        if (dead) return;
        media = img;
        build();
        io.observe(el);
      };
      img.src = src;
    }

    // Budget performance : hors viewport, le canvas et la video sont a l'arret.
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          visible = e.isIntersecting;
          if (visible) {
            entered = true;
            if (media instanceof HTMLVideoElement) void media.play().catch(() => {});
            compose();
          } else {
            cancelAnimationFrame(raf);
            if (media instanceof HTMLVideoElement) media.pause();
          }
        }
      },
      { threshold: 0.12 },
    );


    const onMove = (ev: PointerEvent) => {
      const r = cv.getBoundingClientRect();
      lens = {
        x: Math.floor(((ev.clientX - r.left) / r.width) * cols),
        y: Math.floor(((ev.clientY - r.top) / r.height) * rows),
        r: lensRadius,
      };
      if (progress >= 1 && !(media instanceof HTMLVideoElement)) draw();
    };
    const onLeave = () => {
      lens = null;
      if (progress >= 1 && !(media instanceof HTMLVideoElement)) draw();
    };
    cv.addEventListener("pointermove", onMove);
    cv.addEventListener("pointerleave", onLeave);

    const ro = new ResizeObserver(() => build());
    ro.observe(el);

    return () => {
      dead = true;
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      cv.removeEventListener("pointermove", onMove);
      cv.removeEventListener("pointerleave", onLeave);
      if (media instanceof HTMLVideoElement) media.pause();
    };
  }, [src, ratio, levels, gamma, threshold, lensRadius, video]);

  return (
    <figure className={`min-w-0 max-w-full ${className}`}>
      <div ref={wrap} role="img" aria-label={alt} className="max-w-full">
        <canvas ref={canvas} className="block max-w-full" />
      </div>
      {controls && (
        <figcaption className="u-mono mt-[3px] flex flex-wrap items-center justify-between gap-x-cell gap-y-[3px] border-[3px] border-black px-[6px] py-[3px]">
          <span className="min-w-0 truncate">{alt}</span>
          <span className="flex flex-1 items-center justify-end gap-[6px] sm:flex-none">
            <span className="hidden sm:inline">{video ? "VIDEO" : "PHOTO"}</span>
            {CYCLE.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => apply(m)}
                aria-pressed={mode === m}
                className={`border-[3px] border-black px-[6px] py-[1px] ${
                  mode === m ? "bg-black text-white" : "bg-white text-black"
                }`}
              >
                {m.toUpperCase()}
              </button>
            ))}
          </span>
        </figcaption>
      )}
      <span className="sr-only">{LABEL[mode]}</span>
    </figure>
  );
}
