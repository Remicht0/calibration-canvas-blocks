import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { cellSizeFor } from "@/lib/mire";

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

const toggleNegative = () =>
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "n" }));

/* ------------------------------------------------------------------ */
/* ORDINATEUR — colonne de blocs dans la marge gauche                   */
/* ------------------------------------------------------------------ */

export function ScrollRail() {
  const p = useScrollProgress();
  const [cell, setCell] = useState(20);

  useEffect(() => {
    const set = () => setCell(cellSizeFor(window.innerWidth));
    set();
    window.addEventListener("resize", set);
    return () => window.removeEventListener("resize", set);
  }, []);

  const total = Math.max(6, Math.floor((typeof window === "undefined" ? 800 : window.innerHeight) / cell) - 4);
  const filled = Math.round(p * total);

  return (
    <div
      aria-hidden="true"
      className="mire-noprint pointer-events-none fixed left-0 top-0 z-[120] hidden h-screen flex-col justify-center gap-[2px] px-[3px] mix-blend-difference md:flex"
      style={{ width: cell }}
    >
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          style={{
            height: 3,
            background: i < filled ? "#FFFFFF" : "transparent",
            outline: i < filled ? "none" : "1px solid rgba(255,255,255,0.35)",
          }}
        />
      ))}
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
  const steps = 24;
  const filled = Math.round(p * steps);

  return (
    <nav
      aria-label="Navigation"
      className="mire-noprint fixed inset-x-0 bottom-0 z-[140] border-t-[6px] border-black bg-white md:hidden"
    >
      {/* jauge de lecture : blocs pleins, aucune barre lisse */}
      <div className="flex h-[8px] w-full gap-[2px] border-b-[3px] border-black px-[2px] py-[1px]">
        {Array.from({ length: steps }, (_, i) => (
          <div
            key={i}
            className="h-full flex-1"
            style={{ background: i < filled ? "#000000" : "transparent" }}
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
