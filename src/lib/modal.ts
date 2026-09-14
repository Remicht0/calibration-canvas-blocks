/* ------------------------------------------------------------------ */
/* Verrou de page pour un masque captif (fiche de commande, plein      */
/* cadre) : la page, la console et l'inverseur deviennent inertes, le  */
/* defilement est bloque, la classe mire-modal suspend les raccourcis  */
/* des autres composants. Compte les ouvertures imbriquees : la page   */
/* n'est rendue qu'a la fermeture du dernier masque.                   */
/*                                                                      */
/* Le verrou emet lui-meme mire:modal : sous un masque plein ecran,     */
/* aucune planche de la page ne doit continuer a echantillonner (budget */
/* de rendu, DESIGN.md §7). C'est une propriete du masque, pas de celui */
/* qui l'ouvre — un masque qui oublierait de l'emettre laisserait la    */
/* camera du miroir lue a 60 im/s derriere un aplat noir.               */
/* ------------------------------------------------------------------ */

/** Emis par le verrou : a true les planches de la page s'arretent, a false elles reprennent. */
export const MODAL_EVENT = "mire:modal";

const signal = (ouvert: boolean) =>
  window.dispatchEvent(new CustomEvent(MODAL_EVENT, { detail: ouvert }));

const INERT = [
  "#contenu",
  "#evitement",
  "#aide",
  'nav[aria-label="Console de navigation"]',
  "#inverseur",
];

let depth = 0;
let frozen: HTMLElement[] = [];

export function lockPage() {
  if (depth++ > 0) return;
  const root = document.documentElement;
  frozen = INERT.map((q) => document.querySelector<HTMLElement>(q)).filter(
    (el): el is HTMLElement => el !== null,
  );
  frozen.forEach((el) => el.setAttribute("inert", ""));
  root.classList.add("mire-modal");
  root.style.overflow = "hidden";
  signal(true);
}

export function unlockPage() {
  if (depth === 0 || --depth > 0) return;
  const root = document.documentElement;
  frozen.forEach((el) => el.removeAttribute("inert"));
  frozen = [];
  root.classList.remove("mire-modal");
  root.style.overflow = "";
  signal(false);
}
