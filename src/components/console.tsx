import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { bitUnit, cellSizeFor } from "@/lib/mire";
import { BitReadout } from "@/components/readout";

/* ------------------------------------------------------------------ */
/* Avancement de lecture : 0 -> 1, cale sur la frame                    */
/* ------------------------------------------------------------------ */

export function useScrollProgress() {
  const [p, setP] = useState(0);

  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setP(max > 8 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return p;
}

/* ------------------------------------------------------------------ */
/* Reperage des sections : [data-mire] porte le nom de la piste         */
/* ------------------------------------------------------------------ */

type Track = { label: string; start: number };

export function useTracks() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [tracks, setTracks] = useState<Track[]>([]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    let raf = 0;
    let list: Track[] = [];

    const measure = () => {
      const els = Array.from(document.querySelectorAll<HTMLElement>("[data-mire]"));
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      list = els.map((el) => ({
        label: el.dataset["mire"] ?? "",
        start: Math.min(1, (el.offsetTop - window.innerHeight * 0.35) / max),
      }));
      setTracks(list);
      locate();
    };

    const locate = () => {
      raf = 0;
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const p = window.scrollY / max;
      let i = 0;
      list.forEach((t, k) => {
        if (p >= t.start - 0.001) i = k;
      });
      setIndex(i);
    };

    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(locate);
    };

    // laisse le temps au layout de se poser apres un changement de route
    const t = window.setTimeout(measure, 60);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      window.clearTimeout(t);
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", measure);
    };
  }, [path]);

  return { tracks, index, current: tracks[index]?.label ?? "" };
}

/** Etat d'inversion, lu directement sur la racine (source unique : NegativeSwitch). */
function useNegative() {
  const [neg, setNeg] = useState(false);
  useEffect(() => {
    const el = document.documentElement;
    const sync = () => setNeg(el.classList.contains("mire-negative"));
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return neg;
}

const toggleNegative = () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "n" }));

const pct = (p: number) => `${String(Math.round(p * 100)).padStart(3, "0")}%`;

/** Pas de grille courant, suivi au redimensionnement (valeur bureau avant montage). */
function useCell() {
  const [cell, setCell] = useState(20);
  useEffect(() => {
    const set = () => setCell(cellSizeFor(window.innerWidth));
    set();
    window.addEventListener("resize", set);
    return () => window.removeEventListener("resize", set);
  }, []);
  return cell;
}

/* ------------------------------------------------------------------ */
/* ORDINATEUR — reglette de defilement, lue comme une amorce de film    */
/* ------------------------------------------------------------------ */

export function ScrollRail() {
  const p = useScrollProgress();
  const { tracks, index, current } = useTracks();
  const [rows, setRows] = useState(0);
  const cell = useCell();
  // pas de la reglette : un bloc de u, un vide de u
  const u = bitUnit(cell);

  useEffect(() => {
    const set = () => setRows(Math.max(10, Math.floor((window.innerHeight - cell * 16) / (u * 2))));
    set();
    window.addEventListener("resize", set);
    return () => window.removeEventListener("resize", set);
  }, [cell, u]);

  const head = Math.round(p * (rows - 1));

  return (
    <div
      aria-hidden="true"
      className="mire-noprint pointer-events-none fixed left-0 top-0 z-[120] hidden h-screen flex-col items-center justify-between py-cell2 mix-blend-difference md:flex"
      style={{ width: cell * 2, color: "#FFFFFF" }}
    >
      {/* compteur bitmap */}
      {/* compteur bitmap, un glyphe par rang : a une cellule de haut, la ligne ne tient pas dans deux cellules de large */}
      <div className="flex shrink-0 flex-col items-center" style={{ gap: u }}>
        {[...pct(p)].map((ch, i) => (
          <BitReadout key={i} text={ch} />
        ))}
      </div>

      {/* reglette : blocs pleins sur un pas u — vide u, pose 3u, repere 4u, tete 5u x 2u */}
      <div className="flex min-h-0 flex-1 flex-col justify-center py-cell" style={{ gap: u }}>
        {Array.from({ length: rows }, (_, i) => {
          const on = i <= head;
          const isHead = i === head;
          const mark = tracks.some((t) => Math.round(t.start * (rows - 1)) === i);
          return (
            <div
              key={i}
              style={{
                height: isHead ? u * 2 : u,
                width: isHead ? u * 5 : mark ? u * 4 : on ? u * 3 : u,
                background: "#FFFFFF",
              }}
            />
          );
        })}
      </div>

      {/* piste courante, ecrite dans le sens de la reglette */}
      <div
        className="u-mono max-h-[40vh] shrink-0 overflow-hidden whitespace-nowrap"
        style={{ writingMode: "vertical-rl", letterSpacing: "0.18em" }}
      >
        {current || "MIRE"}
        {tracks.length > 0 && ` / ${String(index + 1).padStart(2, "0")}`}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* MOBILE / TABLETTE — console de pilotage en bas d'ecran               */
/* ------------------------------------------------------------------ */

const TABS = [
  { to: "/", label: "INDEX" },
  { to: "/atelier", label: "ATELIER" },
  { to: "/contact", label: "CONTACT" },
] as const;

export function MireConsole() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const p = useScrollProgress();
  const neg = useNegative();
  const { tracks, index, current } = useTracks();
  const u = bitUnit(useCell());
  const steps = 20;
  const filled = Math.round(p * steps);

  return (
    <nav
      aria-label="Console de navigation"
      className="mire-noprint mire-chrome fixed inset-x-0 bottom-0 z-[140] border-t-[6px] border-black bg-white md:hidden"
    >
      {/* piste courante + compteur bitmap */}
      <div className="u-mono flex items-center justify-between gap-cell border-b-[3px] border-black px-[6px] py-[4px]">
        <span className="min-w-0 truncate">
          {current || "MIRE"}
          {tracks.length > 0 &&
            ` ${String(index + 1).padStart(2, "0")}/${String(tracks.length).padStart(2, "0")}`}
        </span>
        <span className="shrink-0">
          <BitReadout text={pct(p)} />
        </span>
      </div>

      {/* jauge : blocs pleins, un cran = 5 % ; cran vide = socle de u px */}
      <div className="flex h-[14px] w-full items-end gap-[2px] border-b-[3px] border-black px-[4px] py-[2px]">
        {Array.from({ length: steps }, (_, i) => (
          <div
            key={i}
            className="flex-1"
            style={{
              height: i < filled ? (i % 5 === 0 ? "100%" : "60%") : u,
              background: "#000000",
            }}
          />
        ))}
      </div>

      <div className="grid grid-cols-4">
        {TABS.map((t) => {
          const active = t.to === "/" ? path === "/" : path.startsWith(t.to);
          return (
            <Link
              key={t.to}
              to={t.to}
              aria-current={active ? "page" : undefined}
              className="u-mono border-r-[3px] border-black py-[10px] text-center"
              style={{
                background: active ? "#000000" : "#FFFFFF",
                color: active ? "#FFFFFF" : "#000000",
              }}
            >
              {t.label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={toggleNegative}
          aria-pressed={neg}
          aria-label={neg ? "Revenir au positif" : "Passer en négatif"}
          className="u-mono py-[10px] text-center"
          style={{
            background: neg ? "#000000" : "#FFFFFF",
            color: neg ? "#FFFFFF" : "#000000",
          }}
        >
          {neg ? "POSITIF" : "NEGATIF"}
        </button>
      </div>
    </nav>
  );
}
