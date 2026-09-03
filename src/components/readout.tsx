import { useEffect, useRef } from "react";
import { drawText, textCols } from "@/lib/glyphs";

/** Afficheur bitmap : une chaine courte dessinee bloc par bloc. */
export function BitReadout({
  text,
  unit = 3,
  className = "",
}: {
  text: string;
  unit?: number;
  className?: string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = canvas.current;
    if (!cv) return;
    const cols = textCols(text);
    const rows = 5;
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
    drawText(ctx, text, unit);
  }, [text, unit]);

  return (
    <>
      <canvas ref={canvas} className={`block ${className}`} aria-hidden="true" />
      <span className="sr-only">{text}</span>
    </>
  );
}
