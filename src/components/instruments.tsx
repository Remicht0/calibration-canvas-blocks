import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { cellSizeFor, otsuThreshold } from "@/lib/mire";
import { histogram, inkRatio, type Sampled } from "@/lib/bitmap";
import { projects } from "@/lib/projects";
import { HybridMedia } from "@/components/media";
import { BitReadout } from "@/components/readout";
import { Bloc } from "@/components/bloc";

/* Crans du seuil : 0,05 entre 0,20 et 0,70, les memes que sous chaque planche. */
const MIN = 0.2;
const MAX = 0.7;
const STEP = 0.05;
const snap = (v: number) => Math.min(MAX, Math.max(MIN, Math.round(v / STEP) / (1 / STEP)));

const frNumber = (v: number) => v.toFixed(2).replace(".", ",");

/* ------------------------------------------------------------------ */
/* Histogramme de luminance : bins colonnes, rows rangs de blocs.       */
/* La coupure se lit par plein (encre, a gauche) / cadre (papier, a     */
/* droite) : aucun repere, aucune couleur. Clic, glisser ou clavier.    */
/* ------------------------------------------------------------------ */

export function Histogramme({
  data,
  threshold,
  ink,
  rows = 8,
  bins = 20,
  onChange,
}: {
  data: Sampled | null;
  threshold: number;
  /** encrage en pour cent, pour la valeur lue par le lecteur d'ecran */
  ink: number | null;
  rows?: number;
  bins?: number;
  onChange: (threshold: number) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  // SSR : valeur bureau, corrigee au montage
  const [cell, setCell] = useState(20);
  const parts = useMemo(() => (data ? histogram(data, bins) : null), [data, bins]);

  useEffect(() => {
    const set = () => setCell(cellSizeFor(window.innerWidth));
    set();
    window.addEventListener("resize", set);
    return () => window.removeEventListener("resize", set);
  }, []);

  useEffect(() => {
    const cv = canvas.current;
    if (!cv) return;
    const w = bins * cell;
    const h = rows * cell;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = w * dpr;
    cv.height = h * dpr;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, w, h);
    if (!parts) return;
    let max = 0;
    for (let b = 0; b < bins; b++) max = Math.max(max, parts[b]!);
    if (max <= 0) return;
    for (let b = 0; b < bins; b++) {
      const part = parts[b]!;
      if (part <= 0) continue;
      const n = Math.max(1, Math.round((part / max) * rows));
      const x = b * cell;
      const y = (rows - n) * cell;
      ctx.fillStyle = "#000000";
      ctx.fillRect(x, y, cell, n * cell);
      if ((b + 0.5) / bins < threshold) continue;
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(x + 3, y + 3, cell - 6, n * cell - 6);
    }
  }, [parts, threshold, rows, bins, cell]);

  const pick = useCallback(
    (ev: { clientX: number; currentTarget: HTMLCanvasElement }) => {
      const r = ev.currentTarget.getBoundingClientRect();
      const bin = Math.min(bins - 1, Math.max(0, Math.floor((ev.clientX - r.left) / cell)));
      // (bin + 0,5) / bins arrondi au cran : la colonne cliquee passe a l'encre
      onChange(snap((bin + 1) / bins));
    },
    [bins, cell, onChange],
  );

  const onKeyDown = (e: KeyboardEvent<HTMLCanvasElement>) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (document.documentElement.classList.contains("mire-modal")) return;
    switch (e.key) {
      case "ArrowLeft":
      case "ArrowDown":
      case "-":
        onChange(snap(threshold - STEP));
        break;
      case "ArrowRight":
      case "ArrowUp":
      case "+":
      case "=":
        onChange(snap(threshold + STEP));
        break;
      case "Home":
        onChange(MIN);
        break;
      case "End":
        onChange(MAX);
        break;
      default:
        return;
    }
    e.preventDefault();
  };

  return (
    <canvas
      ref={canvas}
      tabIndex={0}
      role="slider"
      aria-label="Seuil de binarisation"
      aria-valuemin={MIN}
      aria-valuemax={MAX}
      aria-valuenow={threshold}
      aria-valuetext={`Seuil ${frNumber(threshold)}${ink === null ? "" : `, encrage ${ink} %`}`}
      aria-orientation="horizontal"
      onKeyDown={onKeyDown}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        pick(e);
      }}
      onPointerMove={(e) => {
        if (e.buttons === 1) pick(e);
      }}
      className="block max-w-full touch-none select-none"
      style={{ width: bins * cell, height: rows * cell }}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Instrument 04 : une planche en BIN et son histogramme. La coupure    */
