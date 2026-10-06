import { useEffect, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { CalibrationBand } from "@/components/bars";
import { Bloc } from "@/components/bloc";
import { projects } from "@/lib/projects";
import { lockPage, unlockPage } from "@/lib/modal";
import { FIGE, SANS_RACCOURCIS, raccourcisCoupes, useReglage } from "@/lib/reglages";

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
  const coupeBtn = useRef<HTMLButtonElement>(null);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [fige, setFige] = useReglage(FIGE);
  const [coupes, setCoupes] = useReglage(SANS_RACCOURCIS);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (!raccourcisCoupes() && (e.key === "?" || (e.key === "/" && e.shiftKey))) {
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
    // lockPage emet mire:modal : sous ce masque noir plein, aucune planche de
    // la page ne continue a echantillonner — le miroir tenait sinon la camera
    // du visiteur a 60 im/s derriere un aplat opaque
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
      {/* gouttiere droite, en bas : FIGER puis AIDE, verticaux comme l'inverseur ;
          ils ne passent jamais sur le contenu */}
      <div className="mire-chrome mire-noprint fixed bottom-cell right-0 z-[180] hidden flex-col gap-cell md:flex">
        <Bloc
          onClick={() => setFige(!fige)}
          pressed={fige}
          id="figer"
          aria-label="Figer le mouvement : bandeau, bandes et vidéos"
          className="h-auto w-cell2 px-cell py-0"
          style={{ writingMode: "vertical-rl" }}
        >
          FIGER
        </Bloc>
        <Bloc
          ref={openBtn}
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="dialog"
          aria-keyshortcuts={coupes ? undefined : "?"}
          id="aide"
          className="h-auto w-cell2 px-cell py-0"
          style={{ writingMode: "vertical-rl" }}
        >
          {coupes ? "AIDE" : "AIDE [?]"}
        </Bloc>
      </div>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Raccourcis clavier de la mire"
          onKeyDown={(e) => {
            // deux arrets, FERMER et RACCOURCIS : le cycle Tab se referme sur eux
            if (e.key === "Tab") {
              e.preventDefault();
              const surFermer = document.activeElement === closeBtn.current;
              (surFermer ? coupeBtn : closeBtn).current?.focus();
            }
          }}
          className="mire-noprint on-black fixed inset-0 z-[240] flex flex-col justify-between overflow-y-auto bg-black px-cell py-cell2 text-white"
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
              <li className="u-mono grid grid-cols-[11ch_minmax(0,1fr)] items-center gap-x-cell border-b-[3px] border-white py-cell md:col-span-2">
                <span>RACCOURCIS</span>
                <span className="flex min-w-0 flex-wrap items-center gap-x-cell gap-y-[6px]">
                  <Bloc
                    ref={coupeBtn}
                    onClick={() => setCoupes(!coupes)}
                    pressed={coupes}
                    aria-label="Couper les raccourcis à une touche (N, chiffres, - + A F, ?)"
                  >
                    {coupes ? "COUPES" : "ACTIFS"}
                  </Bloc>
                  <span>LES TOUCHES A UN CARACTERE ; FLECHES, ECHAP ET TAB RESTENT</span>
                </span>
              </li>
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
