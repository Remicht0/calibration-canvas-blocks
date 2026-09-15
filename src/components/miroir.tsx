import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { Bloc } from "@/components/bloc";
import { HybridMedia } from "@/components/media";
import { BitReadout } from "@/components/readout";
import { releaseSampleBuffer } from "@/lib/bitmap";
import { mireText } from "@/lib/glyphs";
import { cellSizeFor } from "@/lib/mire";

/* ------------------------------------------------------------------ */
/* INSTRUMENT 05 — MIROIR                                              */
/* Le site cesse de calibrer des images de demonstration : il calibre   */
/* le visiteur. Sa camera, ou une image qu'il depose, passe par le      */
/* meme noyau que toutes les planches (HybridMedia : BIN / GRIS /       */
/* BRUT, seuil, Otsu, loupe, encrage, plein cadre).                     */
/*                                                                      */
/* Vie privee, pas optimisation : la camera s'arrete (pistes stoppees,  */
/* voyant eteint) au demontage, au changement de route, quand la        */
/* section sort de l'ecran, quand l'onglet est cache, au depart de la   */
/* page et a son retour du bfcache — y compris quand la permission est  */
/* encore en vol : une autorisation accordee apres coup est invalidee   */
/* par le jeton, et ses pistes arretees a la resolution. Seul           */
/* track.stop() eteint le voyant, ni pause() ni srcObject = null.       */
/* Rien n'est envoye, rien n'est stocke : aucune requete, aucun         */
/* localStorage, aucun MediaRecorder, et audio: false explicite ; les   */
/* canvas de travail rendent leur bitmap des que la source est fermee,  */
/* et le worker qui reduit une photo deposee est supprime avec elle.    */
/* ------------------------------------------------------------------ */

/* « lecture » : un fichier est en cours de decodage. C'est un etat a part
   entiere et non un repos, sinon rien ne permet de l'annuler — une photo de
   40 Mpx tient la planche plus d'une seconde. */
type Etat = "repos" | "demande" | "lecture" | "camera" | "image";

/* Dans la mire : capitales sans accents (DESIGN.md §2). */
const AUCUNE = "AUCUNE SOURCE";
/* Le raccourci nomme est celui du clavier du visiteur : CTRL+V n'existe pas
   sur un Mac, et une mire n'affiche pas une touche qui ne repond pas. */
const depot = (pomme: boolean) =>
  `OU DEPOSER UNE IMAGE ICI — OU COLLER AVEC ${pomme ? "CMD" : "CTRL"}+V`;
/* Pointeur grossier : ni depot ni raccourci clavier, seul le bloc existe. */
const DEPOT_TACTILE = "OU CHOISIR UNE IMAGE CI-DESSOUS.";
const REPLI = "LE CHOIX D'UNE IMAGE RESTE POSSIBLE.";
const CONFIDENTIALITE =
  "RIEN N'EST ENVOYE. LA MIRE EST CALCULEE DANS VOTRE NAVIGATEUR, LA SOURCE NE QUITTE JAMAIS VOTRE APPAREIL.";

/* Le rattrapage de focus doit tenir dans la meme commit que le demontage :
   un effet passif laisse une image peinte ou plus rien n'est focalise, et un
   lecteur d'ecran peut la lire. Effet de disposition cote navigateur, effet
   ordinaire au rendu serveur (ou il ne s'execute jamais). */
const useCommit = typeof window === "undefined" ? useEffect : useLayoutEffect;

/* Hors mire : francais accentue, bas de casse (lecteurs d'ecran). */
const ALT_CAMERA = "Votre caméra, échantillonnée en blocs noirs et blancs.";
const ALT_IMAGE = "Votre image, échantillonnée en blocs noirs et blancs.";

/* Hauteur de la planche : colonnes x RATIO, comme toute planche du site. */
const RATIO = 0.62;

/* Le creux reserve la planche ET son cartouche : sans lui, tout ce qui suit
   la section remonte d'une cinquantaine de pixels des que la camera s'arrete,
   et redescend a la reouverture. Le cartouche est mesure sur la planche
   montee (sa hauteur depend de ce qui tient sur une ligne) ; avant toute
   mesure, ces estimations par largeur, les memes que la reserve CSS de
   .mire-creux-cadre. Marge mt-[3px] + deux filets de 3 px = 9 px. */
const FILETS = 9;
const MARGE = 3;
const RANGS: Array<[number, number]> = [
  [640, 8],
  [1100, 4],
  [Infinity, 2],
];
const cellulesCartouche = (largeur: number) => RANGS.find(([w]) => largeur < w)![1];

/* Au-dela, un canvas rend du vide sans lever d'erreur sur iOS (~16,7 Mpx d'aire utile). */
const MAX_PIXELS = 50_000_000;
/* 1600 px sur le grand cote : ~16 pixels source par cellule, meme en plein cadre. */
const MAX_COTE = 1600;

