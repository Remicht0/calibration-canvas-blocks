import { Link, useRouterState } from "@tanstack/react-router";
import type { MouseEvent, ReactNode } from "react";
import { accueillirIndex, arriveeIndex } from "@/lib/arrivee-index";

/* ------------------------------------------------------------------ */
/* Barre haute commune : MIRE + index de navigation, page courante     */
/* marquee d'un bloc. Sous 768 px, la console en bas d'ecran prend     */
/* le relais : seul MIRE et l'emplacement de droite restent.           */
/* ------------------------------------------------------------------ */

// saut sec : jamais smooth (DESIGN.md, tete de lecture clavier)
const SAUT = { block: "start", behavior: "instant" } as const;

/**
 * Le lien note que l'arrivee est demandee (focus sur la section, voir
 * arrivee-index.ts). Deja sur /#index, l'adresse ne change pas et le routeur
 * ne relance aucun defilement : apres un retour en haut de page, INDEX ne
 * ferait plus rien. Le saut est alors fait ici, sans nouvelle entree
 * d'historique.
 */
const versIndex = (e: MouseEvent) => {
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  arriveeIndex.demandee = true;
  if (window.location.pathname !== "/" || window.location.hash !== "#index") return;
  e.preventDefault();
  document.getElementById("index")?.scrollIntoView(SAUT);
  accueillirIndex();
};

/**
 * Lien vers la section INDEX de l'accueil (#index), d'ou qu'on parte : le
 * routeur y amene la page une fois rendue, d'un saut sec. MIRE, lui, reste
 * « / » et ramene en haut de l'entree.
 */
export const VERS_INDEX = {
  to: "/",
  hash: "index",
  hashScrollIntoView: SAUT,
  onClick: versIndex,
} as const;

const ITEMS = [
  { ...VERS_INDEX, label: "INDEX" },
  { to: "/atelier", label: "ATELIER" },
  { to: "/a-propos", label: "A PROPOS" },
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
        {ITEMS.map(({ label, ...lien }) => {
          // INDEX est courant sur tout l'accueil, quelle que soit l'ancre
          const active = lien.to === "/" ? path === "/" : path.startsWith(lien.to);
          return (
            <Link
              key={label}
              {...lien}
              aria-current={active ? "page" : undefined}
              className="hidden shrink-0 md:inline"
            >
              {active && (
                <i
                  aria-hidden="true"
                  className="mr-[6px] inline-block size-[10px] bg-current align-middle"
                />
              )}
              {label}
            </Link>
          );
        })}
      </nav>
      {right !== undefined && <div className="min-w-0 text-right">{right}</div>}
    </header>
  );
}
