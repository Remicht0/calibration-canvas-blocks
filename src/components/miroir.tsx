import { useCallback, useEffect, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { Bloc } from "@/components/bloc";
import { HybridMedia } from "@/components/media";
import { BitReadout } from "@/components/readout";
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
/* section sort de l'ecran et quand l'onglet est cache — seul           */
/* track.stop() eteint le voyant, ni pause() ni srcObject = null.       */
/* Rien n'est envoye, rien n'est stocke : aucune requete, aucun         */
/* localStorage, aucun MediaRecorder, et audio: false explicite.        */
/* ------------------------------------------------------------------ */

type Etat = "repos" | "demande" | "camera" | "image";

/* Dans la mire : capitales sans accents (DESIGN.md §2). */
const AUCUNE = "AUCUNE SOURCE";
const DEPOT = "OU DEPOSER UNE IMAGE ICI — OU COLLER AVEC CTRL+V";
const REPLI = "LE DEPOT D'UNE IMAGE RESTE POSSIBLE.";
const CONFIDENTIALITE =
  "RIEN N'EST ENVOYE. LA MIRE EST CALCULEE DANS VOTRE NAVIGATEUR, LA SOURCE NE QUITTE JAMAIS VOTRE APPAREIL.";

/* Hors mire : francais accentue, bas de casse (lecteurs d'ecran). */
const ALT_CAMERA = "Votre caméra, échantillonnée en blocs noirs et blancs.";
const ALT_IMAGE = "Votre image, échantillonnée en blocs noirs et blancs.";

/* Hauteur de la planche : colonnes x RATIO, comme toute planche du site. */
const RATIO = 0.62;

/* Au-dela, un canvas rend du vide sans lever d'erreur sur iOS (~16,7 Mpx d'aire utile). */
const MAX_PIXELS = 50_000_000;
/* 1600 px sur le grand cote : ~16 pixels source par cellule, meme en plein cadre. */
const MAX_COTE = 1600;

/* Rapport de reduction encore bon marche en une seule passe. Mesure sur ce
   navigateur, source 8000 x 6000 vers 1600 x 1200 (rapport 5) : une passe
   coute 30 ms de fil principal, trois passes par moities en coutent 573 —
   ce sont les canvas intermediaires de 48 et 24 Mo qui gelent la page, pas
   le reechantillonnage. Les moities ne redeviennent utiles qu'au-dela. */
const FACTEUR = 6;

/* Canvas de travail partages, comme sample() : un canvas neuf par appel
   ferait tourner le ramasse-miettes. */
let passeA: HTMLCanvasElement | null = null;
let passeB: HTMLCanvasElement | null = null;

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

/**
 * Valide par decodage (jamais sur file.type ni sur l'extension : un texte
 * renomme .png arrive avec le type image/png) puis reduit a 1600 px une fois
 * pour toutes. Le decodage de createImageBitmap est hors fil principal
 * (~560 ms de travail, 17 ms de gel mesures sur une photo de 48 Mpx) ; la
 * reduction, elle, est synchrone, d'ou le plafond de FACTEUR par passe.
 * Reduire une seule fois est indispensable : sample() rappelle la source a
 * chaque redimensionnement, a chaque bascule 16 / 20 px et a chaque plein cadre.
 */
async function preparer(file: File): Promise<string> {
  const bmp = await createImageBitmap(file);
  try {
    if (bmp.width * bmp.height > MAX_PIXELS) throw new RangeError("TROP GRANDE");
    const k = Math.min(1, MAX_COTE / Math.max(bmp.width, bmp.height));
    const tw = Math.max(1, Math.round(bmp.width * k));
    const th = Math.max(1, Math.round(bmp.height * k));
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
    return URL.createObjectURL(blob);
  } finally {
    bmp.close();
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
  const [apiOk, setApiOk] = useState(true);
  const [annonce, setAnnonce] = useState("");

  const zone = useRef<HTMLDivElement>(null);
  const planche = useRef<HTMLCanvasElement | null>(null);
  const fichier = useRef<HTMLInputElement>(null);
  const fluxRef = useRef<MediaStream | null>(null);
  const urlRef = useRef<string | null>(null);
  const visible = useRef(false);
  const cams = useRef<MediaDeviceInfo[]>([]);
  const idxCam = useRef(0);
  const facing = useRef<"user" | "environment">("user");
  const demande = useRef(0);

  const path = useRouterState({ select: (s) => s.location.pathname });
  const origine = useRef(path);

  /* Le cadre de repos a la taille exacte de la planche qui va le remplacer :
     aucun saut de mise en page a l'ouverture, et la hauteur reste un multiple
     de la cellule — la meme geometrie que build() dans HybridMedia. */
  const [creux, setCreux] = useState(0);
  useEffect(() => {
    const el = zone.current;
    if (!el) return;
    const mesure = () => {
      const cell = cellSizeFor(window.innerWidth);
      const cols = Math.max(6, Math.floor(el.clientWidth / cell));
      setCreux(Math.max(4, Math.round(cols * RATIO)) * cell);
    };
    mesure();
    const ro = new ResizeObserver(mesure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    setCoarse(window.matchMedia("(pointer: coarse)").matches);
    // sur une origine non securisee, mediaDevices vaut undefined : aucune
    // exception a attraper, et un bouton mort serait un mensonge de mire
    setApiOk(typeof navigator.mediaDevices?.getUserMedia === "function");
  }, []);

  const etatRef = useRef<Etat>(etat);
  etatRef.current = etat;

  /* Seule sortie qui eteint le voyant. Idempotente : appelee par six chemins. */
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
      // ni flux ouvert, ni demande en vol : il n'y a rien a annoncer
      if (!avait && etatRef.current !== "demande") return;
      setFlux(null);
      setEtat("repos");
      setAvis(a);
      setDetail(d);
      setAnnonce(dit);
    },
    [couper],
  );

  const couperRef = useRef(couper);
  couperRef.current = couper;
  const arreterRef = useRef(arreter);
  arreterRef.current = arreter;

  /* Six sorties. L'IntersectionObserver a une hysteresis : un defilement au
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
    // bfcache (Safari, iOS) : ni beforeunload ni le nettoyage React ne passent
    const partir = () => couperRef.current();

    document.addEventListener("visibilitychange", cache);
    window.addEventListener("pagehide", partir);

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          visible.current = e.isIntersecting;
          if (e.isIntersecting) {
            clearTimeout(sortie);
            sortie = 0;
          } else if (!sortie && fluxRef.current) {
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
      io.disconnect();
      couperRef.current();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    };
  }, []);

  /* Changement de route : couper avant meme le demontage — le masque de
     RouteWipe tient 1500 ms, la camera tournerait derriere lui. */
  useEffect(() => {
    if (path !== origine.current) couperRef.current();
  }, [path]);

  const poser = useCallback((u: string, n: string) => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = u;
    setUrl(u);
    setNom(n);
    setEtat("image");
    setAvis("");
    setDetail("");
    setAnnonce("Image chargée, échantillonnée en blocs.");
  }, []);

  const charger = useCallback(
    async (f: File) => {
      couper();
      setFlux(null);
      try {
        const u = await preparer(f);
        poser(u, etiquette(f.name));
      } catch (err) {
        const trop = err instanceof RangeError;
        setEtat("repos");
        setAvis(trop ? "IMAGE TROP GRANDE" : "FICHIER ILLISIBLE");
        setDetail(trop ? "AU-DELA DE 50 MEGAPIXELS." : "CE FICHIER N'EST PAS UNE IMAGE LISIBLE.");
        setAnnonce(trop ? "Image trop grande." : "Fichier illisible.");
      }
    },
    [couper, poser],
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
      setEtat("demande");
      setAnnonce("Demande d'accès à la caméra.");
      try {
        // audio: false explicite : la fiche de permission ne doit nommer que la camera
        const s = await navigator.mediaDevices.getUserMedia({ video: contrainte, audio: false });
        if (id !== demande.current) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        fluxRef.current = s;
        setFlux(s);
        setEtat("camera");
        setAvis("");
        setDetail("");
        setAnnonce("Caméra ouverte. L'image reste dans votre navigateur.");

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
        setEtat("repos");
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
        setAnnonce(
          refus
            ? "Accès à la caméra refusé."
            : absente
              ? "Aucune caméra détectée."
              : "La caméra n'a pas pu être ouverte.",
        );
      }
    },
    [couper],
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
    couper();
    setFlux(null);
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
    setUrl(null);
    setNom("");
    setEtat("repos");
    setAvis(AUCUNE);
    setDetail("");
    setAnnonce("Source fermée.");
    if (fichier.current) fichier.current.value = "";
  }, [couper]);

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
    setAnnonce("Trame enregistrée en PNG.");
  }, []);

  const bascule = etat === "camera" && (nbCams > 1 || coarse);
  const source = etat === "camera" ? "CAMERA" : etat === "image" ? nom || "IMAGE" : "AUCUNE";

  return (
    <div>
      <div
        ref={zone}
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
        {etat === "camera" || etat === "image" ? (
          <HybridMedia
            stream={etat === "camera" ? flux : null}
            src={etat === "image" ? (url ?? "") : ""}
            alt={etat === "camera" ? ALT_CAMERA : ALT_IMAGE}
            label={etat === "camera" ? "MIROIR / CAMERA" : `MIROIR / ${nom}`}
            mode="gris"
            ratio={RATIO}
            onCanvas={(c) => {
              planche.current = c;
            }}
          />
        ) : (
          <div
            style={creux ? { height: creux } : undefined}
            className="flex min-h-[calc(var(--cell)*14)] flex-col items-center justify-center gap-cell border-[3px] border-(--ink) px-cell py-cell2 text-center"
          >
            <span className="u-mono">{etat === "demande" ? "AUTORISATION EN COURS" : avis}</span>
            {detail && <span className="u-mono max-w-[52ch]">{detail}</span>}
            <span className="u-mono max-w-[64ch]">{DEPOT}</span>
          </div>
        )}
      </div>

      <div
        role="group"
        aria-label="Source du miroir"
        className="mt-cell flex flex-wrap items-center gap-[6px]"
      >
        {etat !== "camera" && apiOk && (
          <Bloc
            onClick={() => void ouvrir({ facingMode: facing.current })}
            disabled={etat === "demande"}
            aria-label="Ouvrir la caméra ; l'image reste dans le navigateur, rien n'est transmis ni conservé"
          >
            {etat === "demande" ? "AUTORISATION…" : "OUVRIR LA CAMERA"}
          </Bloc>
        )}
        <label
          className="u-mono u-bloc cursor-pointer"
          aria-label="Choisir une image sur cet appareil"
        >
          CHOISIR UNE IMAGE
          <input
            ref={fichier}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/avif"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void charger(f);
            }}
          />
        </label>
        {bascule && (
          <Bloc onClick={suivante} aria-label="Passer à la caméra suivante">
            CAMERA SUIVANTE
          </Bloc>
        )}
        {(etat === "camera" || etat === "image") && (
          <>
            <Bloc onClick={enregistrer} aria-label="Enregistrer la trame affichée en PNG">
              ENREGISTRER
            </Bloc>
            <Bloc onClick={fermer} aria-label="Fermer la source et arrêter la caméra">
              FERMER
            </Bloc>
          </>
        )}
      </div>

      <div className="u-mono mt-cell flex min-h-cell2 flex-wrap items-center gap-x-cell gap-y-0">
        <span className="flex min-w-0 items-center gap-[4px]">
          <span>SOURCE</span>
          <span className="min-w-0 truncate">{source}</span>
        </span>
        {etat === "camera" && nbCams > 1 && (
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
        {annonce}
      </span>
    </div>
  );
}
