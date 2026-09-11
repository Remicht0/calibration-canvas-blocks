import { useEffect, useState } from "react";
import { CalibrationBand } from "@/components/bars";

/** Raccourcis de la mire. Etiquettes en capitales sans accents (DESIGN.md §2). */
const KEYS: Array<[string, string]> = [
  ["N", "INVERSER LE SIGNAL (NEGATIF / POSITIF)"],
  ["?", "OUVRIR OU FERMER CETTE FICHE"],
  ["FLECHES", "FEUILLETER LES PROJETS (PAGE PROJET)"],
  ["TAB", "PARCOURS CLAVIER, CONTOUR ROUGE"],
  ["SURVOL", "LOUPE DE MATIERE SUR UNE PLANCHE"],
  ["DEFILEMENT", "LA LIGNE ROUGE LIT LES TITRES, COMPOSE LES PLANCHES"],
  ["CURSEUR", "USE LES TITRES EN BLOCS, ILS SE REPOSENT"],
];

/**
 * Fiche des raccourcis : masque plein ecran, noir plein, aucune transparence
 * decorative. Ouverture par la touche ? ou par le bouton de gouttiere.
 */
export function KeyHelp() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && /^(INPUT|TEXTAREA)$/.test(t.tagName)) return;
      if (e.key === "?" || (e.key === "/" && e.shiftKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="u-mono fixed bottom-cell right-cell z-[190] hidden border-[3px] border-black bg-white px-cell py-[3px] text-black md:block"
      >
        AIDE [?]
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Raccourcis clavier de la mire"
          className="fixed inset-0 z-[240] flex flex-col justify-between bg-black px-cell py-cell2 text-white"
        >
          <div className="u-mono flex justify-between">
            <span>MIRE / FICHE DE COMMANDE</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="border-[3px] border-white px-cell py-[3px]"
            >
              FERMER [ESC]
            </button>
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

          <CalibrationBand height={5} seed={11} className="border-[3px] border-white" />
        </div>
      )}
    </>
  );
}
