import type { BitMode } from "./bitmap";
import moireLogotype from "@/assets/moire-logotype-trame.jpg";
import moireBleuLisse from "@/assets/moire-logotype-bleu-lisse.jpg";
import moireRougeGonfle from "@/assets/moire-logotype-rouge-gonfle.jpg";
import moireBleuTrame from "@/assets/moire-logotype-bleu-trame.jpg";
import moireEmbleme from "@/assets/moire-embleme-grille.jpg";
import moireTampon from "@/assets/moire-tampon.jpg";
import moireDragon from "@/assets/moire-dragon-points.jpg";
import moireArtefacts from "@/assets/moire-affiche-artefacts.jpg";
import carteScan from "@/assets/carte-postale-scan.jpg";
import carteFragments from "@/assets/carte-postale-fragments.jpg";
import carteTram from "@/assets/carte-postale-tram.jpg";
import carteBandes from "@/assets/carte-postale-collage-bandes.jpg";
import champiDepliant from "@/assets/champitheque-depliant.jpg";
import champiVolets12 from "@/assets/champitheque-volets-01-02.jpg";
import champiVolets34 from "@/assets/champitheque-volets-03-04.jpg";
import champiVolets57 from "@/assets/champitheque-volets-05-07.jpg";
import champiTour from "@/assets/champitheque-tour.jpg";
import gnafLogo from "@/assets/gnaf-logo.jpg";
import gnafLettrage from "@/assets/gnaf-lettrage.jpg";
import daltonChaines from "@/assets/dalton-chaines.jpg";
import daltonTitre from "@/assets/dalton-titre.jpg";
import daltonSilhouette from "@/assets/dalton-silhouette.jpg";
import daltonCourse from "@/assets/dalton-course.jpg";
import daltonGenerique from "@/assets/dalton-generique.mp4";
import daltonGeneriqueWebm from "@/assets/dalton-generique.webm";
import microRuine from "@/assets/microunivers-ruine.jpg";
import microGalerie from "@/assets/microunivers-galerie.jpg";
import microColonne from "@/assets/microunivers-colonne.jpg";
import microCouloir from "@/assets/microunivers-couloir.jpg";
import microVideo from "@/assets/microunivers-3d.mp4";
import microVideoWebm from "@/assets/microunivers-3d.webm";
import poesieYeux from "@/assets/poesie-yeux.jpg";
import poesieYeuxBoucle from "@/assets/poesie-yeux.mp4";
import poesieYeuxBoucleWebm from "@/assets/poesie-yeux.webm";
import poesieEtoiles from "@/assets/poesie-etoiles.mp4";
import poesieEtoilesWebm from "@/assets/poesie-etoiles.webm";
import poesieCourbes from "@/assets/poesie-courbes.mp4";
import poesieCourbesWebm from "@/assets/poesie-courbes.webm";
import poesieTriangles from "@/assets/poesie-triangles.mp4";
import poesieTrianglesWebm from "@/assets/poesie-triangles.webm";

