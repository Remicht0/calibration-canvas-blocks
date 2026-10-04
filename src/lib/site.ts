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

export {
  adresse,
  domainesPhrase,
  mailtoHref,
  metier,
  presentation,
  signature,
  STUDIO,
  telHref,
  type Studio,
} from "./identite";
