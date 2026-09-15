import { useEffect, useRef } from "react";
import { cellSizeFor, prefersReducedMotion } from "@/lib/mire";

/* ------------------------------------------------------------------ */
/* Bande de calibration : barres 1-bit qui respirent par blocs          */
/* ------------------------------------------------------------------ */

/**
 * Emprise du pointeur sur une bande qui respire : voisinage CARRE (jamais un
 * disque) de POINTER_R colonnes de part et d'autre, monte en PUSH_MS tant que
 * le pointeur est la, retombe en RELAX_MS des qu'il part. Les hauteurs restent
 * des nombres entiers de cellules : la bande se deforme, elle ne se fond pas.
 */
const POINTER_R = 3;
const PUSH_MS = 150;
const RELAX_MS = 620;

export function CalibrationBand({
  height = 8,
  seed = 3,
  negative = false,
  still = false,
  className = "",
}: {
  /** hauteur en cellules */
  height?: number;
  seed?: number;
  /** fond noir, colonnes blanches : pour une bande posee sur un conteneur noir */
  negative?: boolean;
  /** une seule peinture, une rangee de blocs : ligne sans signal */
  still?: boolean;
  className?: string;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = wrap.current;
    const cv = canvas.current;
    if (!el || !cv) return;
    let raf = 0;
    let dead = false;
    let cell = cellSizeFor(window.innerWidth);
    let cols = 0;
    const rows = height;
    let phase = new Float32Array(0);
    let width = new Float32Array(0);
    // emprise du pointeur par colonne (0..1), rangee visee, horloge de la derniere image
    let push = new Float32Array(0);
    let hot: { x: number; y: number } | null = null;
    let level = 1;
    let last = 0;

    const size = () => {
      cell = cellSizeFor(window.innerWidth);
      cols = Math.max(8, Math.ceil(el.clientWidth / cell));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.style.width = `${cols * cell}px`;
      cv.style.height = `${rows * cell}px`;
      cv.width = cols * cell * dpr;
      cv.height = rows * cell * dpr;
      let s = seed * 104729;
      const rnd = () => ((s = (s * 9301 + 49297) % 233280), s / 233280);
      phase = new Float32Array(cols);
      width = new Float32Array(cols);
      push = new Float32Array(cols);
      for (let x = 0; x < cols; x++) {
        phase[x] = rnd() * Math.PI * 2;
        width[x] = 0.4 + rnd() * 1.4;
      }
    };

    const once = still || prefersReducedMotion();
    // une ligne sans signal, un mouvement reduit ou un pointeur grossier ne
    // reagissent pas : la bande garde exactement son comportement d'origine
    const reacts = !once && !window.matchMedia("(pointer: coarse)").matches;
    let visible = false;
    let modal = false;
    const paint = (t: number) => {
      if (dead) return;
      if (reacts) {
        // l'emprise se calcule dans la boucle deja en cours : aucune image de plus
        const dt = last ? Math.min(120, t - last) : 0;
        for (let x = 0; x < cols; x++)
          if (push[x]! > 0) push[x] = Math.max(0, push[x]! - dt / RELAX_MS);
        if (hot) {
          level = Math.min(rows, Math.max(1, rows - hot.y));
          const lo = Math.max(0, hot.x - POINTER_R);
          const hi = Math.min(cols - 1, hot.x + POINTER_R);
          for (let x = lo; x <= hi; x++) {
            const target = 1 - Math.abs(x - hot.x) / (POINTER_R + 1);
            if (target > push[x]!) push[x] = Math.min(target, push[x]! + dt / PUSH_MS);
          }
        }
        last = t;
      }
      const ctx = cv.getContext("2d");
      if (ctx) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.fillStyle = negative ? "#000000" : "#FFFFFF";
        ctx.fillRect(0, 0, cols * cell, rows * cell);
        ctx.fillStyle = negative ? "#FFFFFF" : "#000000";
        for (let x = 0; x < cols; x++) {
          // hauteur de colonne quantifiee : seuil dur, aucun degrade
          const v = (Math.sin(t / 900 + phase[x]! * width[x]!) + 1) / 2;
          let h = still ? 1 : Math.max(1, Math.round(v * rows));
          // la ou le pointeur passe, la colonne va chercher sa rangee, puis elle
          // relache et reprend sa respiration : toujours un compte entier de blocs
          if (reacts && push[x]! > 0)
            h = Math.max(1, Math.min(rows, Math.round(h + (level - h) * push[x]!)));
          ctx.fillRect(x * cell, (rows - h) * cell, cell, h * cell);
        }
      }
      // ligne sans signal ou mouvement reduit : une seule pose, la bande ne respire pas
      raf = 0;
      if (!once && visible && !modal) raf = requestAnimationFrame(paint);
    };

    size();
    if (once) paint(0);
    // la bande ne respire qu'a l'ecran et hors masque : sinon la boucle s'arrete
    const sync = () => {
      if (once) return;
      if (visible && !modal) {
        if (!raf) raf = requestAnimationFrame(paint);
      } else {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) visible = e.isIntersecting;
      sync();
    });
    io.observe(el);
    const onModal = (e: Event) => {
      modal = Boolean((e as CustomEvent<boolean>).detail);
      sync();
    };
    window.addEventListener("mire:modal", onModal);

    // le pointeur ne declenche rien de lui-meme : il ne fait que deplacer la
    // cellule visee, la boucle deja en cours s'en sert a l'image suivante
    const onPointerMove = (ev: PointerEvent) => {
      const r = cv.getBoundingClientRect();
      hot = {
        x: Math.min(cols - 1, Math.max(0, Math.floor((ev.clientX - r.left) / cell))),
        y: Math.min(rows - 1, Math.max(0, Math.floor((ev.clientY - r.top) / cell))),
      };
    };
    const onPointerLeave = () => {
      hot = null;
    };
    if (reacts) {
      el.addEventListener("pointermove", onPointerMove, { passive: true });
      el.addEventListener("pointerleave", onPointerLeave, { passive: true });
    }

    const ro = new ResizeObserver(() => {
      size();
      // le redimensionnement vide le canvas : une pose fixe doit etre repeinte
      if (once) paint(0);
    });
    ro.observe(el);

    return () => {
      dead = true;
      io.disconnect();
      window.removeEventListener("mire:modal", onModal);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerleave", onPointerLeave);
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [height, seed, negative, still]);

  return (
    <div ref={wrap} className={`overflow-hidden ${className}`} aria-hidden="true">
      <canvas ref={canvas} className="block" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Bandeau defilant : texte mono, pas de la grille                      */
/* ------------------------------------------------------------------ */

export function Ticker({ items }: { items: string[] }) {
  const line = [...items, ...items, ...items];
  return (
    <div className="overflow-hidden border-y-[10px] border-black bg-black py-[6px]">
      {/* hors mire : la liste est lue une seule fois, le defilement est masque */}
      <ul className="sr-only">
        {items.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
      <div className="mire-ticker flex w-max gap-cell4 whitespace-nowrap" aria-hidden="true">
        {[0, 1].map((k) => (
          <div key={k} className="flex gap-cell4">
            {line.map((t, i) => (
              <span key={`${k}-${i}`} className="u-mono text-white">
                {t}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
