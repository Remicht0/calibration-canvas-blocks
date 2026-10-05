import { useCallback, useEffect, useState } from "react";

/**
 * TOUT EN NET : la page projet passe toutes ses planches en lecture NET d'un
 * seul geste. Le choix du visiteur tient le temps de la session (d'un projet a
 * l'autre, au rechargement), jamais d'une visite a l'autre : une planche
 * s'ouvre toujours en blocs pour un nouveau visiteur. Lu apres l'hydratation,
 * le rendu serveur est toujours en blocs.
 */
const CLE = "mire-tout-net";

export function useToutNet(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(false);
  useEffect(() => {
    try {
      setOn(sessionStorage.getItem(CLE) === "1");
    } catch {
      /* stockage refuse : la page reste en blocs */
    }
  }, []);
  const set = useCallback((v: boolean) => {
    setOn(v);
    try {
      if (v) sessionStorage.setItem(CLE, "1");
      else sessionStorage.removeItem(CLE);
    } catch {
      /* stockage refuse : le choix vaut pour cette page */
    }
  }, []);
  return [on, set];
}
