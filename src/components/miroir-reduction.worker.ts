/* ------------------------------------------------------------------ */
/* REDUCTEUR DU MIROIR — hors fil principal                            */
/* La photo du visiteur arrive ici par transfert (l'ImageBitmap change  */
/* de fil, il n'en est pas fait de copie) et repart en PNG reduit. Le   */
/* fil principal ne touche jamais les 48 Mpx : il ne voit passer qu'un  */
/* blob de quelques centaines de kilo-octets.                          */
/*                                                                      */
/* La pyramide elle-meme vit dans src/lib/reduction.ts, partagee avec   */
/* le repli synchrone de miroir.tsx : c'est la seule facon d'etre sur   */
/* que les deux fils rendent la meme trame 1-bit.                      */
/*                                                                      */
/* Vie privee : ce worker est cree pour une image et supprime des       */
/* qu'elle est reduite. Ses deux toiles sont vides avant la reponse et */
/* la source est fermee ici meme — rien de la photo ne survit au        */
/* travail, ni dans ce fil ni dans le fil principal.                   */
/* ------------------------------------------------------------------ */

import { pyramide, viderToiles } from "@/lib/reduction";

type Demande = {
  bmp: ImageBitmap;
  tw: number;
  th: number;
};

/* Le projet compile avec la bibliotheque DOM : `self` y est type comme une
   fenetre. La portee d'un worker n'expose que ce qui suit. */
type Portee = {
  postMessage(message: unknown, transfert?: Transferable[]): void;
  onmessage: ((e: MessageEvent<Demande>) => void) | null;
};
const portee = self as unknown as Portee;

/* Toiles de travail partagees d'une image a l'autre — mais ce worker n'en
   traite qu'une : elles ne servent qu'aux deux passes d'une meme pyramide. */
let passeA: OffscreenCanvas | null = null;
let passeB: OffscreenCanvas | null = null;

portee.onmessage = async (e: MessageEvent<Demande>) => {
  const { bmp, tw, th } = e.data;
  try {
    passeA ??= new OffscreenCanvas(1, 1);
    passeB ??= new OffscreenCanvas(1, 1);
    const cible = pyramide(bmp, tw, th, passeA, passeB);
    const blob = await cible.convertToBlob({ type: "image/png" });
    bmp.close();
    viderToiles(passeA, passeB);
    portee.postMessage({ blob });
  } catch (err) {
    bmp.close();
    viderToiles(passeA, passeB);
    portee.postMessage({ erreur: err instanceof Error ? err.message : "reduction impossible" });
  }
};

/* Le fil principal attend ce signal avant de transferer la photo : un worker
   qui ne se charge pas, ou une portee sans OffscreenCanvas, ne doit pas
   emporter la source avec lui — elle ne se recopie pas en arriere. */
portee.postMessage({ pret: typeof OffscreenCanvas !== "undefined" });
