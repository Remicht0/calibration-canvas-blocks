import { useCallback, useEffect, useId, useRef, useState } from "react";
import { cellSizeFor, fallOrder, otsuThreshold, prefersReducedMotion } from "@/lib/mire";
import {
  chargerImage,
  enFile,
  inkRatio,
  isReady,
  isVideo,
  libererImage,
  srcSize,
  paintBlocks,
  paintNet,
  sample,
  type BitMode,
  type ReadMode,
  type Sampled,
  type Source,
} from "@/lib/bitmap";
import { Bloc } from "@/components/bloc";
import { PleinCadre } from "@/components/plein";
import { BitReadout } from "@/components/readout";
import { MODAL_EVENT } from "@/lib/modal";

/* Hors mire : ce que le lecteur d'ecran entend, en francais accentue. */
const SPOKEN: Record<ReadMode, string> = {
  bin: "Lecture binaire, seuil dur 1 bit.",
  gris: "Lecture en gris, paliers quantifiés.",
  brut: "Lecture brute, mosaïque couleur, un bloc par pixel.",
  net: "Lecture nette, l'image d'origine entière, dans ses couleurs.",
};

const BLOCS: BitMode[] = ["bin", "gris", "brut"];
const AVEC_NET: ReadMode[] = [...BLOCS, "net"];

/* NET ne se mesure pas en blocs : son encrage est celui de la matiere, comme BRUT */
const inkMode = (m: ReadMode): BitMode => (m === "net" ? "brut" : m);

export type Tune = { threshold: number; levels: number; gamma: number };

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
/* et NET sur une planche de projet : l'image d'origine, nette.         */
/* Loupe de matiere au survol (souris) ou a l'appui long (tactile),     */
/* plein cadre : la meme source re-echantillonnee a la taille de        */
/* l'ecran (la cellule ne change pas, l'image gagne des colonnes).      */
/* ------------------------------------------------------------------ */

