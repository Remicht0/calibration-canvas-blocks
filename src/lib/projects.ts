import moireLogotype from "@/assets/moire-logotype-trame.jpg";
import moireTampon from "@/assets/moire-tampon.jpg";
import moireDragon from "@/assets/moire-dragon-points.jpg";
import carteScan from "@/assets/carte-postale-scan.jpg";
import carteFragments from "@/assets/carte-postale-fragments.jpg";
import carteTram from "@/assets/carte-postale-tram.jpg";

/** Une image de projet et son texte alternatif (hors mire : francais accentue, une phrase). */
export type Planche = { src: string; alt: string };

export type Project = {
  slug: string;
  num: string;
  title: string;
  year: string;
  nature: string;
  client: string;
  /** Planche principale : index, survol, carte de partage. */
  image: string;
  /** Notes visibles dans la mire : capitales, sans accents. */
  lines: string[];
  /** Resume hors mire (meta description, partage) : francais courant, accentue. */
  resume: string;
  /** Texte alternatif de l'image (lecteurs d'ecran, og:image:alt) : francais accentue, une phrase. */
  alt: string;
  /** Deux details pour la planche 02 ; absents, elle relit l'image principale. */
  details?: [Planche, Planche];
  /**
   * Image qui tient un cadrage serre (carte de partage en portrait, banc d'essai) quand
   * l'image principale est trop large ; absente, on recadre l'image principale.
   */
  carte?: Planche;
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
    lines: [
      "Identite de MOIRE, ma marque de vetements. Un logotype en volume, decline en rouge et en bleu, lisse ou trame.",
      "Un dragon en pixels, tire au tampon : une couleur, un coup, une epreuve numerotee.",
    ],
    resume:
      "MOIRÉ, ma marque de vêtements : un logotype en volume décliné en rouge et en bleu, lisse ou tramé, et un dragon en pixels imprimé au tampon. Identité visuelle, 2026.",
    alt: "Le logotype « moiré » en lettres rouges épaisses et arrondies, imprimé en trame de points sur un fond crème.",
    details: [
      {
        src: moireTampon,
        alt: "Épreuve de tampon : un dragon en gros pixels bleus sur papier blanc, avec les mentions du tirage dans les coins.",
      },
      {
        src: moireDragon,
        alt: "Un dragon dressé, dessiné entièrement en points noirs carrés sur fond blanc.",
      },
    ],
    // le logotype, tres large, ne laisse qu'une lettre au recadrage portrait
    carte: {
      src: moireTampon,
      alt: "Épreuve de tampon : un dragon en gros pixels bleus sur papier blanc, avec les mentions du tirage dans les coins.",
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
    lines: [
      "Des cartes postales composees a partir de photographies d'archives de Bordeaux : la piscine Judaique, le dernier convoi du tram, la rue Sainte-Catherine pavoisee.",
      "Les images sont scannees, seuillees, dechirees puis recomposees en planches.",
    ],
    resume:
      "Cartes postales composées à partir de photographies d'archives de Bordeaux, scannées, seuillées, déchirées puis recomposées en planches. Projet d'école, DNMADE 2, 2026.",
    alt: "Collage en noir et blanc de photographies anciennes de Bordeaux découpées et superposées : façades, tramway, foule, un visage.",
    details: [
      {
        src: carteFragments,
        alt: "Planche encadrée : fragments de photographies anciennes en noir pur et blanc, déchirés et assemblés en éventail.",
      },
      {
        src: carteTram,
        alt: "Planche encadrée : une rue ancienne de Bordeaux et ses passants, déformée en vagues verticales.",
      },
    ],
  },
];

export const bySlug = (slug: string) => projects.find((p) => p.slug === slug);

/** Annees couvertes par l'index, deduites des projets : « 2022 — 2024 », ou une seule annee. */
export const periode = (() => {
  const ans = projects.flatMap((p) => (p.year.match(/\d{4}/g) ?? []).map(Number));
  if (!ans.length) return "";
  const a = Math.min(...ans);
  const b = Math.max(...ans);
  return a === b ? String(a) : `${a} — ${b}`;
})();

/**
 * Les images des projets qui tiennent un cadrage serre (carte, sinon principale,
 * puis details), alternees d'un projet a l'autre : le banc d'essai y puise.
 */
export const planches: Planche[] = (() => {
  const parProjet = projects.map((p) => {
    const tete = p.carte ?? { src: p.image, alt: p.alt };
    return [tete, ...(p.details ?? []).filter((d) => d.src !== tete.src)];
  });
  const out: Planche[] = [];
  for (let k = 0; k < Math.max(0, ...parProjet.map((l) => l.length)); k++)
    for (const l of parProjet) if (l[k]) out.push(l[k]!);
  return out;
})();