/* Rapport de reduction encore bon marche en une seule passe. Mesure sur ce
   navigateur, source 8000 x 6000 vers 1600 x 1200 (rapport 5) : une passe
   coute 30 ms, trois passes par moities en coutent 573 — ce sont les canvas
   intermediaires de 48 et 24 Mo qui coutent, pas le reechantillonnage. Les
   moities ne redeviennent utiles qu'au-dela. Le worker et le repli partagent
   ce plafond : deux pyramides differentes donneraient deux trames. */
const FACTEUR = 6;

/* Le reducteur hors fil principal se charge en quelques millisecondes. Au-dela,
   quelque chose l'en empeche (hors ligne, chunk absent, portee bridee) : la
   reduction repart sur le fil principal plutot que d'attendre indefiniment
   devant « LECTURE DU FICHIER ». */
const ATTENTE_REDUCTEUR = 4000;

/* Canvas de travail partages du chemin de repli, comme sample() : un canvas
   neuf par appel ferait tourner le ramasse-miettes. */
let passeA: HTMLCanvasElement | null = null;
let passeB: HTMLCanvasElement | null = null;

/**
 * Rend le backing store des deux canvas de reduction. Contrairement au canvas
 * de sample(), dimensionne a quelques milliers de pixels, celui-ci porte la
 * photo du visiteur reduite a 1600 px — jusqu'a 10 Mo d'image personnelle qui
 * resteraient lisibles par n'importe quel script de la page, sur toutes les
 * pages de la session, longtemps apres « SOURCE FERMEE ». Mettre la largeur a
 * 0 vide le bitmap sans detruire l'element partage.
 */
function libererPasses() {
  if (passeA) passeA.width = passeA.height = 0;
  if (passeB) passeB.width = passeB.height = 0;
}

