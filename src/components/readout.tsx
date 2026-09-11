import { useEffect, useRef, useState } from "react";
import { drawText, textCols } from "@/lib/glyphs";
import { bitUnit, cellSizeFor } from "@/lib/mire";

/** Afficheur bitmap : une chaine courte dessinee bloc par bloc, un glyphe = une cellule de haut. */
export function BitReadout({
  text,
  unit,
  className = "",
}: {
  text: string;
  /** Surcharge du pas ; par defaut bitUnit(cell), recalcule au redimensionnement. */
  unit?: number;
  className?: string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  // SSR : valeur bureau, corrigee au montage
  const [auto, setAuto] = useState(4);
  const u = unit ?? auto;
  const cols = textCols(text);
  const rows = 5;

  useEffect(() => {
    const set = () => setAuto(bitUnit(cellSizeFor(window.innerWidth)));
    set();
    window.addEventListener("resize", set);
    return () => window.removeEventListener("resize", set);
  }, []);

  useEffect(() => {
    const cv = canvas.current;
    if (!cv) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = cols * u * dpr;
    cv.height = rows * u * dpr;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cols * u, rows * u);
    ctx.fillStyle = getComputedStyle(cv).color;
    drawText(ctx, text, u);
  }, [text, u, cols]);

  return (
    <>
      <canvas
        ref={canvas}
        className={`block ${className}`}
        style={{ width: cols * u, height: rows * u }}
        aria-hidden="true"
      />
      <span className="sr-only">{text}</span>
    </>
  );
}
