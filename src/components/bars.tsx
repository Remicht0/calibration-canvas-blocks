import { useEffect, useRef } from "react";
import { cellSizeFor, prefersReducedMotion } from "@/lib/mire";

/* ------------------------------------------------------------------ */
/* Bande de calibration : barres 1-bit qui respirent par blocs          */
/* ------------------------------------------------------------------ */

export function CalibrationBand({
  height = 8,
  seed = 3,
  className = "",
}: {
  /** hauteur en cellules */
  height?: number;
  seed?: number;
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
      for (let x = 0; x < cols; x++) {
        phase[x] = rnd() * Math.PI * 2;
        width[x] = 0.4 + rnd() * 1.4;
      }
    };

    const reduced = prefersReducedMotion();
    const paint = (t: number) => {
      if (dead) return;
      const ctx = cv.getContext("2d");
      if (ctx) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, cols * cell, rows * cell);
        ctx.fillStyle = "#000000";
        for (let x = 0; x < cols; x++) {
          // hauteur de colonne quantifiee : seuil dur, aucun degrade
          const v = (Math.sin(t / 900 + phase[x]! * width[x]!) + 1) / 2;
          const h = Math.max(1, Math.round(v * rows));
          ctx.fillRect(x * cell, (rows - h) * cell, cell, h * cell);
        }
      }
      // mouvement reduit : une seule pose, la bande ne respire pas
      if (!reduced) raf = requestAnimationFrame(paint);
    };

    size();
    raf = requestAnimationFrame(paint);
    const ro = new ResizeObserver(size);
    ro.observe(el);

    return () => {
      dead = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [height, seed]);

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