function reduirePasse(
  src: CanvasImageSource,
  sw: number,
  sh: number,
  dw: number,
  dh: number,
  cible: HTMLCanvasElement,
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

/* Le reechantillonnage par createImageBitmap(bmp, { resizeWidth, resizeHeight,
   resizeQuality: "high" }) a ete mesure sur la meme photo de 48 Mpx : trame
   identique au pixel pres, mais 76 a 98 ms de fil principal tout de meme — il
   reste a dessiner le resultat dans un canvas et a l'encoder en PNG, et c'est
   la que le gel se trouve. Il aurait aussi laisse la qualite de la reduction
   au bon vouloir de chaque moteur, la ou la pyramide la fixe. */

/**
 * Reduction sur le fil principal : le repli, quand le navigateur n'a ni Worker
 * ni OffscreenCanvas, ou que le reducteur n'a pas repondu. Elle gele la page le
 * temps de la pyramide et de l'encodage — c'est exactement ce qu'on evite
 * ailleurs, mais mieux vaut une page qui bloque qu'une page qui refuse.
 */
async function reduireIci(bmp: ImageBitmap, tw: number, th: number): Promise<Blob> {
  passeA ??= document.createElement("canvas");
  passeB ??= document.createElement("canvas");
  let source: CanvasImageSource = bmp;
  let sw = bmp.width;
  let sh = bmp.height;
  let cible = passeA;
  while (sw > tw * FACTEUR || sh > th * FACTEUR) {
    const dw = Math.max(tw, Math.round(sw / 2));
    const dh = Math.max(th, Math.round(sh / 2));
    reduirePasse(source, sw, sh, dw, dh, cible);
    source = cible;
    sw = dw;
    sh = dh;
    cible = cible === passeA ? passeB : passeA;
  }
  reduirePasse(source, sw, sh, tw, th, cible);
  const blob = await new Promise<Blob | null>((ok) => cible.toBlob(ok, "image/png"));
  if (!blob) throw new Error("encodage impossible");
  return blob;
}

/**
 * Ouvre le reducteur. Le worker n'est jamais construit au chargement du module
 * — le rendu serveur n'a pas de Worker — et jamais garde entre deux images :
 * il nait avec une photo et meurt avec elle, comme les canvas de travail.
 * Il annonce sa portee avant de recevoir quoi que ce soit : un worker qui ne se
 * charge pas ne doit pas emporter la source, un ImageBitmap transfere ne
 * revient pas. Retourne null quand il n'y a pas de hors-fil ici.
 */
function ouvrirReducteur(): Promise<Worker | null> {
  if (typeof Worker === "undefined" || typeof OffscreenCanvas === "undefined")
    return Promise.resolve(null);
  let w: Worker;
  try {
    w = new Worker(new URL("./miroir-reduction.worker.ts", import.meta.url), { type: "module" });
  } catch {
    return Promise.resolve(null);
  }
  return new Promise<Worker | null>((ok) => {
    let minuteur = 0;
    const rater = () => {
      clearTimeout(minuteur);
      w.terminate();
      ok(null);
    };
    minuteur = window.setTimeout(rater, ATTENTE_REDUCTEUR);
    w.addEventListener("error", rater, { once: true });
    w.addEventListener(
      "message",
      (e: MessageEvent<{ pret?: boolean }>) => {
        if (!e.data?.pret) return rater();
        clearTimeout(minuteur);
        ok(w);
      },
      { once: true },
    );
  });
}

/**
 * Reduction hors fil principal : la photo change de fil par transfert, sans
 * copie, et ne revient qu'en PNG de quelques centaines de kilo-octets.
 */
function reduireHorsFil(w: Worker, bmp: ImageBitmap, tw: number, th: number): Promise<Blob> {
  return new Promise<Blob>((ok, non) => {
    w.addEventListener("error", () => non(new Error("reducteur perdu")), { once: true });
    w.addEventListener(
      "message",
      (e: MessageEvent<{ blob?: Blob; erreur?: string }>) => {
        if (e.data?.blob) ok(e.data.blob);
        else non(new Error(e.data?.erreur ?? "reduction impossible"));
      },
      { once: true },
    );
    w.postMessage({ bmp, tw, th, facteur: FACTEUR }, [bmp]);
  });
}

async function reduire(
  file: File,
  bmp: ImageBitmap,
  tw: number,
  th: number,
  reducteur: Worker | null,
): Promise<Blob> {
  if (!reducteur) return reduireIci(bmp, tw, th);
  try {
    return await reduireHorsFil(reducteur, bmp, tw, th);
  } catch {
    /* Le reducteur a lache apres le transfert : la source lui appartient
       desormais et ne revient pas. On la redecode pour finir sur le fil
       principal — un fichier valide ne doit pas ressortir « ILLISIBLE ». */
    const repli = await createImageBitmap(file);
    try {
      return await reduireIci(repli, tw, th);
    } finally {
      repli.close();
    }
  }
}

/**
 * Valide par decodage (jamais sur file.type ni sur l'extension : un texte
 * renomme .png arrive avec le type image/png) puis reduit a 1600 px une fois
 * pour toutes. Decodage et reduction sont tous deux hors fil principal : sur
 * une photo de 48 Mpx, la reduction coute ~100 ms de travail pour 8 ms de gel,
 * et le depot entier bloque au plus ~30 ms, montage de la planche compris. Le
 * meme depot par le repli synchrone bloque ~200 ms.
 * Reduire une seule fois est indispensable : sample() rappelle la source a
 * chaque redimensionnement, a chaque bascule 16 / 20 px et a chaque plein cadre.
 */
async function preparer(file: File): Promise<string> {
  /* Le reducteur se charge pendant que le fichier se decode : ni l'un ni
     l'autre ne tient le fil principal, autant qu'ils courent ensemble. */
  const ouverture = ouvrirReducteur();
  let bmp: ImageBitmap | null = null;
  try {
    bmp = await createImageBitmap(file);
    if (bmp.width * bmp.height > MAX_PIXELS) throw new RangeError("TROP GRANDE");
    const k = Math.min(1, MAX_COTE / Math.max(bmp.width, bmp.height));
    const tw = Math.max(1, Math.round(bmp.width * k));
    const th = Math.max(1, Math.round(bmp.height * k));
    const blob = await reduire(file, bmp, tw, th, await ouverture);
    return URL.createObjectURL(blob);
  } finally {
    // qu'elle ait abouti ou non, l'ouverture ne survit pas a l'image
    void ouverture.then((w) => w?.terminate());
    bmp?.close();
    // le blob est lu, l'image du visiteur n'a plus a rester en memoire
    libererPasses();
  }
}

/**
 * Etiquette visible de la planche, tiree du nom du fichier. mireText retire
 * les accents, mais un nom de fichier contient ce que le visiteur veut :
 * la fonte du site n'a que des capitales latines, et tout le reste sortirait
 * en carres vides dans le cartouche. Ce qui ne tient pas dans l'alphabet de
 * la mire est donc retire, et un nom entierement hors alphabet devient IMAGE.
 */
function etiquette(nomFichier: string) {
  const t = mireText(nomFichier)
    .replace(/\.[A-Z0-9]+$/, "")
    .replace(/[^A-Z0-9 .,:;!?()[\]/%+\-'"]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 22)
    .trim();
  return t || "IMAGE";
}

function horodatage() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

export function Miroir() {
  const [etat, setEtat] = useState<Etat>("repos");
  const [avis, setAvis] = useState(AUCUNE);
  const [detail, setDetail] = useState("");
  const [flux, setFlux] = useState<MediaStream | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [nom, setNom] = useState("");
  const [nbCams, setNbCams] = useState(0);
  const [numCam, setNumCam] = useState(1);
  const [coarse, setCoarse] = useState(false);
  const [pomme, setPomme] = useState(false);
  const [apiOk, setApiOk] = useState(true);
  /* Un jeton par annonce : deux ENREGISTRER de suite envoient deux fois le
     meme texte, React abandonne le rendu sur l'egalite et le noeud n'est pas
     mute — aucun lecteur d'ecran ne dit rien. Le jeton force la mutation. */
  const [annonce, setAnnonce] = useState({ n: 0, texte: "" });

  const racine = useRef<HTMLDivElement>(null);
  const zone = useRef<HTMLDivElement>(null);
  const planche = useRef<HTMLCanvasElement | null>(null);
  const fichier = useRef<HTMLInputElement>(null);
  const ouvrirBtn = useRef<HTMLButtonElement>(null);
  const fermerBtn = useRef<HTMLButtonElement>(null);
  const fluxRef = useRef<MediaStream | null>(null);
  const urlRef = useRef<string | null>(null);
  const visible = useRef(false);
  const cams = useRef<MediaDeviceInfo[]>([]);
  const idxCam = useRef(0);
  const facing = useRef<"user" | "environment">("user");
  const demande = useRef(0);
  /* Le focus est-il dans l'instrument, et un changement d'etat vient-il de
     retirer la commande qui le portait ? (voir le rattrapage plus bas) */
  const dedans = useRef(false);
  const rendre = useRef(false);

  const path = useRouterState({ select: (s) => s.location.pathname });
  const origine = useRef(path);

  const dire = useCallback((texte: string) => setAnnonce((a) => ({ n: a.n + 1, texte })), []);

  /* La region live ne reste pas lisible au curseur virtuel : une fois
     annoncee, elle se vide — sinon un visiteur qui parcourt la page lit
     « Caméra arrêtée » en plein milieu alors que rien ne se passe. */
  useEffect(() => {
    if (!annonce.texte) return;
    const t = window.setTimeout(
      () => setAnnonce((a) => (a.n === annonce.n ? { n: a.n, texte: "" } : a)),
      4000,
    );
    return () => clearTimeout(t);
  }, [annonce]);

  /* Tout changement d'etat peut retirer la commande active : le rattrapage de
     focus s'arme ici, une seule fois, pour les sept chemins. */
  const aller = useCallback((e: Etat) => {
    rendre.current = true;
    setEtat(e);
  }, []);

  /* Le cadre de repos a la taille exacte de la planche qui va le remplacer,
     cartouche compris : aucun saut de mise en page a l'ouverture ni a l'arret,
     et la hauteur reste un multiple de la cellule — la meme geometrie que
     build() dans HybridMedia. */

  /* Hauteur reelle du cartouche, lue sur la planche montee et retenue pour le
     creux suivant : elle depend de ce qui tient sur une ligne, pas d'un point
     de rupture. Le cartouche appartient a la planche, donc au creux. */
  const [cartouche, setCartouche] = useState(0);

  const [creux, setCreux] = useState(0);
  useEffect(() => {
    const el = zone.current;
    if (!el) return;
    const mesure = () => {
      const cell = cellSizeFor(window.innerWidth);
      const cols = Math.max(6, Math.floor(el.clientWidth / cell));
      const rows = Math.max(4, Math.round(cols * RATIO));
      const bas = cartouche || cellulesCartouche(window.innerWidth) * cell + FILETS;
      setCreux(rows * cell + bas);
    };
    mesure();
    const ro = new ResizeObserver(mesure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [cartouche]);

  useEffect(() => {
    setCoarse(window.matchMedia("(pointer: coarse)").matches);
    setPomme(/Mac|iPhone|iPad|iPod/.test(navigator.platform || ""));
    // sur une origine non securisee, mediaDevices vaut undefined : aucune
    // exception a attraper, et un bouton mort serait un mensonge de mire
    setApiOk(typeof navigator.mediaDevices?.getUserMedia === "function");
  }, []);

  const etatRef = useRef<Etat>(etat);
  etatRef.current = etat;

  /* Seule sortie qui eteint le voyant. Idempotente : appelee par sept chemins. */
  const couper = useCallback(() => {
    // toute demande encore en vol est invalidee ici : sans ce compteur, une
    // permission accordee apres un depart de page ouvrirait la camera sur une
    // planche qui n'existe plus, et plus personne ne pourrait l'eteindre
    demande.current++;
    const s = fluxRef.current;
    if (!s) return false;
    fluxRef.current = null;
    s.getTracks().forEach((t) => {
      t.onended = null;
      t.onmute = null;
      t.stop();
    });
    return true;
  }, []);

  const arreter = useCallback(
    (a: string, d: string, dit: string) => {
      const avait = couper();
      // rien a annoncer s'il n'y avait ni flux ouvert, ni demande en vol, ni
      // interface affirmant une camera — ce dernier cas est le retour de
      // bfcache : pagehide a coupe les pistes, l'etat React a survecu tel quel
      if (!avait && etatRef.current !== "demande" && etatRef.current !== "camera") return;
      setFlux(null);
      setNbCams(0);
      aller("repos");
      setAvis(a);
      setDetail(d);
      dire(dit);
    },
    [aller, couper, dire],
  );

  const couperRef = useRef(couper);
  couperRef.current = couper;
  const arreterRef = useRef(arreter);
  arreterRef.current = arreter;

  /* Rattrapage du focus. Les commandes se montent et se demontent avec
     l'etat : celle qui disparait sous le focus laisse le focus sur <body>, et
     le Tab suivant repart du lien d'evitement — toute la page a retraverser
     pour atteindre FERMER. Des qu'un changement d'etat a lache le fil, il est
     rendu a la commande equivalente du nouvel etat (DESIGN.md §2 tient ce fil
     partout ailleurs : « le focus revient au bloc PLEIN a la fermeture »). */
  useCommit(() => {
    if (!rendre.current) return;
    rendre.current = false;
    if (!dedans.current) return;
    const a = document.activeElement;
    if (a && a !== document.body && a.isConnected) return;
    const cible = etat === "repos" ? (ouvrirBtn.current ?? fichier.current) : fermerBtn.current;
    cible?.focus();
  }, [etat]);

  /* Sept sorties. L'IntersectionObserver a une hysteresis : un defilement au
     doigt ne doit pas couper puis rallumer le voyant sans arret. */
  useEffect(() => {
    const el = zone.current;
    let sortie = 0;

    const cache = () => {
      if (!document.hidden) return;
      arreterRef.current(
        "CAMERA ARRETEE",
        "L'ONGLET A ETE QUITTE. RELANCER POUR REPRENDRE.",
        "Caméra arrêtée : l'onglet a été quitté.",
      );
    };
    // bfcache (Safari, iOS) : ni beforeunload ni le nettoyage React ne passent.
    // Couper doit etre synchrone ici ; l'etat React, lui, survit au gel.
    const partir = () => couperRef.current();
    // ... et il est resynchronise a la restauration : sans cela la planche
    // affiche une camera qui ne tourne plus, DIRECT au cartouche, et laisse
    // exporter en PNG une trame prise avant le depart, sans aucun avis.
    const revenir = (e: PageTransitionEvent) => {
      if (!e.persisted) return;
      arreterRef.current(
        "CAMERA ARRETEE",
        "LA PAGE A ETE RESTAUREE. RELANCER POUR REPRENDRE.",
        "Caméra arrêtée : la page a été restaurée.",
      );
    };

    document.addEventListener("visibilitychange", cache);
    window.addEventListener("pagehide", partir);
    window.addEventListener("pageshow", revenir);

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          visible.current = e.isIntersecting;
          if (e.isIntersecting) {
            clearTimeout(sortie);
            sortie = 0;
            // une demande en vol suffit a armer la sortie : la bulle de
            // permission n'est pas modale, le visiteur peut faire defiler la
            // page pendant qu'elle est ouverte. Sans cela, la camera s'ouvrait
            // hors ecran et plus rien ne repassait le seuil pour l'eteindre.
          } else if (!sortie && (fluxRef.current || etatRef.current === "demande")) {
            sortie = window.setTimeout(() => {
              sortie = 0;
              arreterRef.current(
                "CAMERA ARRETEE",
                "LA PLANCHE A QUITTE L'ECRAN. RELANCER POUR REPRENDRE.",
                "Caméra arrêtée : la planche a quitté l'écran.",
              );
            }, 1000);
          }
        }
      },
      { threshold: 0.12 },
    );
    if (el) io.observe(el);

    return () => {
      clearTimeout(sortie);
      document.removeEventListener("visibilitychange", cache);
      window.removeEventListener("pagehide", partir);
      window.removeEventListener("pageshow", revenir);
      io.disconnect();
      couperRef.current();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
      // la planche est demontee avant ce nettoyage (React libere les enfants
      // d'abord) : plus personne ne reechantillonne, les bitmaps peuvent partir
      libererPasses();
      releaseSampleBuffer();
    };
  }, []);

  /* Plus aucune source a l'ecran : les canvas de travail rendent leur bitmap.
     L'effet s'execute apres la commit, donc apres le demontage de la planche. */
  useEffect(() => {
    if (etat === "camera" || etat === "image") return;
    libererPasses();
    releaseSampleBuffer();
  }, [etat]);

  /* Changement de route : couper avant meme le demontage — le masque de
     RouteWipe tient 1500 ms, la camera tournerait derriere lui. L'interface
     repasse au repos en meme temps : couper() seul laisserait la planche
     annoncer un flux deja eteint. */
  useEffect(() => {
    if (path === origine.current) return;
    origine.current = path;
    arreterRef.current(
      "CAMERA ARRETEE",
      "LA PAGE A CHANGE. RELANCER POUR REPRENDRE.",
      "Caméra arrêtée : la page a changé.",
    );
  }, [path]);

  const poser = useCallback(
    (u: string, n: string) => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = u;
      setUrl(u);
      setNom(n);
      aller("image");
      setAvis("");
      setDetail("");
      dire("Image chargée, échantillonnée en blocs.");
    },
    [aller, dire],
  );

  const charger = useCallback(
    async (f: File) => {
      couper();
      setFlux(null);
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
      setUrl(null);
      setNom("");
      // le creux, pas une planche vide : sans cet etat intermediaire, la
      // planche reste montee avec src="" pendant tout le decodage, garde la
      // derniere trame camera figee, et son cartouche bascule dans le vide
      aller("lecture");
      setAvis("LECTURE DU FICHIER");
      setDetail("");
      dire("Lecture du fichier.");
      // couper() vient d'incrementer le jeton : il date cette lecture
      const id = demande.current;
      try {
        const u = await preparer(f);
        // FERMER, un changement de route ou un demontage pendant le decodage
        // d'une grande photo : l'image fermee ne doit pas reapparaitre, et son
        // URL ne doit rester referencee par personne
        if (id !== demande.current) {
          URL.revokeObjectURL(u);
          return;
        }
        poser(u, etiquette(f.name));
      } catch (err) {
        if (id !== demande.current) return;
        const trop = err instanceof RangeError;
        aller("repos");
        setAvis(trop ? "IMAGE TROP GRANDE" : "FICHIER ILLISIBLE");
        setDetail(trop ? "AU-DELA DE 50 MEGAPIXELS." : "CE FICHIER N'EST PAS UNE IMAGE LISIBLE.");
        dire(trop ? "Image trop grande." : "Fichier illisible.");
      }
    },
    [aller, couper, dire, poser],
  );

  const chargerRef = useRef(charger);
  chargerRef.current = charger;

  /* Depot et collage. Sans preventDefault sur window, un depot rate a cote de
     la zone fait naviguer le navigateur vers le fichier et la page disparait. */
  useEffect(() => {
    const bloque = (e: DragEvent) => e.preventDefault();
    window.addEventListener("dragover", bloque);
    window.addEventListener("drop", bloque);

    const coller = (e: ClipboardEvent) => {
      // un collage est global par nature : il n'agit que si la planche est a
      // l'ecran, et jamais sous un masque (meme garde que les raccourcis)
      if (!visible.current) return;
      if (document.documentElement.classList.contains("mire-modal")) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        const it = items[i]!;
        if (it.kind !== "file" || !it.type.startsWith("image/")) continue;
        // getAsFile() avant tout await : la liste est vivante et se vide
        const f = it.getAsFile();
        if (!f) continue;
        e.preventDefault();
        void chargerRef.current(f);
        return;
      }
    };
    window.addEventListener("paste", coller);

    return () => {
      window.removeEventListener("dragover", bloque);
      window.removeEventListener("drop", bloque);
      window.removeEventListener("paste", coller);
    };
  }, []);

  const ouvrir = useCallback(
    async (contrainte: MediaTrackConstraints) => {
      couper();
      setFlux(null);
      const id = ++demande.current;
      aller("demande");
      dire("Demande d'accès à la caméra.");
      try {
        // audio: false explicite : la fiche de permission ne doit nommer que la camera
        const s = await navigator.mediaDevices.getUserMedia({ video: contrainte, audio: false });
        if (id !== demande.current) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        fluxRef.current = s;
        // la planche a pu quitter l'ecran pendant l'invite : elle n'est modale
        // dans aucun navigateur. L'observateur ne repassera plus le seuil, et
        // la camera resterait allumee, voyant compris, hors de tout ecran.
        if (!visible.current) {
          arreterRef.current(
            "CAMERA ARRETEE",
            "LA PLANCHE A QUITTE L'ECRAN. RELANCER POUR REPRENDRE.",
            "Caméra arrêtée : la planche a quitté l'écran.",
          );
          return;
        }
        setFlux(s);
        aller("camera");
        setAvis("");
        setDetail("");
        dire("Caméra ouverte. L'image reste dans votre navigateur.");

        const piste = s.getVideoTracks()[0];
        if (piste) {
          // seul signal fiable de « le peripherique a disparu » : notre propre
          // stop() ne declenche jamais onended
          piste.onended = () =>
            arreterRef.current(
              "SIGNAL PERDU",
              "LA CAMERA A ETE DEBRANCHEE OU L'ACCES RETIRE.",
              "Signal perdu : la caméra n'est plus disponible.",
            );
        }
        // les libelles et les identifiants ne sont lisibles qu'apres permission
        const liste = await navigator.mediaDevices.enumerateDevices();
        if (id !== demande.current) return;
        const v = liste.filter((d) => d.kind === "videoinput");
        cams.current = v;
        setNbCams(v.length);
        const courant = piste?.getSettings().deviceId;
        const i = v.findIndex((d) => d.deviceId === courant);
        if (i >= 0) idxCam.current = i;
        setNumCam(idxCam.current + 1);
      } catch (err) {
        if (id !== demande.current) return;
        const n = (err as { name?: string })?.name ?? "";
        const refus = n === "NotAllowedError" || n === "SecurityError";
        const absente = n === "NotFoundError" || n === "DevicesNotFoundError";
        const occupee = n === "NotReadableError" || n === "TrackStartError";
        aller("repos");
        // jamais le message brut du navigateur a l'ecran
        setAvis(
          refus
            ? "SIGNAL REFUSE"
            : absente
              ? "AUCUNE CAMERA"
              : occupee
                ? "CAMERA OCCUPEE"
                : "CAMERA INDISPONIBLE",
        );
        setDetail(
          refus
            ? `L'ACCES A LA CAMERA N'A PAS ETE ACCORDE. ${REPLI}`
            : absente
              ? `AUCUN CAPTEUR VIDEO SUR CET APPAREIL. ${REPLI}`
              : occupee
                ? "UNE AUTRE APPLICATION TIENT LA CAMERA. REESSAYER."
                : `LA CAMERA N'A PAS PU ETRE OUVERTE. ${REPLI}`,
        );
        dire(
          refus
            ? "Accès à la caméra refusé."
            : absente
              ? "Aucune caméra détectée."
              : "La caméra n'a pas pu être ouverte.",
        );
      }
    },
    [aller, couper, dire],
  );

  const suivante = useCallback(() => {
    // pointeur grossier : avant / arriere par facingMode, la liste des capteurs
    // d'un telephone en compte souvent trois ou quatre
    if (coarse) {
      facing.current = facing.current === "user" ? "environment" : "user";
      void ouvrir({ facingMode: facing.current });
      return;
    }
    const v = cams.current;
    if (v.length < 2) return;
    idxCam.current = (idxCam.current + 1) % v.length;
    void ouvrir({ deviceId: { exact: v[idxCam.current]!.deviceId } });
  }, [coarse, ouvrir]);

  const fermer = useCallback(() => {
    const e = etatRef.current;
    couper();
    setFlux(null);
    setNbCams(0);
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
    setUrl(null);
    setNom("");
    aller("repos");
    setAvis(AUCUNE);
    setDetail("");
    dire(
      e === "demande"
        ? "Demande d'accès annulée."
        : e === "lecture"
          ? "Lecture annulée."
          : "Source fermée.",
    );
    if (fichier.current) fichier.current.value = "";
  }, [aller, couper, dire]);

  /* Le canvas EST deja la mire : toBlob rend la trame telle qu'elle est a
     l'ecran, aucun second rendu, aucun algorithme duplique. L'ancre est
     creee, cliquee et retiree dans le geste : elle n'entre jamais dans la mire. */
  const enregistrer = useCallback(() => {
    const cv = planche.current;
    if (!cv) return;
    cv.toBlob((blob) => {
      if (!blob) return;
      const u = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = u;
      a.download = `mire-${horodatage()}.png`;
      document.body.append(a);
      a.click();
      a.remove();
      // le transfert est engage ; revoquer dans le meme tour l'annulerait
      setTimeout(() => URL.revokeObjectURL(u), 1000);
    }, "image/png");
    dire("Trame enregistrée en PNG.");
  }, [dire]);

  const ouverte = etat === "camera";
  const enVol = etat === "demande";
  const lit = etat === "lecture";
  const posee = ouverte || etat === "image";
  /* nbCams est pose par enumerateDevices apres permission : fiable sur mobile
     comme sur bureau. Sur un appareil a capteur unique, facingMode est une
     contrainte souple — la meme camera reviendrait, sans erreur et sans que
     rien ne le dise. Le bloc n'existe donc que s'il y a vraiment deux sources.
     Il reste monte pendant la demande : sinon il se demonte sous le doigt, et
     sous le focus, a chaque bascule. */
  const bascule = (ouverte || enVol) && nbCams > 1;
  /* Lecture du cartouche de la planche montee : sa hauteur nourrit le creux
     qui la remplacera. L'effet passe apres celui de la planche (React libere
     et monte les enfants d'abord), donc apres onCanvas. */
  useEffect(() => {
    if (!posee) return;
    const cap = planche.current?.closest("figure")?.querySelector("figcaption");
    if (!cap) return;
    const lire = () => setCartouche(Math.round(cap.getBoundingClientRect().height) + MARGE);
    lire();
    const ro = new ResizeObserver(lire);
    ro.observe(cap);
    return () => ro.disconnect();
  }, [posee]);

  const nomSource = ouverte ? "CAMERA" : etat === "image" ? nom || "IMAGE" : "AUCUNE";
  /* Le jeton alterne une espace insecable en fin de message : deux annonces
     de texte identique doivent muter le noeud, sinon React le laisse tel quel
     (egalite de la chaine) et aucun lecteur d'ecran ne dit rien — deux
     ENREGISTRER de suite passaient en silence. L'espace ne s'entend pas. */
  const dit = annonce.texte && annonce.n % 2 === 0 ? `${annonce.texte}\u00A0` : annonce.texte;

  return (
    <div
      ref={racine}
      onFocus={() => {
        dedans.current = true;
      }}
      onBlur={(e) => {
        // un demontage ne designe aucune cible : le focus tombe sur <body> et
        // doit etre rattrape. Un Tab vers l'exterieur, lui, est volontaire.
        const vers = e.relatedTarget as Node | null;
        if (vers && !racine.current?.contains(vers)) dedans.current = false;
      }}
    >
      <div
        ref={zone}
        className="mire-creux"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files[0];
          if (f) void charger(f);
          else {
            setAvis("DEPOSER UN FICHIER, PAS UN LIEN");
            setDetail("UNE IMAGE DISTANTE EXIGERAIT UNE REQUETE RESEAU.");
          }
        }}
      >
        {posee ? (
          <HybridMedia
            stream={ouverte ? flux : null}
            src={etat === "image" ? (url ?? "") : ""}
            alt={ouverte ? ALT_CAMERA : ALT_IMAGE}
            label={ouverte ? "MIROIR / CAMERA" : `MIROIR / ${nom}`}
            mode="gris"
            ratio={RATIO}
            onCanvas={(c) => {
              planche.current = c;
            }}
          />
        ) : (
          <div
            style={creux ? { height: `${creux}px` } : undefined}
            className="mire-creux-cadre flex min-h-[calc(var(--cell)*14)] flex-col items-center justify-center gap-cell border-[3px] border-(--ink) px-cell py-cell2 text-center"
          >
            <span className="u-mono">{enVol ? "AUTORISATION EN COURS" : avis}</span>
            {detail && <span className="u-copy max-w-[52ch]">{detail}</span>}
            <span className="u-copy max-w-[52ch]">{coarse ? DEPOT_TACTILE : depot(pomme)}</span>
          </div>
        )}
      </div>

      {/* Le banc de commandes garde sa hauteur : sous 640 px il passe de deux
          blocs a trois et gagnerait une rangee a chaque ouverture, poussant
          d'autant tout ce qui suit la section. Deux rangees sont reservees, les
          blocs restent centres dedans. */}
      <div
        role="group"
        aria-label="Source du miroir"
        className="mt-cell flex min-h-[calc(var(--cell)*4+6px)] flex-wrap content-center items-center gap-[6px] sm:min-h-cell2"
      >
        {apiOk && !ouverte && (
          <Bloc
            ref={ouvrirBtn}
            onClick={() => {
              if (!enVol) void ouvrir({ facingMode: facing.current });
            }}
            // jamais disabled : Chrome et Firefox retirent le focus d'un
            // element desactive et le visiteur au clavier repart de <body>
            aria-disabled={enVol || undefined}
            aria-label="Ouvrir la caméra ; l'image reste dans le navigateur, rien n'est transmis ni conservé"
          >
            {enVol ? "AUTORISATION…" : "OUVRIR LA CAMERA"}
          </Bloc>
        )}
        <label className="u-mono u-bloc cursor-pointer">
          CHOISIR UNE IMAGE
          <input
            ref={fichier}
            type="file"
            // sur le <label> l'attribut serait ignore (aucun role ARIA) et le
            // nom accessible retomberait sur les capitales de la mire
            aria-label="Choisir une image sur cet appareil"
            // le depot et le collage ne filtrent rien et la validation se fait
            // par decodage : un selecteur plus etroit masquerait des HEIC
            accept="image/*"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void charger(f);
            }}
          />
        </label>
        {bascule && (
          <Bloc
            onClick={() => {
              if (!enVol) suivante();
            }}
            aria-disabled={enVol || undefined}
            aria-label="Passer à la caméra suivante"
          >
            CAMERA SUIVANTE
          </Bloc>
        )}
        {posee && (
          <Bloc onClick={enregistrer} aria-label="Enregistrer la trame affichée en PNG">
            ENREGISTRER
          </Bloc>
        )}
        {(posee || enVol || lit) && (
          <Bloc
            ref={fermerBtn}
            onClick={fermer}
            aria-label={
              ouverte
                ? "Fermer la source et arrêter la caméra"
                : enVol
                  ? "Annuler la demande d'accès à la caméra"
                  : lit
                    ? "Annuler la lecture du fichier"
                    : "Fermer l'image affichée"
            }
          >
            {enVol || lit ? "ANNULER" : "FERMER"}
          </Bloc>
        )}
      </div>

      <div className="u-mono mt-cell flex min-h-cell2 flex-wrap items-center gap-x-cell gap-y-0">
        <span className="flex min-w-0 items-center gap-[4px]">
          <span>SOURCE</span>
          <span className="min-w-0 truncate">{nomSource}</span>
        </span>
        {ouverte && nbCams > 1 && (
          <span className="flex shrink-0 items-center gap-[4px]">
            <span>CAMERA</span>
            <BitReadout text={`${numCam}/${nbCams}`} />
          </span>
        )}
        <span className="shrink-0">AUCUN ENVOI</span>
        {!apiOk && <span className="shrink-0">CAMERA : HORS CONTEXTE SECURISE</span>}
      </div>

      <p className="u-copy mt-cell2 max-w-[56ch]">{CONFIDENTIALITE}</p>

      <span className="sr-only" aria-live="polite">
        {dit}
      </span>
    </div>
  );
}
