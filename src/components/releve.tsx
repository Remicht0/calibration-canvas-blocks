/* Releve : des lignes etiquette / valeur, en mono, separees par un filet.
   Deux colonnes a partir de 768 px ; un nombre impair de lignes etend la
   derniere sur toute la largeur au lieu de laisser un trou (DESIGN.md,
   Chrome commun). Fiche de contact, mentions legales, page A propos. */

export type Ligne = { k: string; v: string };

export function Releve({ lignes, filet }: { lignes: Ligne[]; filet: "blanc" | "noir" }) {
  const bord = filet === "blanc" ? "border-white" : "border-black";
  return (
    <dl className="u-mono grid gap-y-cell2 md:grid-cols-2 md:gap-x-cell">
      {lignes.map((f, i) => (
        <div
          key={f.k}
          className={
            lignes.length % 2 && i === lignes.length - 1
              ? `border-t-[3px] ${bord} pt-cell md:col-span-2`
              : `border-t-[3px] ${bord} pt-cell`
          }
        >
          <dt>{f.k}</dt>
          <dd className="mt-[3px] text-pretty">{f.v}</dd>
        </div>
      ))}
    </dl>
  );
}
