/**
 * Arrivee demandee par un lien INDEX (barre haute, console, ligne de l'entree) :
 * la section INDEX de l'accueil prend alors le focus, et le Tab repart de
 * l'index comme apres une ancre native — sinon il repartait de la barre haute
 * et ramenait la page en haut. Pose par le lien, lu et remis a faux par
 * l'accueil : l'historique ne deplace pas le focus.
 */
export const arriveeIndex = { demandee: false };

/**
 * Focus sur la section INDEX, sans defiler : le saut est deja fait. La section
 * n'est focalisable que le temps de l'arrivee (tabindex retire au blur) : une
 * section focalisable en permanence prendrait le focus — et son contour — au
 * simple chargement de /#index, ou le navigateur focalise la cible de l'ancre.
 */
export const accueillirIndex = () => {
  arriveeIndex.demandee = false;
  const s = document.getElementById("index");
  if (!s) return;
  s.tabIndex = -1;
  s.addEventListener("blur", () => s.removeAttribute("tabindex"), { once: true });
  s.focus({ preventScroll: true });
};
