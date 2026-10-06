/*
 * Les tailles d'une image de projet, reliees par leur nom de fichier :
 *   src/assets/petit/<nom>  640 px de cote long, pour les lectures en blocs
 *                           (une planche n'a jamais plus de quelques dizaines
 *                           de cellules : 80 % de poids en moins) ;
 *   src/assets/<nom>        1 600 px, la source de la page ;
 *   src/assets/net/<nom>    jusqu'a 3 200 px, pour NET sur grand ecran.
 * Les globs Vite ne mettent que des URL dans le JS. Module a part : les
 * scripts lances par bun (scripts/og.ts) n'ont pas import.meta.glob.
 */
const sources = import.meta.glob<string>("../assets/*.{jpg,jpeg,png}", {
  eager: true,
  query: "?url",
  import: "default",
});
const petites = import.meta.glob<string>("../assets/petit/*.{jpg,jpeg,png}", {
  eager: true,
  query: "?url",
  import: "default",
});
const nettes = import.meta.glob<string>("../assets/net/*.{jpg,jpeg,png}", {
  eager: true,
  query: "?url",
  import: "default",
});

const nom = (chemin: string) => chemin.slice(chemin.lastIndexOf("/") + 1);
const parNom = (g: Record<string, string>) =>
  new Map(Object.entries(g).map(([k, u]) => [nom(k), u]));
const petitParNom = parNom(petites);
const netParNom = parNom(nettes);
const nomParUrl = new Map(Object.entries(sources).map(([k, u]) => [u, nom(k)]));

/** La petite version d'une image de projet, pour les blocs ; sinon l'image elle-meme. */
export const petitOf = (src: string): string => {
  const n = nomParUrl.get(src);
  return (n && petitParNom.get(n)) || src;
};

/** La version plus grande d'une image de projet pour NET, si elle existe. */
export const netOf = (src: string): string | undefined => {
  const n = nomParUrl.get(src);
  return n ? netParNom.get(n) : undefined;
};
