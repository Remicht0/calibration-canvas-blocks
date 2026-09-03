import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { BlockType } from "@/components/mire";
import { HybridMedia } from "@/components/media";
import { CalibrationBand } from "@/components/bars";
import { bySlug, projects } from "@/lib/projects";
import { Colophon } from "./index";

export const Route = createFileRoute("/projet/$slug")({
  loader: ({ params }) => {
    const project = bySlug(params.slug);
    if (!project) throw notFound();
    return project;
  },
  head: ({ loaderData }) => {
    const t = loaderData ? `${loaderData.title} — MIRE` : "Projet — MIRE";
    const d = loaderData ? loaderData.resume : "Projet du studio de design graphique MIRE.";
    return {
      meta: [
        { title: t },
        { name: "description", content: d },
        { property: "og:title", content: t },
        { property: "og:description", content: d },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: ProjectPage,
});

function ProjectPage() {
  const p = Route.useLoaderData();
  const others = projects.filter((o) => o.slug !== p.slug);

  return (
    <main id="contenu" tabIndex={-1} className="min-h-screen bg-white text-black">
      <div className="u-mono flex justify-between px-cell py-cell2">
        <Link to="/">RETOUR / INDEX</Link>
        <span>
          {p.num} / {p.year}
        </span>
      </div>

      <section data-mire="EN-TETE" className="px-cell pb-cell4">
        <BlockType text={p.title} loop={false} />
      </section>

      <CalibrationBand height={5} seed={7} className="border-y-[10px] border-black" />

      {/* BLOC NOIR */}
      <section data-mire="MESURES" className="bg-black px-cell py-cell4 text-white">
        <h2 className="sr-only">Mesures</h2>
        <div className="u-mono grid gap-y-cell2 md:grid-cols-4 md:gap-x-cell">
          <div>
            <div>CLIENT</div>
            <div>{p.client}</div>
          </div>
          <div>
            <div>NATURE</div>
            <div>{p.nature}</div>
          </div>
          <div>
            <div>ANNEE</div>
            <div>{p.year}</div>
          </div>
          <div>
            <div>REF</div>
            <div>
              MIRE-{p.num}-{p.year}
            </div>
          </div>
        </div>
      </section>

      {/* PLANCHE PRINCIPALE — media hybride, lecture au choix */}
      <section data-mire="PLANCHE 01" className="bg-white px-cell py-cell4">
        <div className="u-mono mb-cell flex justify-between">
          <h2>PLANCHE 01 — MATIERE</h2>
          <span className="hidden md:inline">SURVOL = LOUPE / MATIERE BRUTE</span>
        </div>
        <HybridMedia
          src={p.image}
          alt={p.alt}
          label={p.title}
          ratio={0.56}
          mode="gris"
          gamma={0.78}
        />
      </section>

      {/* TEXTE COLONNE ETROITE */}
      <section data-mire="NOTES" className="bg-black px-cell py-cell4 text-white">
        <h2 className="sr-only">Notes</h2>
        <div className="u-copy max-w-[54ch] space-y-cell2">
          {p.lines.map((l) => (
            <p key={l}>{l}</p>
          ))}
        </div>
      </section>

      <section data-mire="PLANCHE 02" className="bg-white px-cell py-cell4">
        <h2 className="sr-only">Planche 02, détails</h2>
        <div className="grid gap-cell md:grid-cols-2">
          <HybridMedia
            src={p.image}
            alt={`${p.alt} Détail en seuil binaire.`}
            label={`${p.title} — DETAIL SEUIL`}
            ratio={1.05}
            mode="bin"
            threshold={0.42}
          />
          <HybridMedia
            src={p.image}
            alt={`${p.alt} Détail en mosaïque brute.`}
            label={`${p.title} — DETAIL MOSAIQUE`}
            ratio={1.05}
            mode="brut"
            lensRadius={4.5}
          />
        </div>
      </section>

      <section data-mire="COLOPHON" className="border-t-[10px] border-black px-cell py-cell2">
        <h2 className="u-mono mb-cell2">SUITE</h2>
        <ul>
          {others.map((o) => (
            <li key={o.slug}>
              <Link
                to="/projet/$slug"
                params={{ slug: o.slug }}
                className="u-display block py-cell text-[8vw] leading-[0.9] md:text-[3.2vw]"
              >
                {o.title}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <Colophon />
    </main>
  );
}
