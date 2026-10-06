import { useCallback, useEffect, useLayoutEffect, useState } from "react";

/*
 * Deux reglages du visiteur, memorises comme le negatif (classe sur <html>,
 * posee avant la premiere peinture par REGLAGES_BOOT_SCRIPT) :
 *   FIGE           : le mouvement s'arrete — bandeau, bandes de calibration,
 *                    videos ; tout le reste se pose comme sous « reduire les
 *                    animations » (prefersReducedMotion, lib/mire.ts) — WCAG 2.2.2 ;
 *   SANS_RACCOURCIS : les touches a un seul caractere (N, 1-9, - + A F, ?) ne
 *                    font plus rien ; fleches, Echap et Tab restent — WCAG 2.1.4.
 */
export type Reglage = { classe: string; cle: string; evenement: string };

export const FIGE: Reglage = { classe: "mire-fige", cle: "mire-fige", evenement: "mire:fige" };
export const SANS_RACCOURCIS: Reglage = {
  classe: "mire-sans-raccourcis",
  cle: "mire-raccourcis-coupes",
  evenement: "mire:raccourcis",
};

/** Script d'amorce (dans le <head>, comme celui du negatif) : muet si le stockage est refuse. */
export const REGLAGES_BOOT_SCRIPT = `try{[["${FIGE.cle}","${FIGE.classe}"],["${SANS_RACCOURCIS.cle}","${SANS_RACCOURCIS.classe}"]].forEach(function(r){if(localStorage.getItem(r[0])==="1")document.documentElement.classList.add(r[1])})}catch(e){}`;

export const actif = (r: Reglage) =>
  typeof document !== "undefined" && document.documentElement.classList.contains(r.classe);

/** Les raccourcis a un caractere sont-ils coupes ? A tester dans chaque gestionnaire de touche. */
export const raccourcisCoupes = () => actif(SANS_RACCOURCIS);

/** Seul chemin d'ecriture : classe, stockage et evenement bougent ensemble. */
export function poser(r: Reglage, on: boolean) {
  document.documentElement.classList.toggle(r.classe, on);
  try {
    localStorage.setItem(r.cle, on ? "1" : "0");
  } catch {
    // stockage refuse : le reglage vaut pour la visite en cours
  }
  window.dispatchEvent(new CustomEvent<boolean>(r.evenement, { detail: on }));
}

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** Etat d'un reglage, synchronise avec la classe et les autres composants. */
export function useReglage(r: Reglage): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(false);
  useIsoLayoutEffect(() => {
    setOn(actif(r));
    const sur = (e: Event) => setOn(Boolean((e as CustomEvent<boolean>).detail));
    window.addEventListener(r.evenement, sur);
    return () => window.removeEventListener(r.evenement, sur);
  }, [r]);
  const set = useCallback((v: boolean) => poser(r, v), [r]);
  return [on, set];
}