/**
 * Reglage de lecture d'une planche (HybridMedia). Absent, la page applique son
 * defaut. Une image tres graphique se lit en `bin`, seuil regle sur le rendu
 * reel dans 0,20-0,70 (defaut 0,42 pour la serie) ; une photo en `gris`, une
 * matiere assumee en `brut` (DESIGN.md, §2 BitMode).
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
  /**
   * Video seulement : la meme video en WebM (VP9). `src` reste le MP4 (H.264,
   * Safari, iPhone) ; un navigateur qui lit le VP9 prend le WebM (Chromium sans
   * H.264, Firefox). Le choix se fait a la lecture, dans HybridMedia.
   */
  webm?: string;
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
    alt: "Le logotype « moiré » en lettres rouges épaisses et arrondies, tramé en points sur un fond crème.",
    // en gris, les lettres rouges et leur ombre noire se separent ; en bin elles font un aplat
    lecture: { mode: "gris", ratio: 0.42 },
    lines: [
      "Identite de MOIRE, ma marque de vetements. Un logotype en volume, decline en rouge et en bleu, lisse, gonfle ou trame.",
      "Un embleme en pixels sur une grille de 36 x 30 : un chevalier qui plante son epee dans un dragon, pense pour le tampon. Une couleur, un coup.",
      "Autour, un dragon dessine en 1 425 carres noirs et une affiche d'artefacts.",
    ],
    resume:
      "MOIRÉ, ma marque de vêtements : un logotype en volume décliné en rouge et en bleu, lisse, gonflé ou tramé, un emblème en pixels pensé pour le tampon et un dragon en points. Identité visuelle, 2026.",
    serie: [
      {
        src: moireBleuLisse,
        alt: "Le logotype « moiré » en bleu vif, lisse et brillant, en léger relief avec une ombre noire, sur fond blanc.",
        label: "LOGOTYPE BLEU LISSE",
        mode: "bin",
        threshold: 0.5,
        ratio: 0.44,
      },
      {
        src: moireRougeGonfle,
        alt: "Le logotype « moiré » en rouge, gonflé en volume, aux lettres boursouflées et ombrées de rouge sombre.",
        label: "LOGOTYPE ROUGE GONFLE",
        mode: "gris",
        ratio: 0.42,
      },
      {
        src: moireBleuTrame,
        alt: "Le logotype « moiré » bleu marine tramé de points magenta, cyan et blancs, avec une ombre noire, sur fond crème.",
        label: "LOGOTYPE BLEU TRAME",
        mode: "brut",
        ratio: 0.44,
      },
      {
        src: moireEmbleme,
        alt: "L'emblème en gros pixels noirs sur fond blanc : un chevalier qui plante son épée dans un dragon, la queue enroulée.",
        label: "EMBLEME 36 X 30",
        mode: "bin",
        threshold: 0.5,
        ratio: 0.9,
      },
      {
        src: moireTampon,
        alt: "Visuel de tampon : l'emblème en gros pixels bleus, un chevalier qui plante son épée dans un dragon, avec des mentions de tirage dans les coins.",
        label: "EMBLEME / TAMPON",
        mode: "bin",
        // encre de tampon claire et marbree : a 0,42 le chevalier se defaisait
        threshold: 0.6,
        ratio: 1,
      },
      {
        src: moireDragon,
        alt: "Un dragon dressé, dessiné entièrement en points noirs carrés sur fond blanc.",
        label: "DRAGON EN POINTS",
        mode: "gris",
        ratio: 1.8,
      },
      {
        src: moireArtefacts,
        alt: "Affiche abstraite en niveaux de gris : des bandes horizontales en dégradé, découpées au centre en colonnes étirées comme un glitch.",
        label: "AFFICHE / ARTEFACTS",
        mode: "gris",
        ratio: 0.56,
      },
    ],
    // le logotype, tres large, ne laisse qu'une lettre au recadrage portrait
    carte: {
      src: moireTampon,
      alt: "Visuel de tampon : l'emblème en gros pixels bleus, un chevalier qui plante son épée dans un dragon, avec des mentions de tirage dans les coins.",
    },
  },
  {
    slug: "carte-postale",
    num: "02",
    title: "CARTE POSTALE ONIRIQUE",
    year: "2026",
    nature: "RECHERCHE GRAPHIQUE",
    client: "PROJET D'ECOLE / DNMADE 2",
    image: carteScan,
    alt: "Collage en noir et blanc de photographies anciennes de Bordeaux découpées et superposées : façades, tramway, foule, un visage.",
    lecture: { mode: "gris", gamma: 0.78, ratio: 0.7 },
    lines: [
      "Sujet : une carte postale onirique, un voyage immobile dans Bordeaux a partir de photographies d'archives.",
      "La matiere : la piscine Judaique, le dernier convoi du tram, la rue Sainte-Catherine pavoisee. Chaque image est scannee, tramee, seuillee, dechiree ou collee en bandes, puis annotee.",
      "Conclusion des planches : la memoire ne garde pas l'image, elle la transforme en reve. La carte postale devient un paysage mental.",
    ],
    resume:
      "Carte postale onirique : un voyage immobile dans Bordeaux à partir de photographies d'archives, scannées, tramées, seuillées, déchirées ou collées en bandes. Projet d'école, DNMADE 2, 2026.",
    serie: [
      {
        src: carteFragments,
        alt: "Planche encadrée : fragments de photographies anciennes en noir pur et blanc, déchirés et assemblés en éventail.",
        label: "FRAGMENTS",
        mode: "bin",
        threshold: 0.42,
        ratio: 1.19,
      },
      {
        src: carteTram,
        alt: "Planche encadrée : une rue ancienne de Bordeaux et ses passants, déformée en vagues verticales.",
        label: "TRAM / DISTORSION AU SCANNER",
        mode: "brut",
        ratio: 1.19,
      },
      {
        src: carteBandes,
        alt: "Collage papier scanné : des bandes de photocopies d'une rue pavoisée, une enseigne « Biarritz Bar », certaines bandes collées à l'envers.",
        label: "COLLAGE EN BANDES",
        mode: "gris",
        ratio: 0.7,
      },
    ],
    carte: {
      src: carteFragments,
      alt: "Planche encadrée : fragments de photographies anciennes en noir pur et blanc, déchirés et assemblés en éventail.",
    },
    credits: [
      "ARCHIVES : SUD OUEST (PHOTOS-VINTAGE.SUDOUEST.FR)",
      "DNMADE GRAPHISME, ST VINCENT DE PAUL",
    ],
  },
  {
    slug: "champitheque",
    num: "03",
    title: "CHAMPITHEQUE",
    year: "2026",
    nature: "EDITION",
    client: "PROJET D'ECOLE",
    image: champiTour,
    alt: "Couverture du livret : une tour noire couverte de pleurotes, entourée de flèches vertes, au-dessus de « Fabriquer, observer, récolter ».",
    // la tour de la couverture tient en blocs a toute largeur ; le depliant entier passe en serie
    lecture: { mode: "bin", threshold: 0.6, ratio: 0.7 },
    lines: [
      "Champitheque urbaine : un mode d'emploi en sept volets pour construire une tour de culture de pleurotes et faire pousser le vivant en ville.",
      "Apres la couverture, six volets d'etapes : pourquoi une filiere, le materiel, construire la tour, percer et suspendre, preparer le substrat, puis inoculer, incuber et fructifier.",
      "Titres en Anton. Noir, creme et un vert sapin.",
    ],
    resume:
      "Champithèque urbaine : un livret en sept volets, mode d'emploi d'une tour de culture de pleurotes pour faire pousser le vivant en ville. Édition, projet d'école d'après la documentation du Low-tech Lab (Biosphère urbaine), 2026.",
    serie: [
      {
        src: champiDepliant,
        alt: "Les sept volets du livret « Champithèque urbaine » côte à côte : titres noirs condensés, pictogrammes noirs et pastilles vert sapin sur papier crème.",
        label: "DEPLIANT / 7 VOLETS",
        mode: "bin",
        threshold: 0.7,
        ratio: 0.4,
      },
      {
        src: champiVolets12,
        alt: "Volets 1 et 2 : la couverture « Champithèque urbaine » avec une tour couverte de pleurotes, puis le cycle de la filière, de la paille à la récolte.",
        label: "VOLETS 01-02",
        mode: "bin",
        threshold: 0.7,
        ratio: 1.41,
      },
      {
        src: champiVolets34,
        alt: "Volets 3 et 4 : le matériel en pictogrammes (tasseaux, corde, chaux, gants, masque) et la construction de la tour en quatre étapes.",
        label: "VOLETS 03-04",
        mode: "bin",
        threshold: 0.7,
        ratio: 1.41,
      },
      {
        src: champiVolets57,
        alt: "Volets 5 à 7 : percer et suspendre la tour, préparer le substrat, puis inoculer, incuber et faire fructifier.",
        label: "VOLETS 05-07",
        mode: "bin",
        threshold: 0.7,
        ratio: 0.94,
      },
    ],
    carte: {
      src: champiTour,
      alt: "Couverture du livret : une tour noire couverte de pleurotes, entourée de flèches vertes, au-dessus de « Fabriquer, observer, récolter ».",
    },
    credits: ["CONTENUS D'APRES LE LOW-TECH LAB, PROJET BIOSPHERE URBAINE"],
  },
  {
    slug: "gnaf",
    num: "04",
    title: "GNAF",
    year: "2026",
    nature: "LOGOTYPE",
    client: "PROJET DE GROUPE / MARQUE DE VETEMENTS",
    image: gnafLogo,
    alt: "Le logo « gnaf. » en minuscules noires aux contours découpés, suivi d'un point, sur fond blanc.",
    lecture: { mode: "bin", threshold: 0.7, ratio: 0.72 },
    lines: [
      "GNAF est une marque de vetements imaginee en groupe. Ma part : le logotype et les recherches de lettrage.",
      "Dix pistes, des capitales taillees aux minuscules etroites, jusqu'au logo retenu : gnaf, en lettres decoupees, avec un point.",
    ],
    resume:
      "GNAF, marque de vêtements imaginée en groupe : le logotype « gnaf. » et dix recherches de lettrage, ma part du projet. Logotype, 2026.",
    serie: [
      {
        src: gnafLettrage,
        alt: "Planche de dix recherches de lettrage : GNAF en capitales à gauche, gnaf en minuscules à droite, dans des styles taillés, étroits ou irréguliers.",
        label: "RECHERCHES DE LETTRAGE",
        mode: "bin",
        threshold: 0.7,
        ratio: 1.33,
      },
    ],
    carte: {
      src: gnafLettrage,
      alt: "Planche de dix recherches de lettrage : GNAF en capitales à gauche, gnaf en minuscules à droite, dans des styles taillés, étroits ou irréguliers.",
    },
    credits: ["PROJET DE GROUPE", "LOGOTYPE ET LETTRAGE : MIRE"],
  },
  {
    slug: "dalton",
    num: "05",
    title: "DALTON",
    year: "2026",
    nature: "GENERIQUE ANIME",
    client: "PROJET D'ECOLE / DNMADE 1",
    image: daltonChaines,
    alt: "Image du générique : deux silhouettes noires de Dalton devant un disque jaune motif chaînes, rayé de traits rouges, sur fond noir.",
    lecture: { mode: "gris", gamma: 0.85, ratio: 0.56 },
    lines: [
      "Un generique pour les Dalton, en aplats noir, rouge et jaune, sans contour.",
      "Le titre en lettres taillees, barre d'un trait rouge ; les freres en ombres chinoises devant un rideau de chaines ; une silhouette rouge entre les barbeles, un revolver ; puis la fuite a travers le desert.",
      "37 secondes d'animation.",
    ],
    resume:
      "Générique animé pour les Dalton : aplats noir, rouge et jaune, titre en lettres taillées, silhouettes devant un rideau de chaînes, fuite à travers le désert. Projet d'école, DNMADE 1, 2026.",
    video: {
      src: daltonGenerique,
      webm: daltonGeneriqueWebm,
      alt: "Le générique animé des Dalton, 37 secondes : le titre, les silhouettes devant les chaînes, une silhouette rouge entre les barbelés, un revolver, puis la course des frères dans un désert rouge.",
      label: "GENERIQUE / 37 S",
      mode: "gris",
      ratio: 0.56,
    },
    serie: [
      {
        src: daltonTitre,
        alt: "Le titre « Dalton » en lettres jaunes taillées en pointes, barré d'un trait rouge, sur fond noir.",
        label: "TITRE",
        mode: "gris",
        ratio: 0.56,
      },
      {
        src: daltonSilhouette,
        alt: "Une silhouette rouge au chapeau de cow-boy, de profil, entre deux lignes de barbelés rouges, sur fond noir.",
        label: "BARBELES",
        mode: "gris",
        gamma: 0.6,
        ratio: 0.56,
      },
      {
        src: daltonCourse,
        alt: "Les frères Dalton en silhouettes jaunes courent devant des mesas rouges, sur fond noir.",
        label: "LA FUITE",
        mode: "gris",
        ratio: 0.56,
      },
    ],
    credits: ["PERSONNAGES : LES DALTON, D'APRES LUCKY LUKE DE MORRIS"],
  },
  {
    slug: "microunivers-3d",
    num: "06",
    title: "MICROUNIVERS 3D",
    year: "2025",
    nature: "MOTION DESIGN 3D",
    client: "PROJET D'ECOLE / DNMADE 1",
    image: microRuine,
    alt: "Un bâtiment en ruine surmonté d'une tour à coupole, posé sur un rocher, éclairé dans le noir, en 3D.",
    lecture: { mode: "gris", gamma: 0.7, ratio: 0.56 },
    lines: [
      "Un micro-univers en 3D : un batiment en ruine pose sur un rocher, dans le noir.",
      "La camera s'en approche puis entre dans une galerie aux murs de brique, entre piliers, chaines et gravats, ou sont accrochees des affiches.",
      "20 secondes d'animation.",
    ],
    resume:
      "Micro-univers en 3D : un bâtiment en ruine sur un rocher, puis une galerie intérieure aux murs de brique où sont accrochées des affiches. Motion design 3D, projet d'école, DNMADE 1, 2025.",
    video: {
      src: microVideo,
      webm: microVideoWebm,
      alt: "Animation 3D de 20 secondes : la caméra s'approche d'un bâtiment en ruine sur un rocher, puis parcourt une galerie intérieure aux affiches accrochées, entre piliers et gravats.",
      label: "ANIMATION / 20 S",
      mode: "gris",
      gamma: 0.7,
      ratio: 0.56,
    },
    serie: [
      {
        src: microGalerie,
        alt: "Intérieur de la galerie en 3D : un mur de brique où sont accrochées trois affiches encadrées, des gravats au sol, des piliers au fond.",
        label: "GALERIE",
        mode: "gris",
        gamma: 0.7,
        ratio: 0.56,
      },
      {
        src: microColonne,
        alt: "Un emblème noir hérissé de pointes posé sur une colonne ionique, à côté d'un tas de briques, en 3D.",
        label: "COLONNE",
        mode: "gris",
        gamma: 0.7,
        ratio: 0.56,
      },
      {
        src: microCouloir,
        alt: "Un couloir entre des piliers d'où pendent des chaînes, avec au fond une affiche rouge marquée d'un signe bleu hérissé d'épines, en 3D.",
        label: "COULOIR",
        mode: "gris",
        gamma: 0.7,
        ratio: 0.56,
      },
    ],
  },
  {
    slug: "poesie-des-formes",
    num: "07",
    title: "LA POESIE DES FORMES",
    year: "2025",
    nature: "MOTION DESIGN",
    client: "PROJET D'ECOLE / DNMADE 1",
    image: poesieYeux,
    alt: "Deux formes blanches arrondies sur fond bleu, chacune avec un disque rouge en bas, comme deux yeux qui regardent vers le bas.",
    lecture: { mode: "bin", threshold: 0.5, ratio: 1 },
    lines: [
      "Des boucles courtes en formes simples et en aplats, sans contour : deux yeux qui regardent, des etoiles qui s'emboitent, des courbes qui se deroulent, des triangles qui glissent.",
      "Bleu, rouge, vert acide et blanc.",
    ],
    resume:
      "Boucles animées en formes simples et aplats de couleur : deux yeux qui regardent, des étoiles qui s'emboîtent, des courbes, des triangles. Motion design, projet d'école, DNMADE 1, 2025.",
    video: {
      src: poesieEtoiles,
      webm: poesieEtoilesWebm,
      alt: "Boucle animée de 25 secondes : des étoiles rouges, vertes et bleues qui s'emboîtent et grandissent l'une dans l'autre.",
      label: "ETOILES / 25 S",
      mode: "gris",
      ratio: 1,
    },
    serie: [
      {
        src: poesieYeuxBoucle,
        webm: poesieYeuxBoucleWebm,
        alt: "Boucle animée : deux formes blanches sur fond bleu dont les disques rouges bougent comme des yeux qui regardent.",
        label: "YEUX",
        mode: "bin",
        threshold: 0.5,
        ratio: 1,
      },
      {
        src: poesieCourbes,
        webm: poesieCourbesWebm,
        alt: "Boucle animée : de larges courbes rouges, vertes puis bleues qui se déroulent sur fond gris clair.",
        label: "COURBES",
        mode: "gris",
        ratio: 1,
      },
      {
        src: poesieTriangles,
        webm: poesieTrianglesWebm,
        alt: "Boucle animée : des triangles bleus qui glissent et grandissent sur fond vert acide.",
        label: "TRIANGLES",
        mode: "gris",
        ratio: 1,
      },
    ],
  },
];

export const bySlug = (slug: string) => projects.find((p) => p.slug === slug);

/** Image du fond de l'index et de la SUITE : celle qui tient un cadrage serre. */
export const fondOf = (p: Project) => p.carte?.src ?? p.image;

/**
 * Planche de tete d'un projet (carte, sinon image principale) avec la lecture
 * reglee de sa planche : le tampon de MOIRE garde son seuil 0,60.
 */
export const teteOf = (p: Project): Planche =>
  p.carte
    ? { ...p.serie?.find((d) => d.src === p.carte!.src), ...p.carte }
    : { src: p.image, alt: p.alt, ...p.lecture };

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
    const tete = teteOf(p);
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
