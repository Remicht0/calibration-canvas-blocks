import { useCallback, useEffect, useRef, useState } from "react";
import { cellSizeFor, fallOrder, otsuThreshold, prefersReducedMotion } from "@/lib/mire";
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
  gris: "Lecture en gris, paliers quantifiés.",
  brut: "Lecture brute, mosaïque couleur, un bloc par pixel.",
};

const CYCLE: BitMode[] = ["bin", "gris", "brut"];

type Tune = { threshold: number; levels: number; gamma: number };

/* Crans de reglage : seuil par 0,05 entre 0,20 et 0,70, paliers entiers de 2 a 8. */
const clampTune = (t: Tune): Tune => ({
  threshold: Math.min(0.7, Math.max(0.2, Math.round(t.threshold * 20) / 20)),
  levels: Math.min(8, Math.max(2, Math.round(t.levels))),
  gamma: t.gamma,
});

const frNumber = (v: number) => v.toFixed(2).replace(".", ",");

type KeyLike = {
  key: string;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  preventDefault: () => void;
};

/* ------------------------------------------------------------------ */
/* Media hybride : photo ou video reduite a la grille de blocs.         */
/* Trois lectures (BIN / GRIS / BRUT), seuil et paliers reglables,      */
/* loupe de matiere au survol (souris) ou a l'appui long (tactile).     */
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
  onSample,
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
  /** Trame echantillonnee, pour un instrument externe (video : au plus toutes les 600 ms) */
  onSample?: (s: Sampled) => void;
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
  const redraw = useRef<() => void>(() => {});
  const auto = useRef<() => void>(() => {});
  const sampleRef = useRef<((s: Sampled) => void) | undefined>(onSample);
  sampleRef.current = onSample;
  // reglages lus par draw() sans relancer l'effet : un changement redessine, ne refait pas tomber
  const tune = useRef<Tune>({ threshold, levels, gamma });
  const [shown, setShown] = useState<Tune>(tune.current);
  // survol de la planche : les raccourcis - / + / A s'appliquent sans focus
  const hovered = useRef(false);
  const figure = useRef<HTMLElement>(null);
  // taux d'encrage mesure sur la trame, en pour cent
  const [ink, setInk] = useState<number | null>(null);
  const measure = useRef<() => void>(() => {});
  // pointeur grossier : la loupe s'ouvre a l'appui long, l'etiquette le dit
  const [coarse, setCoarse] = useState(false);
  useEffect(() => {
    setCoarse(window.matchMedia("(pointer: coarse)").matches);
  }, []);

  const apply = useCallback((m: BitMode) => {
    modeRef.current = m;
    setMode(m);
    measure.current();
  }, []);

  const setTune = useCallback((patch: Partial<Tune>) => {
    const next = clampTune({ ...tune.current, ...patch });
    tune.current = next;
    setShown(next);
    redraw.current();
    measure.current();
  }, []);

  // seuil pilote de l'exterieur (instrument) : resynchronise le ref, redessine en place
  useEffect(() => {
    if (tune.current.threshold !== threshold) setTune({ threshold });
  }, [threshold, setTune]);

  const step = useCallback(
    (dir: -1 | 1) => {
      const m = modeRef.current;
      if (m === "bin") setTune({ threshold: tune.current.threshold + dir * 0.05 });
      else if (m === "gris") setTune({ levels: tune.current.levels + dir });
    },
    [setTune],
  );

  const shortcut = useCallback(
    (e: KeyLike) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (document.documentElement.classList.contains("mire-modal")) return;
      const m = modeRef.current;
      if (m === "brut") return;
      if (e.key === "-") step(-1);
      else if (e.key === "+" || e.key === "=") step(1);
      else if ((e.key === "a" || e.key === "A") && m === "bin") auto.current();
      else return;
      e.preventDefault();
    },
    [step],
  );

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
    const onKey = (e: KeyboardEvent) => {
      if (!hovered.current) return;
      // la figure focalisee recoit deja l'evenement par onKeyDown
      if (figure.current?.contains(e.target as Node)) return;
      shortcut(e);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shortcut]);

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
      const v = Math.round(inkRatio(data, modeRef.current, tune.current) * 100);
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
        ...tune.current,
        lens,
      });
    };
    redraw.current = draw;

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
      if (data) sampleRef.current?.(data);
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
      const frame = (t: number) => {
        if (dead || !visible) return;
        progress = reduced ? 1 : Math.min(1, (t - t0) / 1000);
        const v = media instanceof HTMLVideoElement ? media : null;
        const live = v !== null && playingRef.current;
        if (v && live && isReady(v)) {
          data = sample(v, cols, rows);
          if (t - inkAt > 600) {
            inkAt = t;
            measure.current();
            if (data) sampleRef.current?.(data);
          }
        }
        draw();
        if (progress < 1 || live) raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
    };
    restart.current = compose;

    // seuil d'Otsu sur la trame courante ; sur une image plate il tombe sur une borne, affichee telle quelle
    auto.current = () => {
      if (!data) return;
      setTune({ threshold: otsuThreshold(data.lum, 0.2, 0.7) });
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

    // loupe : un seul dessin par image, meme si le pointeur bouge plus vite
    let drawRaf = 0;
    const requestDraw = () => {
      if (drawRaf) return;
      drawRaf = requestAnimationFrame(() => {
        drawRaf = 0;
        if (progress > 0 && !(media instanceof HTMLVideoElement && playingRef.current)) draw();
      });
    };
    const lift = Math.ceil(lensRadius + 1);
    const setLens = (ev: PointerEvent, touch: boolean) => {
      const r = cv.getBoundingClientRect();
      const x = Math.floor(((ev.clientX - r.left) / r.width) * cols);
      let y = Math.floor(((ev.clientY - r.top) / r.height) * rows);
      // tactile : le disque se pose au-dessus du doigt, jamais dessous
      if (touch) y = Math.max(Math.ceil(lensRadius), y - lift);
      lens = {
        x: Math.min(cols - 1, Math.max(0, x)),
        y: Math.min(rows - 1, Math.max(0, y)),
        r: lensRadius,
      };
    };

    // appui long tactile : 220 ms sans bouger de plus de 6 px, sinon la page defile
    let engaged = false;
    let pressTimer = 0;
    let press: { id: number; x: number; y: number } | null = null;
    const disarm = () => {
      clearTimeout(pressTimer);
      pressTimer = 0;
      press = null;
    };
    const onDown = (ev: PointerEvent) => {
      if (ev.pointerType !== "touch") return;
      disarm();
      press = { id: ev.pointerId, x: ev.clientX, y: ev.clientY };
      pressTimer = window.setTimeout(() => {
        pressTimer = 0;
        engaged = true;
        try {
          cv.setPointerCapture(ev.pointerId);
        } catch {
          /* pointeur deja releve */
        }
        navigator.vibrate?.(8);
        setLens(ev, true);
        requestDraw();
      }, 220);
    };
    const onMove = (ev: PointerEvent) => {
      if (ev.pointerType === "touch") {
        if (engaged) {
          setLens(ev, true);
          requestDraw();
        } else if (
          press &&
          Math.max(Math.abs(ev.clientX - press.x), Math.abs(ev.clientY - press.y)) > 6
        ) {
          disarm();
        }
        return;
      }
      setLens(ev, false);
      requestDraw();
    };
    const onUp = (ev: PointerEvent) => {
      if (ev.pointerType !== "touch") return;
      disarm();
      engaged = false;
      lens = null;
      requestDraw();
    };
    const onTouchMove = (ev: TouchEvent) => {
      if (engaged) ev.preventDefault();
    };
    const onEnter = () => {
      hovered.current = true;
    };
    const onLeave = (ev: PointerEvent) => {
      hovered.current = false;
      if (ev.pointerType === "touch") return;
      lens = null;
      requestDraw();
    };
    cv.addEventListener("pointerenter", onEnter);
    cv.addEventListener("pointerdown", onDown);
    cv.addEventListener("pointermove", onMove);
    cv.addEventListener("pointerup", onUp);
    cv.addEventListener("pointercancel", onUp);
    cv.addEventListener("pointerleave", onLeave);
    cv.addEventListener("touchmove", onTouchMove, { passive: false });

    const ro = new ResizeObserver(() => build());
    ro.observe(el);

    return () => {
      dead = true;
      disarm();
      cancelAnimationFrame(raf);
      cancelAnimationFrame(scrollRaf);
      cancelAnimationFrame(drawRaf);
      window.removeEventListener("scroll", onScroll);
      io.disconnect();
      ro.disconnect();
      cv.removeEventListener("pointerenter", onEnter);
      cv.removeEventListener("pointerdown", onDown);
      cv.removeEventListener("pointermove", onMove);
      cv.removeEventListener("pointerup", onUp);
      cv.removeEventListener("pointercancel", onUp);
      cv.removeEventListener("pointerleave", onLeave);
      cv.removeEventListener("touchmove", onTouchMove);
      if (media instanceof HTMLVideoElement) media.pause();
      mediaRef.current = null;
      hovered.current = false;
    };
  }, [src, ratio, lensRadius, video, drive, setTune]);

  const spokenTune =
    mode === "bin"
      ? `Seuil ${frNumber(shown.threshold)}, `
      : mode === "gris"
        ? `Paliers ${shown.levels}, `
        : "";
  const spokenInk = ink !== null && !video ? `encrage ${ink} %.` : "";

  return (
    <figure
      ref={figure}
      tabIndex={0}
      onKeyDown={shortcut}
      className={`min-w-0 max-w-full ${className}`}
    >
      <div ref={wrap} role="img" aria-label={alt} className="max-w-full">
        <canvas
          ref={canvas}
          className="block max-w-full touch-pan-y select-none"
          style={{ WebkitTouchCallout: "none" }}
        />
      </div>
      {controls && (
        <figcaption className="u-mono mt-[3px] flex flex-wrap items-center justify-between gap-x-cell gap-y-0 border-[3px] border-black px-[6px]">
          <span className="flex min-h-cell2 min-w-0 items-center gap-[6px]">
            {label && <span className="min-w-0 truncate">{label}</span>}
            {ink !== null && (
              <span className="flex shrink-0 items-center gap-[4px]">
                <span>ENCRE</span>
                <BitReadout text={`${ink}%`} />
              </span>
            )}
          </span>
          {mode !== "brut" && (
            <span
              role="group"
              aria-label="Réglage de la planche"
              className="flex min-h-cell2 basis-full items-center justify-end gap-[6px] sm:flex-1 sm:basis-auto"
            >
              <span>{mode === "bin" ? "SEUIL" : "PALIERS"}</span>
              <BitReadout
                text={mode === "bin" ? shown.threshold.toFixed(2) : String(shown.levels)}
              />
              <button
                type="button"
                onClick={() => step(-1)}
                aria-label={mode === "bin" ? "Baisser le seuil" : "Moins de paliers"}
                className="u-mono u-bloc min-w-cell2 px-[6px]"
              >
                -
              </button>
              <button
                type="button"
                onClick={() => step(1)}
                aria-label={mode === "bin" ? "Monter le seuil" : "Plus de paliers"}
                className="u-mono u-bloc min-w-cell2 px-[6px]"
              >
                +
              </button>
              {mode === "bin" && (
                <button
                  type="button"
                  onClick={() => auto.current()}
                  aria-label="Seuil automatique (Otsu)"
                  className="u-mono u-bloc px-[6px]"
                >
                  AUTO
                </button>
              )}
            </span>
          )}
          <span
            role="group"
            aria-label="Mode de lecture"
            className="ml-auto flex min-h-cell2 flex-1 items-center justify-end gap-[6px] sm:flex-none"
          >
            <span className="hidden sm:inline">
              {coarse ? "APPUI LONG = LOUPE" : video ? "VIDEO" : "PHOTO"}
            </span>
            {video && (
              <button
                type="button"
                onClick={togglePlay}
                aria-pressed={!playing}
                aria-label={playing ? "Pause de la vidéo" : "Lecture de la vidéo"}
                className="u-mono u-bloc px-[6px]"
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
                className="u-mono u-bloc px-[6px]"
              >
                {m.toUpperCase()}
              </button>
            ))}
          </span>
        </figcaption>
      )}
      <span className="sr-only" aria-live="polite">
        {SPOKEN[mode]} {spokenTune}
        {spokenInk}
      </span>
    </figure>
  );
}
