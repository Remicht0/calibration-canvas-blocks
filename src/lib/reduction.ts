// MIRE — reduction d'une photo apportee par le visiteur.
//
// Une seule pyramide pour deux fils. Le miroir la fait tourner dans un worker
// sur deux OffscreenCanvas et, la ou Worker ou OffscreenCanvas manquent, sur le
// fil principal sur deux <canvas>. Les deux chemins doivent rendre la meme
// trame au pixel pres : ils partagent donc ce fichier, son plafond et ses
// reglages de lissage. Deux copies du meme algorithme finiraient par diverger,
// et la trame 1-bit dependrait alors de ce que le navigateur sait faire.

/**
 * Rapport de reduction encore bon marche en une seule passe. Mesure sur ce
 * navigateur, source 8000 x 6000 vers 1600 x 1200 (rapport 5) : une passe coute
 * 30 ms, trois passes par moities en coutent 573 — ce sont les canvas
 * intermediaires de 48 et 24 Mo qui coutent, pas le reechantillonnage. Les
 * moities ne redeviennent utiles qu'au-dela.
 */
export const FACTEUR = 6;

/** Les deux seules toiles que la pyramide sait remplir. */
export type Toile = HTMLCanvasElement | OffscreenCanvas;

function passe(
  src: CanvasImageSource,
  sw: number,
  sh: number,
  dw: number,
  dh: number,
  cible: Toile,
) {
  cible.width = dw;
  cible.height = dh;
  const c = cible.getContext("2d");
  if (!c) throw new Error("canvas indisponible");
  c.imageSmoothingEnabled = true;
  c.imageSmoothingQuality = "high";
  c.clearRect(0, 0, dw, dh);
  c.drawImage(src, 0, 0, sw, sh, 0, 0, dw, dh);
}

/**
 * Reduit `bmp` a `tw` x `th` en alternant les deux toiles : par moities
 * successives tant que la source depasse la cible d'un facteur FACTEUR, puis
 * en une derniere passe. Rend la toile qui porte le resultat — `a` ou `b`, au
 * nombre de passes ; c'est a l'appelant de l'encoder (`toBlob` sur le fil
 * principal, `convertToBlob` dans un worker) puis de vider les deux.
 */
export function pyramide<T extends Toile>(bmp: ImageBitmap, tw: number, th: number, a: T, b: T): T {
  let source: CanvasImageSource = bmp;
  let sw = bmp.width;
  let sh = bmp.height;
  let cible = a;
  while (sw > tw * FACTEUR || sh > th * FACTEUR) {
    const dw = Math.max(tw, Math.round(sw / 2));
    const dh = Math.max(th, Math.round(sh / 2));
    passe(source, sw, sh, dw, dh, cible);
    source = cible;
    sw = dw;
    sh = dh;
    cible = cible === a ? b : a;
  }
  passe(source, sw, sh, tw, th, cible);
  return cible;
}

/**
 * Rend le backing store des toiles de reduction. Contrairement au canvas de
 * `sample()`, dimensionne a quelques milliers de pixels, celles-ci portent la
 * photo du visiteur reduite a 1600 px — jusqu'a 10 Mo d'image personnelle qui
 * resteraient lisibles par n'importe quel script du fil, longtemps apres
 * « SOURCE FERMEE ». Mettre la largeur a 0 vide le bitmap sans detruire la
 * toile, qui est partagee d'une image a l'autre.
 */
export function viderToiles(...toiles: Array<Toile | null>) {
  for (const t of toiles) if (t) t.width = t.height = 0;
}
