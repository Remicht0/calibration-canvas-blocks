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
import { Bloc } from "@/components/bloc";
import { PleinCadre } from "@/components/plein";
import { BitReadout } from "@/components/readout";

/* Hors mire : ce que le lecteur d'ecran entend, en francais accentue. */
const SPOKEN: Record<BitMode, string> = {
  bin: "Lecture binaire, seuil dur 1 bit.",
  gris: "Lecture en gris, paliers quantifiés.",
  brut: "Lecture brute, mosaïque couleur, un bloc par pixel.",
};

const CYCLE: BitMode[] = ["bin", "gris", "brut"];

export type Tune = { threshold: number; levels: number; gamma: number };

/* Crans de reglage : seuil par 0,05 entre 0,20 et 0,70, paliers entiers de 2 a 8. */
const clampTune = (t: Tune): Tune => ({
  threshold: Math.min(0.7, Math.max(0.2, Math.round(t.threshold * 20) / 20)),
  levels: Math.min(8, Math.max(2, Math.round(t.levels))),
  gamma: t.gamma,
});

const frNumber = (v: number) => v.toFixed(2).replace(".", ",");

/** Evenement emis par le plein cadre : a true les planches de la page s'arretent, a false elles reprennent. */
export const MODAL_EVENT = "mire:modal";

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
/* loupe de matiere au survol (souris) ou a l'appui long (tactile),     */
/* plein cadre : la meme source re-echantillonnee a la taille de        */
/* l'ecran (la cellule ne change pas, l'image gagne des colonnes).      */
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
  fit = "ratio",
  phase = "in",
  controls = true,
  onSample,
  onDissolved,
  onFull,
  className = "",
}: {
  src: string;
  /** Description de l'image pour les lecteurs d'ecran : francais accentue, jamais en capitales. */
  alt: string;
  /** Etiquette visible sous la planche : capitales sans accents (regle de la mire). */
  label?: string | undefined;
  ratio?: number;
  mode?: BitMode;
  levels?: number;
  gamma?: number;
  threshold?: number;
  lensRadius?: number | undefined;
  /** time : la planche se compose a l'entree en ecran ; scroll : la chute suit le defilement */
  drive?: "time" | "scroll";
  /** ratio : hauteur = colonnes x ratio ; viewport : la planche remplit son conteneur, en colonnes et en rangees */
  fit?: "ratio" | "viewport";
  /** out : les blocs tombent (progress 1 -> 0 en 600 ms, meme ordre), puis onDissolved */
  phase?: "in" | "out";
  controls?: boolean;
  /** Trame echantillonnee, pour un instrument externe (video : au plus toutes les 600 ms) */
  onSample?: (s: Sampled) => void;
  onDissolved?: () => void;
  /** Appele a l'ouverture du plein cadre (bouton PLEIN ou touche F) */
  onFull?: () => void;
  className?: string;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const modeRef = useRef<BitMode>(initial);
  const [mode, setMode] = useState<BitMode>(initial);
  const video = isVideo(src);
  const viewport = fit === "viewport";
  // video : lecture automatique, sauf si le systeme demande moins de mouvement
  const playingRef = useRef(true);
  const [playing, setPlaying] = useState(true);
  const mediaRef = useRef<Source | null>(null);
  const restart = useRef<() => void>(() => {});
  const dissolve = useRef<() => void>(() => {});
  const redraw = useRef<() => void>(() => {});
  const auto = useRef<() => void>(() => {});
  const sampleRef = useRef<((s: Sampled) => void) | undefined>(onSample);
  sampleRef.current = onSample;
  const dissolvedRef = useRef<(() => void) | undefined>(onDissolved);
  dissolvedRef.current = onDissolved;
  const fullRef = useRef<(() => void) | undefined>(onFull);
  fullRef.current = onFull;
  // reglages lus par draw() sans relancer l'effet : un changement redessine, ne refait pas tomber
  const tune = useRef<Tune>({ threshold, levels, gamma });
  const [shown, setShown] = useState<Tune>(tune.current);
  // survol de la planche : les raccourcis - / + / A / F s'appliquent sans focus
  const hovered = useRef(false);
  const figure = useRef<HTMLElement>(null);
  // taux d'encrage mesure sur la trame, en pour cent
  const [ink, setInk] = useState<number | null>(null);
  // format de la planche en cellules, pose a chaque composition
  const [dims, setDims] = useState<{ cols: number; rows: number } | null>(null);
  const measure = useRef<() => void>(() => {});
  // pointeur grossier : la loupe s'ouvre a l'appui long, l'etiquette le dit
  const [coarse, setCoarse] = useState(false);
  useEffect(() => {
    setCoarse(window.matchMedia("(pointer: coarse)").matches);
  }, []);
  // plein cadre : monte par cette planche, avec ses reglages et son mode courants
  const [full, setFull] = useState(false);
  const wasFull = useRef(false);
  const fullBtn = useRef<HTMLButtonElement>(null);
  const canFull = controls && !viewport;

  // changement de mode : la trame est redessinee en place, les blocs poses ne retombent pas
  const apply = useCallback((m: BitMode) => {
    modeRef.current = m;
    setMode(m);
    redraw.current();
    measure.current();
  }, []);

  const setTune = useCallback((patch: Partial<Tune>) => {
    const next = clampTune({ ...tune.current, ...patch });
    tune.current = next;
    setShown(next);
    redraw.current();
    measure.current();
  }, []);

  const step = useCallback(
    (dir: -1 | 1) => {
      const m = modeRef.current;
      if (m === "bin") setTune({ threshold: tune.current.threshold + dir * 0.05 });
      else if (m === "gris") setTune({ levels: tune.current.levels + dir });
    },
    [setTune],
  );

  const openFull = useCallback(() => {
    if (!canFull) return;
    wasFull.current = true;
    setFull(true);
    fullRef.current?.();
  }, [canFull]);

  // a la fermeture, le focus revient au bouton PLEIN : la page n'est plus inerte
  useEffect(() => {
    if (full || !wasFull.current) return;
    wasFull.current = false;
    fullBtn.current?.focus();
  }, [full]);

  const shortcut = useCallback(
    (e: KeyLike) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      // sous un masque, seule la planche du plein cadre garde ses raccourcis
      if (!viewport && document.documentElement.classList.contains("mire-modal")) return;
      const m = modeRef.current;
      if ((e.key === "f" || e.key === "F") && canFull) openFull();
      else if (m === "brut") return;
      else if (e.key === "-") step(-1);
      else if (e.key === "+" || e.key === "=") step(1);
      else if ((e.key === "a" || e.key === "A") && m === "bin") auto.current();
      else return;
      e.preventDefault();
    },
    [step, openFull, canFull, viewport],
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
    if (phase === "out") dissolve.current();
  }, [phase]);

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
    // un plein cadre est ouvert au-dessus de la page : la planche s'arrete
    let halted = false;
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
      // viewport : la cellule reste la meme, la planche gagne des colonnes et des rangees
      rows = viewport
        ? Math.max(4, Math.floor(el.clientHeight / cell))
        : Math.max(4, Math.round(cols * ratio));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.style.width = `${cols * cell}px`;
      cv.style.height = `${rows * cell}px`;
      cv.width = cols * cell * dpr;
      cv.height = rows * cell * dpr;
      order = fallOrder(cols, rows, cols * 5 + rows);
      data = sample(media, cols, rows);
      if (data) sampleRef.current?.(data);
      setDims({ cols, rows });
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

    // mene progress de from a to en dur ms, sur le meme ordre de chute ; done une fois arrive.
    // Une video continue d'etre echantillonnee tant qu'elle joue et que des blocs sont poses.
    const run = (from: number, to: number, dur: number, done?: () => void) => {
      cancelAnimationFrame(raf);
      if (scrolled) {
        progress = scrollProgress();
        draw();
        return;
      }
      const t0 = performance.now();
      let settled = false;
      const frame = (t: number) => {
        if (dead) return;
        // planche a l'arret : rien a animer, mais une dissolution demandee aboutit tout de suite
        if (!visible || halted) {
          if (!settled) {
            settled = true;
            done?.();
          }
          return;
        }
        const k = reduced || dur <= 0 ? 1 : Math.min(1, (t - t0) / dur);
        progress = from + (to - from) * k;
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
        if (k < 1) {
          raf = requestAnimationFrame(frame);
          return;
        }
        if (!settled) {
          settled = true;
          done?.();
        }
        if (live && progress > 0) raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
    };
    const compose = () => run(progress, 1, (1 - progress) * 1000);
    restart.current = compose;
    dissolve.current = () => run(progress, 0, 600, () => dissolvedRef.current?.());

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

    const resume = () => {
      if (media instanceof HTMLVideoElement && playingRef.current)
        void media.play().catch(() => {});
      if (scrolled) window.addEventListener("scroll", onScroll, { passive: true });
      compose();
    };
    const halt = () => {
      cancelAnimationFrame(raf);
      if (scrolled) window.removeEventListener("scroll", onScroll);
      if (media instanceof HTMLVideoElement) media.pause();
    };

    // Budget performance : hors viewport, le canvas et la video sont a l'arret.
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          visible = e.isIntersecting;
          if (visible) {
            if (!halted) resume();
          } else halt();
        }
      },
      { threshold: 0.12 },
    );

    // plein cadre ouvert : la page est inerte, ses planches s'arretent aussi (le plein cadre lui-meme ne s'ecoute pas)
    const onModal = (e: Event) => {
      if (viewport) return;
      halted = Boolean((e as CustomEvent<boolean>).detail);
      if (halted) halt();
      else if (visible) resume();
    };
    window.addEventListener(MODAL_EVENT, onModal);

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
      window.removeEventListener(MODAL_EVENT, onModal);
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
  }, [src, ratio, lensRadius, video, drive, viewport, setTune]);

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
      className={`min-w-0 max-w-full ${viewport ? "flex h-full min-h-0 flex-col" : ""} ${className}`}
    >
      <div
        ref={wrap}
        role="img"
        aria-label={alt}
        className={`max-w-full ${viewport ? "min-h-0 flex-1" : ""}`}
      >
        <canvas
          ref={canvas}
          className="block max-w-full touch-pan-y select-none"
          style={{ WebkitTouchCallout: "none" }}
        />
      </div>
      {controls && (
        <figcaption className="u-mono mt-[3px] flex shrink-0 flex-wrap items-center justify-between gap-x-cell gap-y-0 border-[3px] border-(--ink) px-[6px]">
          <span className="flex min-h-cell2 min-w-0 items-center gap-[6px]">
            {label && <span className="min-w-0 truncate">{label}</span>}
            {ink !== null && (
              <span className="flex shrink-0 items-center gap-[4px]">
                <span>ENCRE</span>
                <BitReadout text={`${ink}%`} />
              </span>
            )}
            {dims && (
              <span className="flex shrink-0 items-center pl-[10px]">
                <BitReadout text={`${dims.cols} X ${dims.rows}`} />
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
            {canFull && (
              <Bloc
                ref={fullBtn}
                onClick={openFull}
                aria-label="Plein cadre"
                aria-keyshortcuts="f"
                className="px-[6px]"
              >
                PLEIN<span className="hidden sm:inline">&nbsp;[F]</span>
              </Bloc>
            )}
          </span>
        </figcaption>
      )}
      <span className="sr-only" aria-live="polite">
        {SPOKEN[mode]} {spokenTune}
        {spokenInk}
      </span>
      {full && (
        <PleinCadre
          src={src}
          alt={alt}
          label={label}
          mode={mode}
          threshold={shown.threshold}
          levels={shown.levels}
          gamma={shown.gamma}
          lensRadius={lensRadius}
          onClose={() => setFull(false)}
        />
      )}
    </figure>
  );
}
