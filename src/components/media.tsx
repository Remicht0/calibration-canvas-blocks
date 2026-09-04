import { useCallback, useEffect, useRef, useState } from "react";
import { cellSizeFor, fallOrder, prefersReducedMotion } from "@/lib/mire";
import {
  inkRatio,
  isReady,
  isVideo,
  paintBlocks,
  sample,
  type BitMode,
  type Sampled,
  type Source,
} from "@/lib/bitmap";
import { BitReadout } from "@/components/readout";

/* Hors mire : ce que le lecteur d'ecran entend, en francais accentue. */
const SPOKEN: Record<BitMode, string> = {
  bin: "Lecture binaire, seuil dur 1 bit.",
  gris: "Lecture en gris, cinq paliers quantifiés.",
  brut: "Lecture brute, mosaïque couleur, un bloc par pixel.",
};

const CYCLE: BitMode[] = ["bin", "gris", "brut"];

/* ------------------------------------------------------------------ */
/* Media hybride : photo ou video reduite a la grille de blocs.         */
/* Trois lectures (BIN / GRIS / BRUT) + loupe de matiere au survol.     */
/* ------------------------------------------------------------------ */

export function HybridMedia({
  src,
  alt,
  label,
  ratio = 0.62,
  mode: initial = "gris",
  levels = 5,
  gamma = 0.85,
  threshold = 0.45,
  lensRadius = 3.5,
  drive = "time",
  controls = true,
  className = "",
}: {
  src: string;
  /** Description de l'image pour les lecteurs d'ecran : francais accentue, jamais en capitales. */
  alt: string;
  /** Etiquette visible sous la planche : capitales sans accents (regle de la mire). */
  label?: string;
  ratio?: number;
  mode?: BitMode;
  levels?: number;
  gamma?: number;
  threshold?: number;
  lensRadius?: number;
  /** time : la planche se compose a l'entree en ecran ; scroll : la chute suit le defilement */
  drive?: "time" | "scroll";
  controls?: boolean;
  className?: string;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const modeRef = useRef<BitMode>(initial);
  const [mode, setMode] = useState<BitMode>(initial);
  const video = isVideo(src);
  // video : lecture automatique, sauf si le systeme demande moins de mouvement
  const playingRef = useRef(true);
  const [playing, setPlaying] = useState(true);
  const mediaRef = useRef<Source | null>(null);
  const restart = useRef<() => void>(() => {});
  // taux d'encrage mesure sur la trame, en pour cent
  const [ink, setInk] = useState<number | null>(null);
  const measure = useRef<() => void>(() => {});

  const apply = useCallback((m: BitMode) => {
    modeRef.current = m;
    setMode(m);
    measure.current();
  }, []);

  const togglePlay = useCallback(() => {
    const v = mediaRef.current;
    if (!(v instanceof HTMLVideoElement)) return;
    const next = !playingRef.current;
    playingRef.current = next;
    setPlaying(next);
    if (next) {
      void v.play().catch(() => {});
      restart.current();
    } else {
      v.pause();
    }
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
    const reduced = prefersReducedMotion();
    const scrolled = drive === "scroll" && !video && !reduced;
    let progress = reduced ? 1 : 0;
    let visible = false;
    let lens: { x: number; y: number; r: number } | null = null;
    let lastInk = -1;
    let inkAt = 0;

    measure.current = () => {
      if (!data) return;
      const v = Math.round(inkRatio(data, modeRef.current, { threshold, levels, gamma }) * 100);
      if (v !== lastInk) {
        lastInk = v;
        setInk(v);
      }
    };

    if (video && reduced) {
      playingRef.current = false;
      setPlaying(false);
    }

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
      if (scrolled) progress = scrollProgress();
      draw();
      measure.current();
    };

    // chute liee au defilement : 0 quand le haut de la planche entre par le bas,
    // 1 quand il atteint 45 % de la hauteur d'ecran ; a rebours en remontant
    const scrollProgress = () => {
      const r = cv.getBoundingClientRect();
      const h = window.innerHeight;
      return Math.min(1, Math.max(0, (h - r.top) / (h * 0.55)));
    };
    let scrollRaf = 0;
    const onScroll = () => {
      if (scrollRaf) return;
      scrollRaf = requestAnimationFrame(() => {
        scrollRaf = 0;
        progress = scrollProgress();
        draw();
      });
    };

    const compose = () => {
      cancelAnimationFrame(raf);
      if (scrolled) {
        progress = scrollProgress();
        draw();
        return;
      }
      const t0 = performance.now() - progress * 1000;
      const step = (t: number) => {
        if (dead || !visible) return;
        progress = reduced ? 1 : Math.min(1, (t - t0) / 1000);
        const v = media instanceof HTMLVideoElement ? media : null;
        const live = v !== null && playingRef.current;
        if (v && live && isReady(v)) {
          data = sample(v, cols, rows);
          if (t - inkAt > 600) {
            inkAt = t;
            measure.current();
          }
        }
        draw();
        if (progress < 1 || live) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    };
    restart.current = compose;

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
        mediaRef.current = v;
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
        mediaRef.current = img;
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
            if (media instanceof HTMLVideoElement && playingRef.current)
              void media.play().catch(() => {});
            if (scrolled) window.addEventListener("scroll", onScroll, { passive: true });
            compose();
          } else {
            cancelAnimationFrame(raf);
            if (scrolled) window.removeEventListener("scroll", onScroll);
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
      if (progress >= 1 && !(media instanceof HTMLVideoElement && playingRef.current)) draw();
    };
    const onLeave = () => {
      lens = null;
      if (progress >= 1 && !(media instanceof HTMLVideoElement && playingRef.current)) draw();
    };
    cv.addEventListener("pointermove", onMove);
    cv.addEventListener("pointerleave", onLeave);

    const ro = new ResizeObserver(() => build());
    ro.observe(el);

    return () => {
      dead = true;
      cancelAnimationFrame(raf);
      cancelAnimationFrame(scrollRaf);
      window.removeEventListener("scroll", onScroll);
      io.disconnect();
      ro.disconnect();
      cv.removeEventListener("pointermove", onMove);
      cv.removeEventListener("pointerleave", onLeave);
      if (media instanceof HTMLVideoElement) media.pause();
      mediaRef.current = null;
    };
  }, [src, ratio, levels, gamma, threshold, lensRadius, video, drive]);

  return (
    <figure className={`min-w-0 max-w-full ${className}`}>
      <div ref={wrap} role="img" aria-label={alt} className="max-w-full">
        <canvas ref={canvas} className="block max-w-full" />
      </div>
      {controls && (
        <figcaption className="u-mono mt-[3px] flex flex-wrap items-center justify-between gap-x-cell gap-y-[3px] border-[3px] border-black px-[6px] py-[3px]">
          <span className="flex min-w-0 items-center gap-[6px]">
            {label && <span className="min-w-0 truncate">{label}</span>}
            {ink !== null && (
              <span className="flex shrink-0 items-center gap-[4px]">
                <span>ENCRE</span>
                <BitReadout text={`${ink}%`} unit={2} />
              </span>
            )}
          </span>
          <span
            role="group"
            aria-label="Mode de lecture"
            className="flex flex-1 items-center justify-end gap-[6px] sm:flex-none"
          >
            <span className="hidden sm:inline">{video ? "VIDEO" : "PHOTO"}</span>
            {video && (
              <button
                type="button"
                onClick={togglePlay}
                aria-pressed={!playing}
                aria-label={playing ? "Pause de la vidéo" : "Lecture de la vidéo"}
                className={`border-[3px] border-black px-[6px] py-[1px] ${
                  playing ? "bg-white text-black" : "bg-black text-white"
                }`}
              >
                {playing ? "PAUSE" : "LECTURE"}
              </button>
            )}
            {CYCLE.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => apply(m)}
                aria-pressed={mode === m}
                aria-label={`${m.toUpperCase()} : ${SPOKEN[m]}`}
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
      <span className="sr-only" aria-live="polite">
        {SPOKEN[mode]}
      </span>
    </figure>
  );
}
