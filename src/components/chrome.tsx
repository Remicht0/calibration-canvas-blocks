import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";

/* ------------------------------------------------------------------ */
/* Barre haute commune : MIRE + index de navigation, page courante     */
/* marquee d'un bloc. Sous 768 px, la console en bas d'ecran prend     */
/* le relais : seul MIRE et l'emplacement de droite restent.           */
/* ------------------------------------------------------------------ */

const ITEMS = [
  { to: "/", label: "INDEX" },
  { to: "/atelier", label: "ATELIER" },
  { to: "/contact", label: "CONTACT" },
] as const;

export function TopBar({ right, className = "" }: { right?: ReactNode; className?: string }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <header
      className={`u-mono grid grid-cols-[minmax(0,1fr)_auto] items-center gap-cell ${className}`}
    >
      <nav aria-label="Navigation principale" className="flex min-w-0 flex-wrap gap-x-cell2">
        <Link to="/" className="shrink-0">
          MIRE
        </Link>
        {ITEMS.map((t) => {
          const active = t.to === "/" ? path === "/" : path.startsWith(t.to);
          return (
            <Link
              key={t.to}
              to={t.to}
              aria-current={active ? "page" : undefined}
              className="hidden shrink-0 md:inline"
            >
              {active && <span aria-hidden="true">{"■ "}</span>}
              {t.label}
            </Link>
          );
        })}
      </nav>
      {right !== undefined && <div className="min-w-0 text-right">{right}</div>}
    </header>
  );
}
