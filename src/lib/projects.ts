import p1 from "@/assets/p1.jpg";
import p2 from "@/assets/p2.jpg";
import p3 from "@/assets/p3.jpg";
import p4 from "@/assets/p4.jpg";

export type Project = {
  slug: string;
  num: string;
  title: string;
  year: string;
  nature: string;
  client: string;
  image: string;
  /** Notes visibles dans la mire : capitales, sans accents. */
  lines: string[];
  /** Resume hors mire (meta description, partage) : francais courant, accentue. */
  resume: string;
};

export const projects: Project[] = [
  {
    slug: "tmc",
    num: "01",
    title: "TRAME MUNICIPALE",
    year: "2024",
    nature: "IDENTITE / SIGNALETIQUE",
    client: "TMC",
    image: p1,
    lines: [
      "Identite d'un equipement public en beton brut. Le systeme reprend le pas de la structure : chaque element de signaletique est un rectangle plein, cale sur un module de 60 cm.",
      "Aucun contour, aucune fleche. L'orientation se lit dans le vide entre les blocs.",
    ],
    resume:
      "Identité et signalétique d'un équipement public en béton brut : des rectangles pleins calés sur un module de 60 cm, sans contour ni flèche. Projet du studio MIRE pour TMC, 2024.",
  },
  {
    slug: "cylindre",
    num: "02",
    title: "CYLINDRE",
    year: "2023",
    nature: "EDITION / IMPRESSION",
    client: "ATELIER NORD",
    image: p2,
    lines: [
      "Un ouvrage de 240 pages imprime en une seule encre. La grille de composition est celle de la presse : douze colonnes, aucune exception.",
      "Les images sont tramees en blocs a la sortie du RIP, sans demi-teinte.",
    ],
    resume:
      "Édition et impression d'un ouvrage de 240 pages en une seule encre, sur la grille de la presse. Projet du studio MIRE pour Atelier Nord, 2023.",
  },
  {
    slug: "mire-tv",
    num: "03",
    title: "MIRE 819",
    year: "2023",
    nature: "MOTION / DIFFUSION",
    client: "CANAL PUBLIC",
    image: p3,
    lines: [
      "Habillage d'antenne fonde sur la mire de reglage. Tous les inter-programmes sont des etats de calibration : barres, seuils, repere de lecture.",
      "Le rouge n'apparait qu'une fois par heure, a la seconde zero.",
    ],
    resume:
      "Habillage d'antenne fondé sur la mire de réglage : barres, seuils et repère de lecture comme inter-programmes. Projet du studio MIRE pour Canal Public, 2023.",
  },
  {
    slug: "rames",
    num: "04",
    title: "RAMES",
    year: "2022",
    nature: "IDENTITE / PAPIER",
    client: "PAPETERIE B.",
    image: p4,
    lines: [
      "Un catalogue de papiers ou la matiere est absente de la photographie : seule la lumiere sur la tranche est conservee.",
      "Le noir couvre 62% de la surface imprimee. Ce chiffre est le cahier des charges.",
    ],
    resume:
      "Identité et catalogue de papiers où seule la lumière sur la tranche est conservée. Projet du studio MIRE pour Papeterie B., 2022.",
  },
];

export const bySlug = (slug: string) => projects.find((p) => p.slug === slug);
