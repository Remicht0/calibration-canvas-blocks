import type { BitMode } from "./bitmap";
import moireLogotype from "@/assets/moire-logotype-trame.jpg";
import moireTampon from "@/assets/moire-tampon.jpg";
import moireDragon from "@/assets/moire-dragon-points.jpg";
import carteScan from "@/assets/carte-postale-scan.jpg";
import carteFragments from "@/assets/carte-postale-fragments.jpg";
import carteTram from "@/assets/carte-postale-tram.jpg";

/**
 * Reglage de lecture d'une planche (HybridMedia). Absent, la page applique son
 * defaut. Une image tres graphique se lit en `bin` (seuil 0,40-0,48), une photo
 * en `gris`, une matiere assumee en `brut` (DESIGN.md, §2 BitMode).
 */
export type Lecture = {
  mode?: BitMode;
  threshold?: number;
  gamma?: number;
  /** Hauteur / largeur du cadre : la proportion de la source, arrondie au pas. */
  ratio?: number;
};

/** Une image ou une video de projet, son texte alternatif et son reglage de lecture. */
export type Planche = Lecture & {
  src: string;
  /** Hors mire : francais accentue, une phrase qui decrit vraiment l'image. */
  alt: string;
  /** Etiquette visible dans la mire : ce que montre la planche, capitales sans accents. */
  label?: string;
};

export type Project = {
  slug: string;
  num: string;
  title: string;
  year: string;
  nature: string;
  client: string;
  /** Planche principale : planche 01, survol de l'index, atelier. */
  image: string;
  /** Texte alternatif de l'image principale (lecteurs d'ecran) : francais accentue, une phrase. */
  alt: string;
  /** Lecture de la planche 01 ; defaut : gris, cadre 0,56. */
  lecture?: Lecture;
  /** Notes visibles dans la mire : capitales, sans accents. */
  lines: string[];
  /** Resume hors mire (meta description, partage) : francais courant, accentue. */
  resume: string;
  /**
   * Serie de planches 02, 03... dans l'ordre de lecture. Absente, la page relit
   * l'image principale en seuil et en mosaique.
   */
  serie?: Planche[];
  /** Video du projet (mp4 muet, en boucle), lue dans la mire comme une planche. */
  video?: Planche;
  /**
   * Image qui tient un cadrage serre (carte de partage en portrait, fond de
   * l'index, banc d'essai) quand l'image principale est trop large ; absente,
   * on recadre l'image principale.
   */
  carte?: Planche;
  /** Credits visibles (sources, co-auteurs, cadre) : capitales sans accents. */
  credits?: string[];
};

export const projects: Project[] = [
  {
    slug: "moire",
    num: "01",
    title: "MOIRE",
    year: "2026",
    nature: "IDENTITE VISUELLE",
    client: "MARQUE PERSONNELLE",
    image: moireLogotype,
    alt: "Le logotype « moiré » en lettres rouges épaisses et arrondies, imprimé en trame de points sur un fond crème.",
    lines: [
      "Identite de MOIRE, ma marque de vetements. Un logotype en volume, decline en rouge et en bleu, lisse ou trame.",
      "Un embleme en pixels, pense pour le tampon : une couleur, un coup.",
    ],
    resume:
      "MOIRÉ, ma marque de vêtements : un logotype en volume décliné en rouge et en bleu, lisse ou tramé, et un emblème en pixels pensé pour le tampon. Identité visuelle, 2026.",
    serie: [
      {
        src: moireTampon,
        alt: "Épreuve de tampon : l'emblème en gros pixels bleus, un chevalier qui plante son épée dans un dragon, avec les mentions du tirage dans les coins.",
        label: "EMBLEME / TAMPON",
        mode: "bin",
        threshold: 0.42,
      },
      {
        src: moireDragon,
        alt: "Un dragon dressé, dessiné entièrement en points noirs carrés sur fond blanc.",
        label: "DRAGON EN POINTS",
        mode: "brut",
      },
    ],
    // le logotype, tres large, ne laisse qu'une lettre au recadrage portrait
    carte: {
      src: moireTampon,
      alt: "Épreuve de tampon : l'emblème en gros pixels bleus, un chevalier qui plante son épée dans un dragon, avec les mentions du tirage dans les coins.",
    },
  },
  {
    slug: "carte-postale",
    num: "02",
    title: "CARTE POSTALE",
    year: "2026",
    nature: "EDITION",
    client: "PROJET D'ECOLE / DNMADE 2",
    image: carteScan,
    alt: "Collage en noir et blanc de photographies anciennes de Bordeaux découpées et superposées : façades, tramway, foule, un visage.",
    lines: [
      "Des cartes postales composees a partir de photographies d'archives de Bordeaux : la piscine Judaique, le dernier convoi du tram, la rue Sainte-Catherine pavoisee.",
      "Les images sont scannees, seuillees, dechirees puis recomposees en planches.",
    ],
    resume:
      "Cartes postales composées à partir de photographies d'archives de Bordeaux, scannées, seuillées, déchirées puis recomposées en planches. Projet d'école, DNMADE 2, 2026.",
    serie: [
      {
        src: carteFragments,
        alt: "Planche encadrée : fragments de photographies anciennes en noir pur et blanc, déchirés et assemblés en éventail.",
        label: "FRAGMENTS",
        mode: "bin",
        threshold: 0.42,
      },
      {
        src: carteTram,
        alt: "Planche encadrée : une rue ancienne de Bordeaux et ses passants, déformée en vagues verticales.",
        label: "TRAM",
        mode: "brut",
      },
    ],
  },
];

export const bySlug = (slug: string) => projects.find((p) => p.slug === slug);

/** Image du fond de l'index et de la SUITE : celle qui tient un cadrage serre. */
export const fondOf = (p: Project) => p.carte?.src ?? p.image;

/** Annees couvertes par l'index, deduites des projets : « 2022 — 2024 », ou une seule annee. */
export const periode = (() => {
  const ans = projects.flatMap((p) => (p.year.match(/\d{4}/g) ?? []).map(Number));
  if (!ans.length) return "";
  const a = Math.min(...ans);
  const b = Math.max(...ans);
  return a === b ? String(a) : `${a} — ${b}`;
})();

/** Une planche du banc d'essai : l'image et le projet dont elle vient. */
export type PlancheBanc = Planche & { projet: Project };

/**
 * Les images des projets qui tiennent un cadrage serre (carte, sinon principale,
 * puis serie), alternees d'un projet a l'autre : le banc d'essai y puise.
 */
export const planches: PlancheBanc[] = (() => {
  const parProjet = projects.map((p) => {
    const tete: Planche = p.carte ?? { src: p.image, alt: p.alt };
    return [tete, ...(p.serie ?? []).filter((d) => d.src !== tete.src)].map((d) => ({
      ...d,
      projet: p,
    }));
  });
  const out: PlancheBanc[] = [];
  for (let k = 0; k < Math.max(0, ...parProjet.map((l) => l.length)); k++)
    for (const l of parProjet) if (l[k]) out.push(l[k]!);
  return out;
})();
