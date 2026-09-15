/* ------------------------------------------------------------------ */
/* REDUCTEUR DU MIROIR — hors fil principal                            */
/* La photo du visiteur arrive ici par transfert (l'ImageBitmap change  */
/* de fil, il n'en est pas fait de copie) et repart en PNG reduit. Le   */
/* fil principal ne touche jamais les 48 Mpx : il ne voit passer qu'un  */
/* blob de quelques centaines de kilo-octets.                          */
/*                                                                      */
/* Vie privee : ce worker est cree pour une image et supprime des       */
/* qu'elle est reduite. Ses deux canvas sont vides avant la reponse et  */
/* la source est fermee ici meme — rien de la photo ne survit au        */
/* travail, ni dans ce fil ni dans le fil principal.                   */
/* ------------------------------------------------------------------ */

type Demande = {
  bmp: ImageBitmap;
  tw: number;
  th: number;
  facteur: number;
};

/* Le projet compile avec la bibliotheque DOM : `self` y est type comme une
   fenetre. La portee d'un worker n'expose que ce qui suit. */
type Portee = {
  postMessage(message: unknown, transfert?: Transferable[]): void;
  onmessage: ((e: MessageEvent<Demande>) => void) | null;
};
const portee = self as unknown as Portee;

/* Memes canvas de travail, meme reduction par moities que le chemin
   synchrone de miroir.tsx : le rendu 1-bit doit etre identique au pixel. */
let passeA: OffscreenCanvas | null = null;
let passeB: OffscreenCanvas | null = null;

function reduirePasse(
  src: CanvasImageSource,
  sw: number,
  sh: number,
  dw: number,
  dh: number,
  cible: OffscreenCanvas,
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

function liberer() {
  if (passeA) passeA.width = passeA.height = 0;
  if (passeB) passeB.width = passeB.height = 0;
}

portee.onmessage = async (e: MessageEvent<Demande>) => {
  const { bmp, tw, th, facteur } = e.data;
  try {
    passeA ??= new OffscreenCanvas(1, 1);
    passeB ??= new OffscreenCanvas(1, 1);
    let source: CanvasImageSource = bmp;
    let sw = bmp.width;
    let sh = bmp.height;
    let cible = passeA;
    while (sw > tw * facteur || sh > th * facteur) {
      const dw = Math.max(tw, Math.round(sw / 2));
      const dh = Math.max(th, Math.round(sh / 2));
      reduirePasse(source, sw, sh, dw, dh, cible);
      source = cible;
      sw = dw;
      sh = dh;
      cible = cible === passeA ? passeB : passeA;
    }
    reduirePasse(source, sw, sh, tw, th, cible);
    const blob = await cible.convertToBlob({ type: "image/png" });
    bmp.close();
    liberer();
    portee.postMessage({ blob });
  } catch (err) {
    bmp.close();
    liberer();
    portee.postMessage({ erreur: err instanceof Error ? err.message : "reduction impossible" });
  }
};

/* Le fil principal attend ce signal avant de transferer la photo : un worker
   qui ne se charge pas, ou une portee sans OffscreenCanvas, ne doit pas
   emporter la source avec lui — elle ne se recopie pas en arriere. */
portee.postMessage({ pret: typeof OffscreenCanvas !== "undefined" });
