import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

const configured = () => {
  const url = import.meta.env["VITE_SITE_URL"] as string | undefined;
  return url ? url.replace(/\/+$/, "") : undefined;
};

/**
 * Origine absolue du site, sans barre finale. Les cartes de partage (og:image)
 * exigent une URL absolue : VITE_SITE_URL prime si elle est definie, sinon
 * l'origine de la requete en cours (serveur) ou de la page (client).
 */
export const siteOrigin = createIsomorphicFn()
  .server(() => configured() ?? new URL(getRequest().url).origin)
  .client(() => configured() ?? window.location.origin);

/** Chemin public de la carte de partage d'un projet, ou de la carte du studio. */
export const ogPath = (slug?: string) => `/og/${slug ?? "mire"}.png`;