export function HybridMedia({
  src = "",
  webm,
  netSrc,
  stream = null,
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
  net = false,
  force,
  onSample,
  onDissolved,
  onFull,
  onCanvas,
  className = "",
}: {
  /** URL d'une image ou d'une video de fichier. Vide quand la source est un flux. */
  src?: string | undefined;
  /** La meme video en WebM (VP9), lue a la place du MP4 quand le navigateur la lit */
  webm?: string | undefined;
  /**
   * La meme image en plus grand, pour NET seulement : chargee au passage en NET
   * et seulement si l'ecran agrandirait la source de la page (pas sur un
   * telephone), decodee a la taille dessinee.
   */
  netSrc?: string | undefined;
  /** Source vivante (camera). La planche ne fait que la consommer : elle n'arrete jamais les pistes. */
  stream?: MediaStream | null | undefined;
  /** Description de l'image pour les lecteurs d'ecran : francais accentue, jamais en capitales. */
  alt: string;
  /** Etiquette visible sous la planche : capitales sans accents (regle de la mire). */
  label?: string | undefined;
  ratio?: number;
  mode?: ReadMode;
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
  /** Propose la lecture NET (l'image d'origine, nette) : planches de projet seulement */
  net?: boolean;
  /**
   * Lecture imposee par la page (TOUT EN NET) : la planche y passe sans annonce
   * (la page annonce son propre bouton) ; null lui rend sa lecture d'origine.
   * Le visiteur peut ensuite changer la lecture d'une seule planche.
   */
  force?: ReadMode | null | undefined;
  /** Trame echantillonnee, pour un instrument externe (video : au plus toutes les 600 ms) */
  onSample?: (s: Sampled) => void;
  onDissolved?: () => void;
  /** Appele a l'ouverture du plein cadre (bouton PLEIN ou touche F) */
  onFull?: () => void;
  /** Canvas de la planche, pour un enregistrement exterieur ; null au demontage */
  onCanvas?: ((c: HTMLCanvasElement | null) => void) | undefined;
  className?: string;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const modeRef = useRef<ReadMode>(initial);
  const [mode, setMode] = useState<ReadMode>(initial);
  const cycle = net ? AVEC_NET : BLOCS;
  // une source vivante est une video, quelle que soit l'URL : isVideo reste le test du fichier
  const live = !!stream;
  const video = live || isVideo(src);
  const viewport = fit === "viewport";
  // video : lecture automatique, sauf si le systeme demande moins de mouvement
  const playingRef = useRef(true);
  const [playing, setPlaying] = useState(true);
  const mediaRef = useRef<Source | null>(null);
  const restart = useRef<() => void>(() => {});
  const dissolve = useRef<() => void>(() => {});
  const redraw = useRef<() => void>(() => {});
  const voirNet = useRef<() => void>(() => {});
  const auto = useRef<() => void>(() => {});
  const sampleRef = useRef<((s: Sampled) => void) | undefined>(onSample);
  sampleRef.current = onSample;
  const dissolvedRef = useRef<(() => void) | undefined>(onDissolved);
  dissolvedRef.current = onDissolved;
  const fullRef = useRef<(() => void) | undefined>(onFull);
  fullRef.current = onFull;
  const canvasCb = useRef<((c: HTMLCanvasElement | null) => void) | undefined>(onCanvas);
  canvasCb.current = onCanvas;
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
  const measure = useRef<() => number | null>(() => null);
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
  // la region aria-live n'est ecrite que par une action du visiteur, jamais par une mesure
  const [announce, setAnnounce] = useState("");
  const say = useCallback(
    (m: ReadMode, t: Tune, inkNow: number | null) => {
      const tuneText =
        m === "bin"
          ? `Seuil ${frNumber(t.threshold)}, `
          : m === "gris"
            ? `Paliers ${t.levels}, `
            : "";
      const inkText = inkNow !== null && !video ? `encrage ${inkNow} %.` : "";
      setAnnounce(`${SPOKEN[m]} ${tuneText}${inkText}`);
    },
    [video],
  );

  const apply = useCallback(
    (m: ReadMode, silent = false) => {
      modeRef.current = m;
      setMode(m);
      redraw.current();
      if (m === "net") voirNet.current();
      const inkNow = measure.current();
      if (!silent) say(m, tune.current, inkNow);
    },
    [say],
  );

  // lecture imposee par la page : seulement quand elle change, jamais au montage
  // sans consigne (la planche garde alors sa lecture d'origine)
  const forced = useRef<ReadMode | null | undefined>(null);
  useEffect(() => {
    if (force === undefined || force === forced.current) return;
    forced.current = force;
    const m = force ?? initial;
    if (m === "net" && !net) return;
    if (modeRef.current !== m) apply(m, true);
  }, [force, initial, net, apply]);

  const setTune = useCallback(
    (patch: Partial<Tune>, silent = false) => {
      const next = clampTune({ ...tune.current, ...patch });
      tune.current = next;
      setShown(next);
      redraw.current();
      const inkNow = measure.current();
      if (!silent) say(modeRef.current, next, inkNow);
    },
    [say],
  );

  // seuil pilote de l'exterieur (instrument) : resynchronise le ref, redessine en place, sans annonce
  useEffect(() => {
    if (tune.current.threshold !== threshold) setTune({ threshold }, true);
  }, [threshold, setTune]);

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
      else if (m === "brut" || m === "net") return;
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
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
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

    canvasCb.current?.(cv);

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
    // impression : la planche est posee entiere, quel que soit son pilotage ;
    // progress d'avant, rendu au retour (null hors impression)
    let printed: number | null = null;
    // but de la course en cours : 0 pour une dissolution, a reprendre apres impression
    let aim = 1;

    measure.current = () => {
      if (!data) return null;
      const v = Math.round(inkRatio(data, inkMode(modeRef.current), tune.current) * 100);
      if (v !== lastInk) {
        lastInk = v;
        setInk(v);
      }
      return v;
    };

    // Une source vivante demarre toujours : aux metadonnees, la seule trame
    // disponible est noire, et figer la planche dessus laisserait le voyant de
    // la camera allume sur un rectangle vide. Sous mouvement reduit elle se
    // fige des la premiere trame reelle (figerReduit), jamais avant.
    if (live) {
      playingRef.current = true;
      setPlaying(true);
    } else if (video && reduced) {
      playingRef.current = false;
      setPlaying(false);
    }

    // resolution du canvas : 2x suffit aux blocs ; une planche qui propose NET
    // va jusqu'a 3x, sinon l'image nette serait agrandie (donc douce) sur un
    // telephone. build() la fixe ; draw() dessine a celle du bitmap, jamais a
    // celle du moment (une fenetre glissee vers un autre ecran change de
    // resolution sans changer de taille : le dessin serait decale).
    const dprOf = () => Math.min(window.devicePixelRatio || 1, net ? 3 : 2);
    let lastCols = 0;
    let lastRows = 0;
    let lastCell = 0;
    let lastDpr = 0;

    const draw = () => {
      const ctx = cv.getContext("2d");
      if (!ctx || !data) return;
      const dpr = lastDpr || dprOf();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const m = modeRef.current;
      // NET : la source elle-meme, a la resolution de l'ecran ; la loupe n'a plus rien a reveler
      if (m === "net") {
        const src = nette ?? media;
        if (src) paintNet(ctx, src, { cols, rows, cell, progress, order });
        return;
      }
      paintBlocks(ctx, data, {
        cell,
        mode: m,
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
      const dpr = dprOf();
      // le ResizeObserver se redeclenche sur la hauteur que build() vient d'ecrire : pas de second echantillonnage
      if (cols === lastCols && rows === lastRows && cell === lastCell && dpr === lastDpr) return;
      lastCols = cols;
      lastRows = rows;
      lastCell = cell;
      lastDpr = dpr;
      cv.style.width = `${cols * cell}px`;
      cv.style.height = `${rows * cell}px`;
      cv.width = cols * cell * dpr;
      cv.height = rows * cell * dpr;
      order = fallOrder(cols, rows, cols * 5 + rows);
      data = sample(media, cols, rows);
      // sur un flux, la trame disponible aux metadonnees est presque toujours noire :
      // les instruments exterieurs n'en recoivent que les echantillons de la boucle
      if (data && !live) sampleRef.current?.(data);
      setDims({ cols, rows });
      if (printed !== null) progress = 1;
      else if (scrolled) progress = scrollProgress();
      draw();
      measure.current();
      if (modeRef.current === "net") chargerNette();
    };

    // NET en grand : la version plus grande de l'image, si l'ecran le demande
    let nette: Source | null = null;
    let netteEnCours = false;
    const chargerNette = () => {
      if (!netSrc || !media || video || netteEnCours) return;
      const { w, h } = srcSize(media);
      if (!w || !h) return;
      const k = Math.min(cv.width / w, cv.height / h);
      // la source de la page suffit tant qu'elle n'est pas agrandie
      if (k <= 1.05) return;
      const largeur = Math.round(w * k);
      const hauteur = Math.round(h * k);
      if (nette && srcSize(nette).w >= largeur * 0.95) return;
      netteEnCours = true;
      chargerImage(netSrc, { largeur, hauteur }).then(
        (b) => {
          netteEnCours = false;
          if (dead) {
            libererImage(b);
            return;
          }
          libererImage(nette);
          nette = b;
          if (modeRef.current === "net") draw();
        },
        () => {
          netteEnCours = false;
        },
      );
    };
    voirNet.current = chargerNette;

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
        if (printed !== null) return;
        const p = scrollProgress();
        if (p === progress) return;
        progress = p;
        draw();
      });
    };

    // mene progress de from a to en dur ms, sur le meme ordre de chute ; done une fois arrive.
    // Une video continue d'etre echantillonnee tant qu'elle joue et que des blocs sont poses.
    const run = (from: number, to: number, dur: number, done?: () => void) => {
      cancelAnimationFrame(raf);
      aim = to;
      // a l'impression la planche reste posee : la reprise attend afterprint
      if (printed !== null) return;
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

    let element: HTMLVideoElement | null = null;
    // image decodee, a liberer au demontage ; chargement a annuler s'il attend encore
    let image: Source | null = null;
    let annuler = () => {};
    if (video) {
      const v = document.createElement("video");
      element = v;
      v.muted = true;
      v.playsInline = true;
      const pret = () => {
        if (dead) return;
        media = v;
        mediaRef.current = v;
        build();
        io.observe(el);
      };
      // mouvement reduit : le direct se pose sur sa premiere trame reelle et
      // s'arrete la, comme toute autre planche video. Le bloc REPRENDRE le
      // relance. loadeddata est le premier instant ou la trame n'est plus noire.
      const figerReduit = () => {
        if (dead || !media) return;
        playingRef.current = false;
        setPlaying(false);
        v.pause();
        if (!isReady(v)) return;
        data = sample(v, cols, rows);
        draw();
        measure.current();
      };
      if (stream) {
        // flux : jamais de v.src a cote de srcObject, et loadeddata n'arrive qu'apres play()
        v.srcObject = stream;
        v.onloadedmetadata = pret;
        if (reduced) v.onloadeddata = figerReduit;
        void v.play().catch(() => {});
      } else {
        // VP9 d'abord quand il est lu (Chromium sans H.264, Firefox), le MP4 sinon (Safari)
        v.src = webm && v.canPlayType('video/webm; codecs="vp9"') ? webm : src;
        v.loop = true;
        v.crossOrigin = "anonymous";
        v.onloadeddata = pret;
      }
      media = null;
    } else {
      // premier ecran d'abord (enFile), decodee hors du fil principal (chargerImage)
      const proche = el.getBoundingClientRect().top < window.innerHeight;
      annuler = enFile(proche, () =>
        chargerImage(src).then(
          (img) => {
            if (dead) {
              libererImage(img);
              return;
            }
            image = img;
            media = img;
            mediaRef.current = img;
            build();
            io.observe(el);
          },
          () => {},
        ),
      );
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

    // Impression : une planche pilotee au defilement, ou pas encore entree en
    // ecran, sortirait vide sur la feuille. Elle est posee entiere d'un seul
    // dessin (aucune chute, aucune loupe), puis rendue a son pilotage.
    const onBeforePrint = () => {
      if (printed === null) printed = progress;
      cancelAnimationFrame(raf);
      progress = 1;
      lens = null;
      draw();
    };
    const onAfterPrint = () => {
      if (printed === null) return;
      progress = printed;
      printed = null;
      draw();
      // une dissolution interrompue (plein cadre qui se ferme) va a son terme
      if (aim === 0) dissolve.current();
      else if (visible && !halted) resume();
    };
    window.addEventListener("beforeprint", onBeforePrint);
    window.addEventListener("afterprint", onAfterPrint);

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
      // en NET il n'y a pas de loupe : l'appui long laisse la page defiler
      if (ev.pointerType !== "touch" || modeRef.current === "net") return;
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

    // changement de resolution a taille egale (fenetre glissee d'un ecran a
    // l'autre) : le ResizeObserver ne voit rien, la planche se refait a la
    // nouvelle resolution, sans retomber (progress est garde)
    let resolution: MediaQueryList | null = null;
    const onResolution = () => {
      watchResolution();
      build();
    };
    const watchResolution = () => {
      resolution?.removeEventListener("change", onResolution);
      resolution = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
      resolution.addEventListener("change", onResolution);
    };
    watchResolution();

    return () => {
      dead = true;
      disarm();
      cancelAnimationFrame(raf);
      cancelAnimationFrame(scrollRaf);
      cancelAnimationFrame(drawRaf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener(MODAL_EVENT, onModal);
      window.removeEventListener("beforeprint", onBeforePrint);
      window.removeEventListener("afterprint", onAfterPrint);
      io.disconnect();
      ro.disconnect();
      resolution?.removeEventListener("change", onResolution);
      cv.removeEventListener("pointerenter", onEnter);
      cv.removeEventListener("pointerdown", onDown);
      cv.removeEventListener("pointermove", onMove);
      cv.removeEventListener("pointerup", onUp);
      cv.removeEventListener("pointercancel", onUp);
      cv.removeEventListener("pointerleave", onLeave);
      cv.removeEventListener("touchmove", onTouchMove);
      if (element) {
        element.onloadeddata = null;
        element.onloadedmetadata = null;
        element.pause();
        // le flux appartient a l'appelant : on detache le puits, on n'arrete jamais ses pistes
        element.srcObject = null;
      }
      annuler();
      libererImage(image);
      libererImage(nette);
      mediaRef.current = null;
      canvasCb.current?.(null);
      hovered.current = false;
    };
  }, [src, webm, netSrc, stream, live, ratio, lensRadius, video, drive, viewport, setTune, net]);

  const labelId = useId();
  const named = controls && !!label;

  return (
    <figure
      ref={figure}
      tabIndex={0}
      aria-labelledby={named ? labelId : undefined}
      aria-label={named ? undefined : alt}
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
          data-lecture={mode}
          // la place de la planche est reservee des le rendu serveur : son format
          // est connu avant l'image (aucun saut de mise en page a l'arrivee)
          // en NET, le pincement agrandit l'image ; en blocs, pan-y garde l'appui long pour la loupe
          className={`block max-w-full select-none ${mode === "net" ? "touch-manipulation" : "touch-pan-y"}`}
          style={{
            WebkitTouchCallout: "none",
            ...(viewport ? {} : { width: "100%", aspectRatio: `1 / ${ratio}` }),
          }}
        />
      </div>
      {controls && (
        <figcaption className="u-mono mt-[3px] flex shrink-0 flex-wrap items-center justify-between gap-x-cell gap-y-0 border-[3px] border-(--ink) px-[6px]">
          {/* une etiquette longue renvoie ENCRE ou le format a la ligne : chaque
              ligne garde deux cellules de haut, aucune ne colle au cadre */}
          <span className="flex min-h-cell2 min-w-0 flex-wrap items-center gap-x-[6px]">
            {label && (
              <span id={labelId} className="min-w-0 break-words leading-[calc(var(--cell)*2)]">
                {label}
              </span>
            )}
            {ink !== null && (
              <span className="flex min-h-cell2 shrink-0 items-center gap-[4px]">
                <span>ENCRE</span>
                <BitReadout text={`${ink}%`} />
              </span>
            )}
            {dims && (
              <span className="flex min-h-cell2 shrink-0 items-center pl-[10px]">
                <BitReadout text={`${dims.cols} X ${dims.rows}`} />
              </span>
            )}
          </span>
          {(mode === "bin" || mode === "gris") && (
            <span
              role="group"
              aria-label="Réglage de la planche"
              // sous 640 px, dans la page, le reglage passe sous les modes : il disparait en
              // BRUT et en NET sans faire remonter NET ni glisser PLEIN sous le doigt. Le
              // cartouche du plein cadre est cale en bas : la, l'ordre d'origine tient les modes
              className={`flex min-h-cell2 min-w-0 basis-full flex-wrap items-center justify-end gap-[6px] sm:flex-1 sm:basis-auto ${viewport ? "" : "order-last sm:order-none"}`}
            >
              <span>{mode === "bin" ? "SEUIL" : "PALIERS"}</span>
              <BitReadout
                text={mode === "bin" ? shown.threshold.toFixed(2) : String(shown.levels)}
              />
              <button
                type="button"
                onClick={() => step(-1)}
                aria-label={mode === "bin" ? "Baisser le seuil" : "Moins de paliers"}
                className="u-mono u-bloc min-w-cell2"
              >
                -
              </button>
              <button
                type="button"
                onClick={() => step(1)}
                aria-label={mode === "bin" ? "Monter le seuil" : "Plus de paliers"}
                className="u-mono u-bloc min-w-cell2"
              >
                +
              </button>
              {mode === "bin" && (
                <button
                  type="button"
                  onClick={() => auto.current()}
                  aria-label="Auto : seuil automatique (Otsu)"
                  className="u-mono u-bloc"
                >
                  AUTO
                </button>
              )}
            </span>
          )}
          <span
            role="group"
            aria-label="Mode de lecture"
            className="ml-auto flex min-h-cell2 flex-auto flex-wrap items-center justify-end gap-[6px] min-w-0 sm:flex-initial"
          >
            <span className="hidden sm:inline">
              {coarse && mode !== "net"
                ? "APPUI LONG = LOUPE"
                : live
                  ? "DIRECT"
                  : video
                    ? "VIDEO"
                    : "PHOTO"}
            </span>
            {video && (
              <button
                type="button"
                onClick={togglePlay}
                aria-label={
                  live
                    ? playing
                      ? "Figer la trame en cours"
                      : "Reprendre le direct"
                    : playing
                      ? "Pause de la vidéo"
                      : "Lecture de la vidéo"
                }
                className="u-mono u-bloc"
              >
                {playing ? (live ? "FIGER" : "PAUSE") : live ? "REPRENDRE" : "LECTURE"}
              </button>
            )}
            {cycle.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => apply(m)}
                aria-pressed={mode === m}
                aria-label={`${m.toUpperCase()} : ${SPOKEN[m]}`}
                className="u-mono u-bloc"
              >
                {m.toUpperCase()}
              </button>
            ))}
            {canFull && (
              <Bloc ref={fullBtn} onClick={openFull} aria-label="Plein cadre" aria-keyshortcuts="f">
                PLEIN<span className="hidden lg:inline">&nbsp;[F]</span>
              </Bloc>
            )}
          </span>
        </figcaption>
      )}
      {controls && (
        <span className="sr-only" aria-live="polite">
          {announce}
        </span>
      )}
      {full && (
        <PleinCadre
          src={src}
          webm={webm}
          netSrc={netSrc}
          stream={stream}
          alt={alt}
          label={label}
          mode={mode}
          threshold={shown.threshold}
          levels={shown.levels}
          gamma={shown.gamma}
          lensRadius={lensRadius}
          net={net}
          onClose={() => setFull(false)}
        />
      )}
    </figure>
  );
}