/* est la seule decision : la planche se re-seuille en place, ENCRE se  */
/* remesure a chaque cran. AUTO pose la coupure d'Otsu.                 */
/* ------------------------------------------------------------------ */

export function InstrumentSeuil() {
  const project = projects[0]!;
  const [data, setData] = useState<Sampled | null>(null);
  const [threshold, setThreshold] = useState(0.45);
  const [auto, setAuto] = useState(false);
  const region = useRef<HTMLDivElement>(null);
  const hovered = useRef(false);

  const ink = useMemo(
    () => (data ? Math.round(inkRatio(data, "bin", { threshold }) * 100) : null),
    [data, threshold],
  );

  const manual = useCallback((v: number) => {
    setThreshold(snap(v));
    setAuto(false);
  }, []);

  const otsu = useCallback(() => {
    if (!data) return;
    setThreshold(snap(otsuThreshold(data.lum, MIN, MAX)));
    setAuto(true);
  }, [data]);

  // - / + / A sur la planche survolee ou focalisee : la coupure reste unique,
  // l'instrument prend la main avant le raccourci interne de la planche
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (document.documentElement.classList.contains("mire-modal")) return;
      const el = region.current;
      if (!el) return;
      if (!hovered.current && !el.contains(e.target as Node)) return;
      if (e.key === "-") manual(threshold - STEP);
      else if (e.key === "+" || e.key === "=") manual(threshold + STEP);
      else if (e.key === "a" || e.key === "A") otsu();
      else return;
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [threshold, manual, otsu]);

  return (
    <div
      ref={region}
      onPointerEnter={() => {
        hovered.current = true;
      }}
      onPointerLeave={() => {
        hovered.current = false;
      }}
      className="grid gap-cell md:grid-cols-[minmax(0,1fr)_auto] md:items-end"
    >
      <HybridMedia
        src={project.image}
        alt={project.alt}
        label="PLANCHE"
        mode="bin"
        threshold={threshold}
        controls={false}
        onSample={setData}
        drive="time"
      />
      <div className="flex min-w-0 max-w-full flex-col gap-cell">
        <Histogramme data={data} threshold={threshold} ink={ink} onChange={manual} />
        <div className="u-mono flex min-h-cell2 flex-wrap items-center gap-x-cell gap-y-0">
          <span className="flex items-center gap-[4px]">
            <span>{auto ? "OTSU" : "SEUIL"}</span>
            <BitReadout text={threshold.toFixed(2)} />
          </span>
          {ink !== null && (
            <span className="flex items-center gap-[4px]">
              <span>ENCRE</span>
              <BitReadout text={`${ink}%`} />
            </span>
          )}
          {data && (
            <span className="flex items-center gap-[4px]">
              <span>TRAME</span>
              <BitReadout text={`${data.cols}X${data.rows}`} />
            </span>
          )}
        </div>
        <div role="group" aria-label="Réglage du seuil" className="flex flex-wrap gap-[6px]">
          <Bloc
            onClick={() => manual(threshold - STEP)}
            aria-label="Baisser le seuil"
            className="min-w-cell2"
          >
            -
          </Bloc>
          <Bloc
            onClick={() => manual(threshold + STEP)}
            aria-label="Monter le seuil"
            className="min-w-cell2"
          >
            +
          </Bloc>
          <Bloc onClick={otsu} pressed={auto} aria-label="Seuil automatique (Otsu)">
            AUTO
          </Bloc>
        </div>
      </div>
    </div>
  );
}
