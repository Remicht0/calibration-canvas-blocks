import { useEffect, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { CalibrationBand } from "@/components/bars";
import { Bloc } from "@/components/bloc";

/** Raccourcis de la mire. Etiquettes en capitales sans accents (DESIGN.md §2). */
const KEYS: Array<[string, string]> = [
  ["N", "INVERSER LE SIGNAL (NEGATIF / POSITIF)"],
  ["?", "OUVRIR OU FERMER CETTE FICHE"],
  ["ESC", "FERMER LA FICHE"],
  ["FLECHES", "FEUILLETER LES PROJETS (PAGE PROJET)"],
  ["TAB", "PARCOURS CLAVIER, BLOC INVERSE"],
  ["SURVOL", "LOUPE DE MATIERE SUR UNE PLANCHE"],
  ["APPUI LONG", "LOUPE DE MATIERE (TACTILE)"],
  ["- / +", "SEUIL OU PALIERS DE LA PLANCHE SURVOLEE"],
  ["A", "SEUIL AUTOMATIQUE (OTSU)"],
  ["DEFILEMENT", "COMPOSE LES PLANCHES BLOC PAR BLOC"],
];

/** Ce qui devient inerte quand la fiche est ouverte : la page, la console, l'inverseur. */
const INERT = ["#contenu", 'nav[aria-label="Console de navigation"]', "#inverseur"];

/**
 * Fiche des raccourcis : masque plein ecran, noir plein, aucune transparence
 * decorative. Ouverture par la touche ? ou par le bouton de gouttiere.
 * Ouverte, elle est la seule surface vivante : page inerte, focus captif
 * sur FERMER, raccourcis des autres composants suspendus (classe mire-modal).
 */
export function KeyHelp() {
  const [open, setOpen] = useState(false);
  const openBtn = useRef<HTMLButtonElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const path = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (e.key === "?" || (e.key === "/" && e.shiftKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // changement de route : la fiche ne survit pas a la page qui l'a ouverte
  useEffect(() => setOpen(false), [path]);

  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    const before = document.activeElement;
    const opener = openBtn.current;
    const frozen = INERT.map((q) => document.querySelector<HTMLElement>(q)).filter(
      (el): el is HTMLElement => el !== null,
    );
    frozen.forEach((el) => el.setAttribute("inert", ""));
    root.classList.add("mire-modal");
    root.style.overflow = "hidden";
    const raf = requestAnimationFrame(() => closeBtn.current?.focus());
    return () => {
      cancelAnimationFrame(raf);
      frozen.forEach((el) => el.removeAttribute("inert"));
      root.classList.remove("mire-modal");
      root.style.overflow = "";
      const back =
        before instanceof HTMLElement && before !== document.body && before.isConnected
          ? before
          : opener;
      back?.focus();
    };
  }, [open]);

  return (
    <>
      <Bloc
        ref={openBtn}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="mire-noprint fixed bottom-cell right-cell z-[180] hidden md:inline-flex"
      >
        AIDE [?]
      </Bloc>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Raccourcis clavier de la mire"
          onKeyDown={(e) => {
            // FERMER est le seul element focalisable : le cycle Tab se referme sur lui
            if (e.key === "Tab") {
              e.preventDefault();
              closeBtn.current?.focus();
            }
          }}
          className="on-black fixed inset-0 z-[240] flex flex-col justify-between bg-black px-cell py-cell2 text-white"
        >
          <div className="u-mono flex items-center justify-between">
            <span>MIRE / FICHE DE COMMANDE</span>
            <Bloc ref={closeBtn} onClick={() => setOpen(false)}>
              FERMER [ESC]
            </Bloc>
          </div>

          <div>
            <h2 className="u-display text-[18vw] leading-[0.82] md:text-[9vw]">COMMANDES</h2>
            <ul className="mt-cell2 max-w-[62ch] border-t-[3px] border-white">
              {KEYS.map(([k, d]) => (
                <li
                  key={k}
                  className="u-mono grid grid-cols-[11ch_minmax(0,1fr)] gap-x-cell border-b-[3px] border-white py-cell"
                >
                  <span>{k}</span>
                  <span className="min-w-0">{d}</span>
                </li>
              ))}
            </ul>
          </div>

          <CalibrationBand height={5} seed={11} negative className="border-[3px] border-white" />
        </div>
      )}
    </>
  );
}
