import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

const configured = () => {
  const url = import.meta.env["VITE_SITE_URL"] as string | undefined;
  return url ? url.replace(/\/+$/, "") : undefined;
};

/** Origine absolue deduite d'une requete (routes serveur : sitemap, robots). */
export const originOf = (request: Request) => configured() ?? new URL(request.url).origin;

/**
 * Origine absolue du site, sans barre finale. Les cartes de partage (og:image)
 * exigent une URL absolue : VITE_SITE_URL prime si elle est definie, sinon
 * l'origine de la requete en cours (serveur) ou de la page (client).
 */
export const siteOrigin = createIsomorphicFn()
  .server(() => originOf(getRequest()))
  .client(() => configured() ?? window.location.origin);

/** Chemin public de la carte de partage d'un projet, ou de la carte de MIRE. */
export const ogPath = (slug?: string) => `/og/${slug ?? "mire"}.png`;

type Studio = {
  name: string;
  /** Nom de l'entrepreneur : MIRE est le nom sous lequel signe Remi Marty (RE-MI, a l'envers). */
  legalName: string;
  /** Ce que fait MIRE, dit simplement : titres d'onglet, cartes de partage, colophon. */
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
  /** Facultatif : absent, la ligne SIRET disparait de la fiche de contact. */
  siret?: string;
};

/**
 * Identite de MIRE, source unique pour le colophon, la fiche de contact et
 * les donnees structurees. Ecrite hors mire (francais courant, accentue) : les
 * vues la passent par mireText() pour l'afficher dans la grille.
 */
export const STUDIO: Studio = {
  name: "MIRE",
  legalName: "Rémi Marty",
  role: "Graphiste indépendant",
  domaines: ["Identité visuelle", "Édition"],
  email: "studio0mire@gmail.com",
  phone: "+33 7 49 82 95 94",
  street: "27 rue des Bouviers",
  city: "Bordeaux",
  country: "FR",
  founded: "2023",
  timeZone: "Europe/Paris",
};

/** Ligne d'identite hors mire : « MIRE — Graphiste indépendant ». */
export const signature = `${STUDIO.name} — ${STUDIO.role}`;

/** Adresse postale sur une ligne ; le code postal n'y entre que s'il est connu. */
export const adresse = `${STUDIO.street}, ${[STUDIO.postalCode, STUDIO.city].filter(Boolean).join(" ")}`;

/** Lien d'ecriture vers MIRE. */
export const mailtoHref = `mailto:${STUDIO.email}`;

/** Lien d'appel : le numero sans espaces ni ponctuation, indicatif conserve. */
export const telHref = `tel:${STUDIO.phone.replace(/[^\d+]/g, "")}`;
