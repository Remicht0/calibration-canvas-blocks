import { useEffect, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { cellSizeFor } from "@/lib/mire";

/* ------------------------------------------------------------------ */
/* Sequence de mise en route : la mire se charge, bloc par bloc        */
/* ------------------------------------------------------------------ */

const KEY = "mire-boot";

export function BootSequence() {
  const [done, setDone] = useState(true);
  const [pct, setPct] = useState(0);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (sessionStorage.getItem(KEY)) return;
    sessionStorage.setItem(KEY, "1");
    setDone(false);
    document.documentElement.style.overflow = "hidden";

    const cv = canvas.current;
    let raf = 0;
    let dead = false;
    const t0 = performance.now();
    const DUR = 1700;

    const cell = cellSizeFor(window.innerWidth);
    const cols = Math.ceil(window.innerWidth / cell);
    const rows = Math.ceil(window.innerHeight / cell);
    // ordre pseudo-aleatoire stable, densite decroissante vers le bas
    const order = new Float32Array(cols * rows);
    let s = 7919;
    const rnd = () => ((s = (s * 9301 + 49297) % 233280), s / 233280);
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < cols; x++)
        order[y * cols + x] = Math.min(1, (y / rows) * 0.75 + rnd() * 0.55);

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (cv) {
      cv.width = cols * cell * dpr;
      cv.height = rows * cell * dpr;
      cv.style.width = `${cols * cell}px`;
      cv.style.height = `${rows * cell}px`;
    }

    const step = (t: number) => {
      if (dead) return;
      const k = Math.min(1, (t - t0) / DUR);
      setPct(Math.round(k * 100));
      const ctx = cv?.getContext("2d");
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.fillStyle = "#000000";
        ctx.fillRect(0, 0, cols * cell, rows * cell);
        ctx.fillStyle = "#FFFFFF";
        for (let i = 0; i < order.length; i++) {
          if (order[i]! > 1 - k) continue;
          ctx.fillRect((i % cols) * cell, Math.floor(i / cols) * cell, cell, cell);
        }
      }
      if (k < 1) raf = requestAnimationFrame(step);
      else {
        document.documentElement.style.overflow = "";
        setDone(true);
      }
    };
    raf = requestAnimationFrame(step);

    return () => {
      dead = true;
      cancelAnimationFrame(raf);
      document.documentElement.style.overflow = "";
    };
  }, []);

  if (done) return null;

  return (
    <div className="fixed inset-0 z-[200] overflow-hidden bg-black" aria-hidden="true">
      <canvas ref={canvas} className="block" />
      <div className="u-mono absolute inset-0 flex flex-col justify-between p-cell text-white mix-blend-difference">
        <div className="flex justify-between">
          <span>MIRE / MISE EN ROUTE</span>
          <span>1-BIT</span>
        </div>
        <div className="flex items-end justify-between">
          <span className="u-display text-[22vw] leading-[0.78] md:text-[10vw]">
            {String(pct).padStart(3, "0")}
          </span>
          <span>CALIBRATION DU SIGNAL</span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Curseur : une cellule de la grille, inversion pure                  */
/* ------------------------------------------------------------------ */

export function GridCursor() {
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(pointer: coarse)").matches) return;
    const el = box.current;
    if (!el) return;
    const cell = cellSizeFor(window.innerWidth);
    el.style.width = `${cell}px`;
    el.style.height = `${cell}px`;
    let x = -99;
    let y = -99;
    let raf = 0;
    const draw = () => {
      raf = 0;
      el.style.transform = `translate3d(${Math.floor(x / cell) * cell}px, ${
        Math.floor(y / cell) * cell
      }px, 0)`;
    };
    const move = (e: PointerEvent) => {
      x = e.clientX;
      y = e.clientY;
      if (!raf) raf = requestAnimationFrame(draw);
    };
    const over = () => {
      const t = document.querySelectorAll("a:hover, button:hover").length > 0;
      el.style.outline = t ? `${cell / 4}px solid #FF0000` : "none";
    };
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerover", over, { passive: true });
    document.documentElement.classList.add("mire-nocursor");
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerover", over);
      document.documentElement.classList.remove("mire-nocursor");
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      ref={box}
      aria-hidden="true"
      className="pointer-events-none fixed left-0 top-0 z-[150] hidden bg-white mix-blend-difference md:block"
    />
  );
}

/* ------------------------------------------------------------------ */
/* Inversion du signal : touche N ou bouton                            */
/* ------------------------------------------------------------------ */

export function NegativeSwitch() {
  const [neg, setNeg] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("mire-negative", neg);
  }, [neg]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "n" || e.key === "N") setNeg((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <button
      type="button"
      onClick={() => setNeg((v) => !v)}
      className="u-mono fixed right-0 top-1/2 z-[160] hidden -translate-y-1/2 border-[3px] px-[6px] py-cell md:block"
      style={{
        writingMode: "vertical-rl",
        background: "#FFFFFF",
        color: "#000000",
        borderColor: "#000000",
      }}
    >
      {neg ? "POSITIF [N]" : "NEGATIF [N]"}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Transition de page : masque plein ecran en chute de blocs           */
/* ------------------------------------------------------------------ */

export function RouteWipe() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const canvas = useRef<HTMLCanvasElement>(null);
  const [on, setOn] = useState(false);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    setOn(true);
    const cv = canvas.current;
    let raf = 0;
    let dead = false;
    const DUR = 620;
    const t0 = performance.now();

    const cell = cellSizeFor(window.innerWidth);
    const cols = Math.ceil(window.innerWidth / cell);
    const rows = Math.ceil(window.innerHeight / cell);
    const order = new Float32Array(cols * rows);
    let s = 4441;
    const rnd = () => ((s = (s * 9301 + 49297) % 233280), s / 233280);
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < cols; x++)
        order[y * cols + x] = Math.min(1, (y / rows) * 0.7 + rnd() * 0.6);

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (cv) {
      cv.width = cols * cell * dpr;
      cv.height = rows * cell * dpr;
      cv.style.width = `${cols * cell}px`;
      cv.style.height = `${rows * cell}px`;
    }

    const step = (t: number) => {
      if (dead) return;
      const k = Math.min(1, (t - t0) / DUR);
      const ctx = cv?.getContext("2d");
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, cols * cell, rows * cell);
        ctx.fillStyle = "#000000";
        // 0 -> 0.5 : la page se couvre. 0.5 -> 1 : les blocs tombent.
        const half = k < 0.5 ? k * 2 : 1 - (k - 0.5) * 2;
        const drop = k >= 0.5;
        for (let i = 0; i < order.length; i++) {
          const o = order[i]!;
          if (drop ? o > half : o > half) continue;
          ctx.fillRect((i % cols) * cell, Math.floor(i / cols) * cell, cell, cell);
        }
      }
      if (k < 1) raf = requestAnimationFrame(step);
      else setOn(false);
    };
    raf = requestAnimationFrame(step);
    return () => {
      dead = true;
      cancelAnimationFrame(raf);
    };
  }, [path]);

  if (!on) return null;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[190] overflow-hidden"
      aria-hidden="true"
    >
      <canvas ref={canvas} className="block" />
    </div>
  );
}
