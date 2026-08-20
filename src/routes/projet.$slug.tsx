import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { BlockImage, BlockType, ScanLine } from "@/components/mire";
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
    const d = loaderData
      ? `${loaderData.nature}, ${loaderData.year}. Projet du studio MIRE pour ${loaderData.client}.`
      : "Projet du studio de design graphique MIRE.";
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
    <main className="min-h-screen bg-white text-black">
      <ScanLine />

      <div className="u-mono flex justify-between px-cell py-cell2">
        <Link to="/">RETOUR / INDEX</Link>
        <span>
          {p.num} / {p.year}
        </span>
      </div>

      <section className="px-cell pb-cell4">
        <BlockType text={p.title} loop={false} />
      </section>

      {/* BLOC NOIR */}
      <section className="bg-black px-cell py-cell4 text-white">
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
            <div>MIRE-{p.num}-{p.year}</div>
          </div>
        </div>
      </section>

      {/* IMAGE PLEINE LARGEUR */}
      <section className="bg-white px-cell py-cell4">
        <BlockImage src={p.image} alt={p.title} ratio={0.62} threshold={0.45} />
      </section>

      {/* TEXTE COLONNE ETROITE */}
      <section className="bg-black px-cell py-cell4 text-white">
        <div className="u-mono max-w-[54ch] space-y-cell2">
          {p.lines.map((l) => (
            <p key={l}>{l}</p>
          ))}
        </div>
      </section>

      <section className="bg-white px-cell py-cell4">
        <div className="grid gap-cell md:grid-cols-2">
          <BlockImage src={p.image} alt={`${p.title} — detail`} ratio={1.1} threshold={0.34} />
          <BlockImage src={p.image} alt={`${p.title} — detail`} ratio={1.1} threshold={0.58} />
        </div>
      </section>

      <section className="border-t-[10px] border-black px-cell py-cell2">
        <div className="u-mono mb-cell2">SUITE</div>
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
