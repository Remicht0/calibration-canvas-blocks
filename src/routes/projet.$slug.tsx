import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BlockBackdrop, BlockType } from "@/components/mire";
import { TopBar } from "@/components/chrome";
import { HybridMedia } from "@/components/media";
import { CalibrationBand } from "@/components/bars";
import { bySlug, projects } from "@/lib/projects";
import { ogPath, siteOrigin } from "@/lib/site";
import { Colophon } from "./index";

export const Route = createFileRoute("/projet/$slug")({
  loader: ({ params }) => {
    const project = bySlug(params.slug);
    if (!project) throw notFound();
    return { ...project, origin: siteOrigin() };
  },
  head: ({ loaderData }) => {
    const t = loaderData ? `${loaderData.title} — MIRE` : "Projet — MIRE";
    const d = loaderData ? loaderData.resume : "Projet du studio de design graphique MIRE.";
    // carte de partage 1-bit generee par `bun run og` (scripts/og.ts)
    const img = loaderData ? `${loaderData.origin}${ogPath(loaderData.slug)}` : null;
    const imgAlt = loaderData
      ? `${loaderData.alt} Carte du projet ${loaderData.title}, rendue en blocs 1 bit.`
      : null;
    return {
      meta: [
        { title: t },
        { name: "description", content: d },
        { property: "og:title", content: t },
        { property: "og:description", content: d },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary_large_image" },
        ...(img && imgAlt
          ? [
              { property: "og:image", content: img },
              { property: "og:image:width", content: "1200" },
              { property: "og:image:height", content: "630" },
              { property: "og:image:type", content: "image/png" },
              { property: "og:image:alt", content: imgAlt },
              { name: "twitter:image", content: img },
              { name: "twitter:image:alt", content: imgAlt },
              {
                "script:ld+json": {
                  "@context": "https://schema.org",
                  "@type": "CreativeWork",
                  name: loaderData!.title,
                  description: d,
                  image: img,
                  dateCreated: loaderData!.year,
                  genre: loaderData!.nature,
                  url: `${loaderData!.origin}/projet/${loaderData!.slug}`,
                  creator: { "@type": "Organization", name: "MIRE" },
                  sourceOrganization: { "@type": "Organization", name: loaderData!.client },
                },
              },
            ]
          : []),
      ],
    };
  },
  component: ProjectPage,
});

function ProjectPage() {
  const p = Route.useLoaderData();
  const navigate = useNavigate();
  const [hover, setHover] = useState<string | null>(null);
  const i = projects.findIndex((o) => o.slug === p.slug);
  const n = projects.length;
  const prev = projects[(i - 1 + n) % n]!;
  const next = projects[(i + 1) % n]!;
  // la suite : les autres projets, precedent et suivant en tete
  const others = [prev, next, ...projects.filter((o) => o !== prev && o !== next && o !== p)];
  const tag = (o: (typeof projects)[number]) =>
    o === prev ? "PRECEDENT" : o === next ? "SUIVANT" : "";

  // fleches du clavier : precedent / suivant, comme on feuillette des planches
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (e.key === "ArrowLeft")
        void navigate({ to: "/projet/$slug", params: { slug: prev.slug } });
      if (e.key === "ArrowRight")
        void navigate({ to: "/projet/$slug", params: { slug: next.slug } });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate, prev.slug, next.slug]);

  return (
    <main id="contenu" tabIndex={-1} className="min-h-screen bg-white text-black">
      <TopBar className="px-cell py-cell2" right={`${p.num} / ${p.year}`} />

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
        <div className="u-mono mb-cell flex justify-between">
          <h2>PLANCHE 02 — DETAILS</h2>
          <span className="hidden md:inline">LE DEFILEMENT COMPOSE LES PLANCHES</span>
        </div>
        <div className="grid gap-cell md:grid-cols-2">
          <HybridMedia
            src={p.image}
            alt={`${p.alt} Détail en seuil binaire.`}
            label={`${p.title} — DETAIL SEUIL`}
            ratio={1.05}
            mode="bin"
            threshold={0.42}
            drive="scroll"
          />
          <HybridMedia
            src={p.image}
            alt={`${p.alt} Détail en mosaïque brute.`}
            label={`${p.title} — DETAIL MOSAIQUE`}
            ratio={1.05}
            mode="brut"
            lensRadius={4.5}
            drive="scroll"
          />
        </div>
      </section>

      {/* SUITE : les autres projets, l'image du projet survole se compose en negatif */}
      <section data-mire="SUITE" className="relative border-t-[10px] border-black">
        <BlockBackdrop src={hover} />
        <div
          className="relative px-cell py-cell2"
          style={{ mixBlendMode: "difference", color: "#FFFFFF" }}
          onMouseLeave={() => setHover(null)}
        >
          <div className="u-mono mb-cell2 flex flex-wrap justify-between gap-cell">
            <h2>SUITE</h2>
            <span className="hidden md:inline">FLECHES DU CLAVIER : PRECEDENT / SUIVANT</span>
          </div>
          <ul>
            {others.map((o) => (
              <li key={o.slug}>
                <Link
                  to="/projet/$slug"
                  params={{ slug: o.slug }}
                  onMouseEnter={() => setHover(o.image)}
                  onFocus={() => setHover(o.image)}
                  className="u-mono grid grid-cols-[4ch_minmax(0,1fr)] items-baseline gap-x-cell py-cell md:grid-cols-[4ch_minmax(0,1fr)_12ch]"
                >
                  <span>{o.num}</span>
                  <span className="u-display block text-[8vw] leading-[0.9] md:text-[3.2vw]">
                    {o.title}
                  </span>
                  <span className="hidden md:block">{tag(o)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <Colophon />
    </main>
  );
}
