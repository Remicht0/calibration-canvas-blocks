import { useCallback, useEffect, useRef, useState } from "react";
import { drawText, textCols } from "@/lib/glyphs";
import { bitUnit, cellSizeFor } from "@/lib/mire";
import { BitReadout } from "@/components/readout";
import { Bloc } from "@/components/bloc";

/* ------------------------------------------------------------------ */
/* Horloge 1-bit : chiffres dessines en blocs (fonte 3x5 de glyphs.ts) */
/* ------------------------------------------------------------------ */

export function BitmapClock({
  label = "HEURE ATELIER",
  size = "etiquette",
}: {
  label?: string;
  /** etiquette : un glyphe = une cellule de haut ; display : un bloc = une cellule. */
  size?: "etiquette" | "display";
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [txt, setTxt] = useState("00:00:00");

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      const p = (n: number) => String(n).padStart(2, "0");
      setTxt(`${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`);
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const cv = canvas.current;
    if (!cv) return;
    const cols = textCols(txt);
    const rows = 5;
    const cell = cellSizeFor(window.innerWidth);
    // le cadran ne depasse jamais la largeur disponible
    const avail = Math.max(
      120,
      (cv.parentElement?.parentElement?.clientWidth ?? window.innerWidth) - 120,
    );
    const unit = Math.max(
      2,
      Math.min(size === "display" ? cell : bitUnit(cell), Math.floor(avail / cols)),
    );
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.style.width = `${cols * unit}px`;
    cv.style.height = `${rows * unit}px`;
    cv.width = cols * unit * dpr;
    cv.height = rows * unit * dpr;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cols * unit, rows * unit);
    ctx.fillStyle = getComputedStyle(cv).color;
    drawText(ctx, txt, unit);
  }, [txt, size]);

  return (
    <div className="u-mono flex min-w-0 max-w-full flex-wrap items-center gap-cell">
      <span className="shrink-0">{label}</span>
      {/* en etiquette, le cadran (une cellule) reste dans la ligne mono : le header garde sa hauteur */}
      <span className={size === "etiquette" ? "flex h-[1lh] items-center" : "contents"}>
        <canvas ref={canvas} className="block max-w-full" aria-hidden="true" />
      </span>
      <span className="sr-only">{txt}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Table de composition : on dessine des blocs, on lance l'automate    */
/* ------------------------------------------------------------------ */

export function BitmapBoard({ rows = 14 }: { rows?: number }) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const grid = useRef<Uint8Array>(new Uint8Array(0));
  const dims = useRef({ cols: 0, rows, cell: 20 });
  const [running, setRunning] = useState(false);
  const [gen, setGen] = useState(0);

  const paint = useCallback(() => {
    const cv = canvas.current;
    const ctx = cv?.getContext("2d");
    if (!cv || !ctx) return;
    const { cols, rows: r, cell } = dims.current;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, cols * cell, r * cell);
    ctx.fillStyle = "#000000";
    for (let y = 0; y < r; y++)
      for (let x = 0; x < cols; x++)
        if (grid.current[y * cols + x]) ctx.fillRect(x * cell, y * cell, cell, cell);
  }, []);

  const seed = useCallback(
    (density: number) => {
      const { cols, rows: r } = dims.current;
      const g = new Uint8Array(cols * r);
      for (let i = 0; i < g.length; i++) g[i] = Math.random() < density ? 1 : 0;
      grid.current = g;
      setGen(0);
      paint();
    },
    [paint],
  );

  useEffect(() => {
    const el = wrap.current;
    const cv = canvas.current;
    if (!el || !cv) return;

    const size = () => {
      const cell = cellSizeFor(window.innerWidth);
      const cols = Math.max(6, Math.floor((el.clientWidth - 6) / cell));
      const old = grid.current;
      const oldCols = dims.current.cols;
      dims.current = { cols, rows, cell };
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.style.width = `${cols * cell}px`;
      cv.style.height = `${rows * cell}px`;
      cv.width = cols * cell * dpr;
      cv.height = rows * cell * dpr;
      const g = new Uint8Array(cols * rows);
      if (oldCols)
        for (let y = 0; y < rows; y++)
          for (let x = 0; x < Math.min(cols, oldCols); x++)
            g[y * cols + x] = old[y * oldCols + x] ?? 0;
      grid.current = g;
      paint();
    };

    size();
    if (!grid.current.some(Boolean)) seed(0.22);

    const ro = new ResizeObserver(size);
    ro.observe(el);
    return () => ro.disconnect();
  }, [rows, paint, seed]);

  // automate : voisinage de Moore, regles 23/3, tore
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      const { cols, rows: r } = dims.current;
      const g = grid.current;
      const n = new Uint8Array(g.length);
      for (let y = 0; y < r; y++) {
        for (let x = 0; x < cols; x++) {
          let c = 0;
          for (let dy = -1; dy <= 1; dy++)
            for (let dx = -1; dx <= 1; dx++) {
              if (!dx && !dy) continue;
              c += g[((y + dy + r) % r) * cols + ((x + dx + cols) % cols)]!;
            }
          const a = g[y * cols + x]!;
          n[y * cols + x] = a ? (c === 2 || c === 3 ? 1 : 0) : c === 3 ? 1 : 0;
        }
      }
      grid.current = n;
      setGen((k) => k + 1);
      paint();
    }, 110);
    return () => window.clearInterval(id);
  }, [running, paint]);

  const draw = (ev: React.PointerEvent<HTMLCanvasElement>, force = false) => {
    if (!force && ev.buttons !== 1) return;
    const cv = canvas.current!;
    const r = cv.getBoundingClientRect();
    const { cols, rows: rr } = dims.current;
    const x = Math.floor(((ev.clientX - r.left) / r.width) * cols);
    const y = Math.floor(((ev.clientY - r.top) / r.height) * rr);
    if (x < 0 || y < 0 || x >= cols || y >= rr) return;
    grid.current[y * cols + x] = 1;
    paint();
  };

  return (
    <div ref={wrap} className="max-w-full" role="group" aria-label="Table de composition">
      <p className="sr-only">
        Grille de blocs dessinée au pointeur, puis propagée par un automate cellulaire aux règles
        23/3. Le dessin n&apos;est pas accessible au clavier ; les commandes le sont.
      </p>
      <canvas
        ref={canvas}
        className="block border-[3px] border-black touch-none"
        onPointerDown={(e) => draw(e, true)}
        onPointerMove={(e) => draw(e)}
        aria-hidden="true"
      />
      <div className="mt-[3px] flex flex-wrap items-center gap-[6px]">
        <Bloc onClick={() => setRunning((v) => !v)} pressed={running}>
          {running ? "ARRETER" : "PROPAGER"}
        </Bloc>
        <Bloc onClick={() => seed(0.22)}>BRUIT</Bloc>
        <Bloc onClick={() => seed(0)}>EFFACER</Bloc>
        <span className="shrink-0">
          <BitReadout text={`GEN ${String(gen).padStart(4, "0")}`} />
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Champ de bruit qui se stabilise au scroll (planche de calibration)  */
/* ------------------------------------------------------------------ */

export function NoiseField({ rows = 10, seed = 5 }: { rows?: number; seed?: number }) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = wrap.current;
    const cv = canvas.current;
    if (!el || !cv) return;
    let dead = false;
    let raf = 0;
    let cell = cellSizeFor(window.innerWidth);
    let cols = 0;
    let base = new Float32Array(0);

    const size = () => {
      cell = cellSizeFor(window.innerWidth);
      cols = Math.max(8, Math.ceil(el.clientWidth / cell));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.style.width = `${cols * cell}px`;
      cv.style.height = `${rows * cell}px`;
      cv.width = cols * cell * dpr;
      cv.height = rows * cell * dpr;
      let s = seed * 7919;
      const rnd = () => ((s = (s * 9301 + 49297) % 233280), s / 233280);
      base = new Float32Array(cols * rows);
      for (let i = 0; i < base.length; i++) base[i] = rnd();
    };

    const paint = () => {
      if (dead) return;
      const ctx = cv.getContext("2d");
      if (ctx) {
        const r = el.getBoundingClientRect();
        // 0 au centre de l'ecran = image nette, loin = bruit total
        const d = Math.min(
          1,
          Math.abs(r.top + r.height / 2 - window.innerHeight / 2) / (window.innerHeight / 1.1),
        );
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, cols * cell, rows * cell);
        ctx.fillStyle = "#000000";
        for (let y = 0; y < rows; y++) {
          for (let x = 0; x < cols; x++) {
            const clean = y / (rows - 1) < 0.5 ? 1 : 0;
            const v = base[y * cols + x]!;
            const on = v < d ? (v * 997) % 1 < 0.5 : clean;
            if (on) ctx.fillRect(x * cell, y * cell, cell, cell);
          }
        }
      }
      raf = requestAnimationFrame(paint);
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
  }, [rows, seed]);

  return (
    <div ref={wrap} className="overflow-hidden" aria-hidden="true">
      <canvas ref={canvas} className="block" />
    </div>
  );
}
