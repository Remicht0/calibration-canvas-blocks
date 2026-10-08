/**
 * Texte de la page A propos : les mots de Remi, developpes sans rien y
 * ajouter, et des faits du site verifiables (signature, mire, NET) : DESIGN.md
 * section 4, « Le texte A propos ». Ecrit hors mire, en
 * francais accentue : la page le passe par mireText() pour l'afficher dans la
 * grille, la description sert telle quelle aux moteurs et aux cartes de partage.
 *
 * Le nom legal n'est jamais ecrit ici : le jeton {NOM} est remplace par
 * STUDIO.legalName (identite.ts, source unique). Aucun accord ne se rapporte
 * a Remi (ni ne, ni nee) : les tournures restent neutres.
 */
import { STUDIO } from "./identite";

/** Une ligne du releve : etiquette et valeur, comme la fiche de contact. */
type Ligne = { k: string; v: string };

const nom = (t: string) => t.replaceAll("{NOM}", STUDIO.legalName);

const TEXTE = {
  intro:
    "Je m'appelle {NOM}. Je suis originaire de Montauban, dans le Tarn-et-Garonne. Tout part d'une obsession de toujours : l'image et les couleurs.",
  /** Le parcours (deux paragraphes), puis la signature et le bitmap (deux autres). */
  paragraphes: [
    "De cette obsession vient ma passion pour le graphisme et pour le numérique. Je suis encore en études. Mon parcours tient en trois villes.",
    "Montauban, d'abord. Condom, ensuite, dans le Gers : j'y ai obtenu un bac STD2A (sciences et technologies du design et des arts appliqués). Puis Bordeaux, pour suivre un DN MADe (diplôme national des métiers d'art et du design). Changer de ville pour cette formation prouve ma détermination à exercer cette passion.",
    "Je signe MIRE : MI-RÉ, c'est RÉ-MI à l'envers. Une mire, c'est aussi une image de calibration, et le site entier en est une : noir pur, blanc pur, une seule ligne rouge. Chaque image y est lue en blocs. Sur chaque planche de projet, le bouton NET rend l'image d'origine, nette et dans ses couleurs.",
    "Que dire de plus ? J'adore l'esthétique bitmap. Ce portfolio en témoigne, tout comme ma passion pour le numérique.",
  ],
  /** Grand titre de la signature : 12 caracteres au plus par ligne. */
  accroche: ["L'image,", "la couleur,", "le bitmap."],
  releve: [
    { k: "Origine", v: "Montauban (Tarn-et-Garonne)" },
    { k: "Obsession", v: "L'image, les couleurs" },
    { k: "Passion", v: "Le graphisme, le numérique" },
    { k: "Bac", v: "STD2A, Condom (Gers)" },
    { k: "Formation", v: "DN MADe, Bordeaux (en cours)" },
    { k: "Esthétique", v: "Bitmap" },
    { k: "Signature", v: "MIRE (RÉ-MI à l'envers)" },
  ],
  description:
    "Originaire de Montauban, en DN MADe à Bordeaux, {NOM} signe MIRE, avec la passion de l'image, des couleurs, du graphisme, du numérique et du bitmap.",
};

export const PROPOS = {
  intro: nom(TEXTE.intro),
  paragraphes: TEXTE.paragraphes.map(nom),
  accroche: TEXTE.accroche,
  releve: TEXTE.releve.map((l) => ({ k: l.k, v: nom(l.v) })),
  description: nom(TEXTE.description),
};
