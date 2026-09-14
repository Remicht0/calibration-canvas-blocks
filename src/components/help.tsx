import { useEffect, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { CalibrationBand } from "@/components/bars";
import { Bloc } from "@/components/bloc";
import { projects } from "@/lib/projects";
import { lockPage, unlockPage } from "@/lib/modal";

/** Raccourcis de la mire. Etiquettes en capitales sans accents (DESIGN.md §2). */
const KEYS: Array<[string, string]> = [
  ["N", "INVERSER LE SIGNAL (NEGATIF / POSITIF)"],
  ["?", "OUVRIR OU FERMER CETTE FICHE"],
  ["ESC", "FERMER LA FICHE"],
  ["FLECHES", "GAUCHE / DROITE : FEUILLETER LES PROJETS (PAGE PROJET)"],
  ["HAUT / BAS", "TETE DE LECTURE SUR L'INDEX"],
  [`1 - ${projects.length}`, "SAUT DIRECT AU PROJET N"],
  ["TAB", "PARCOURS CLAVIER, BLOC INVERSE"],
  ["SURVOL", "LOUPE DE MATIERE SUR UNE PLANCHE"],
  ["APPUI LONG", "LOUPE DE MATIERE (TACTILE)"],
  ["- / +", "SEUIL OU PALIERS DE LA PLANCHE SURVOLEE"],
  ["A", "SEUIL AUTOMATIQUE (OTSU)"],
  ["F", "PLEIN CADRE DE LA PLANCHE SURVOLEE"],
  ["CTRL+V", "COLLER UNE IMAGE DANS LE MIROIR (ATELIER)"],
  ["DEFILEMENT", "LA LIGNE ROUGE LIT LES TITRES, COMPOSE LES PLANCHES"],
  ["CURSEUR", "USE LES TITRES EN BLOCS, ILS SE REPOSENT"],
];

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
        // un autre masque est ouvert : la fiche ne passe pas dessous
        setOpen((v) => (!v && document.documentElement.classList.contains("mire-modal") ? v : !v));
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
    const before = document.activeElement;
    const opener = openBtn.current;
    lockPage();
    const raf = requestAnimationFrame(() => closeBtn.current?.focus());
    return () => {
      cancelAnimationFrame(raf);
      unlockPage();
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
        aria-haspopup="dialog"
        aria-keyshortcuts="?"
        id="aide"
        className="mire-chrome mire-noprint fixed bottom-cell right-cell z-[180] hidden md:inline-flex"
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
          className="on-black fixed inset-0 z-[240] flex flex-col justify-between overflow-y-auto bg-black px-cell py-cell2 text-white"
        >
          <div className="u-mono flex items-center justify-between">
            <span>MIRE / FICHE DE COMMANDE</span>
            <Bloc ref={closeBtn} onClick={() => setOpen(false)}>
              FERMER [ESC]
            </Bloc>
          </div>

          <div>
            <h2 className="u-display text-[18vw] leading-[0.82] md:text-[9vw]">COMMANDES</h2>
            <ul className="mt-cell2 max-w-[62ch] border-t-[3px] border-white md:grid md:max-w-none md:grid-cols-2 md:gap-x-cell2">
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
