/**
 * Identite de MIRE : Remi Marty, graphiste independant, qui signe MIRE
 * (RE-MI, a l'envers). Source unique, sans dependance au framework : le site
 * la lit (par site.ts) et le script des cartes de partage aussi (scripts/og.ts).
 *
 * Ecrite hors mire (francais courant, accentue) : les vues la passent par
 * mireText() pour l'afficher dans la grille. Apres un changement ici,
 * `bun run og` refait la carte de partage et le manifeste d'application.
 */

export type Hebergeur = { nom: string; adresse: string; telephone: string };

export type Studio = {
  name: string;
  /** Nom de l'entrepreneur, editeur du site et directeur de la publication. */
  legalName: string;
  /** Ce que fait MIRE, dit simplement : titres, descriptions, carte de partage, colophon. */
  role: string;
  /** Domaines reellement pratiques, et eux seuls. */
  domaines: readonly string[];
  email: string;
  /** Format international, groupe par deux : il sert a l'affichage et au lien d'appel. */
  phone: string;
  street: string;
  /** Facultatif : absent, l'adresse s'ecrit sans lui. */
  postalCode?: string;
  city: string;
  country: string;
  /** Annee de debut de l'activite. */
  founded: string;
  /** Fuseau de la ville : l'horloge de la fiche de contact donne l'heure d'ici, pas celle du visiteur. */
  timeZone: string;
  /** Promesse faite au client, citee a l'identique partout ou elle apparait. */
  delaiReponse: string;
  /** Facultatif : absent, la ligne SIRET disparait de la fiche et des mentions. */
  siret?: string;
  /** Facultatif : absent, la ligne hebergeur manque aux mentions legales. */
  hebergeur?: Hebergeur;
};

export const STUDIO: Studio = {
  name: "MIRE",
  legalName: "Rémi Marty",
  role: "Graphiste indépendant",
  domaines: ["Identité visuelle", "Édition"],
  email: "contact@mirestudio.fr",
  phone: "+33 7 49 82 95 94",
  street: "27 rue des Bouviers",
  postalCode: "33800",
  city: "Bordeaux",
  country: "FR",
  founded: "2023",
  timeZone: "Europe/Paris",
  delaiReponse: "48 heures ouvrées",
  // le site est servi par Cloudflare Workers (cible du build), sous le domaine de MIRE
  hebergeur: {
    nom: "Cloudflare, Inc.",
    adresse: "101 Townsend St, San Francisco, CA 94107, États-Unis",
    telephone: "+1 650 319 8930",
  },
};

const minuscule = (s: string) => s.charAt(0).toLocaleLowerCase("fr") + s.slice(1);

/** Le role en milieu de phrase : « graphiste indépendant ». */
export const metier = minuscule(STUDIO.role);

/** Ligne d'identite hors mire : « MIRE — Graphiste indépendant ». */
export const signature = `${STUDIO.name} — ${STUDIO.role}`;

/** Titre de l'accueil hors mire : « MIRE — Graphiste indépendant à Bordeaux ». */
export const titreAccueil = `${signature} à ${STUDIO.city}`;

/** Debut des descriptions : « MIRE, graphiste indépendant à Bordeaux ». */
export const presentation = `${STUDIO.name}, ${metier} à ${STUDIO.city}`;

/** Les domaines en une phrase : « Identité visuelle et édition ». */
export const domainesPhrase = (() => {
  const d = STUDIO.domaines.map((x, i) => (i ? minuscule(x) : x));
  return d.length < 2 ? d.join("") : `${d.slice(0, -1).join(", ")} et ${d[d.length - 1]}`;
})();

/** Adresse postale sur une ligne ; le code postal n'y entre que s'il est connu. */
export const adresse = `${STUDIO.street}, ${[STUDIO.postalCode, STUDIO.city].filter(Boolean).join(" ")}`;

/** Lien d'ecriture vers MIRE. */
export const mailtoHref = `mailto:${STUDIO.email}`;

/** Lien d'appel : le numero sans espaces ni ponctuation, indicatif conserve. */
export const telHref = `tel:${STUDIO.phone.replace(/[^\d+]/g, "")}`;
