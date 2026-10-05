import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { BlockBackdrop, BlockType } from "@/components/mire";
import { TopBar } from "@/components/chrome";
import { HybridMedia } from "@/components/media";
import { CalibrationBand } from "@/components/bars";
import type { BitMode } from "@/lib/bitmap";
import { mireText } from "@/lib/glyphs";
import { bySlug, fondOf, projects, type Lecture, type Project } from "@/lib/projects";
import { metier, ogPath, siteOrigin, STUDIO } from "@/lib/site";
import { useTeteTactile } from "@/lib/tete";
import { Colophon } from "./index";

/** URL absolue d'un fichier servi par le site (import Vite : chemin a la racine). */
const absolu = (origin: string, src: string) =>
  /^https?:\/\//.test(src) ? src : `${origin}${src}`;

export const Route = createFileRoute("/projet/$slug")({
  loader: ({ params }) => {
    const project = bySlug(params.slug);
    if (!project) throw notFound();
    return { ...project, origin: siteOrigin() };
  },
  head: ({ loaderData }) => {
    const t = loaderData ? `${loaderData.title} — MIRE` : "Projet — MIRE";
    const d = loaderData ? loaderData.resume : `Projet de ${STUDIO.name}, ${metier}.`;
    // carte de partage 1-bit generee par `bun run og` (scripts/og.ts)
    const img = loaderData ? `${loaderData.origin}${ogPath(loaderData.slug)}` : null;
    // la carte est en noir et blanc pur : son texte alternatif ne cite ni couleur ni detail fin
    const imgAlt = loaderData
      ? `Carte de partage en blocs noirs sur blanc : à gauche une planche du projet seuillée en 1 bit, à droite MIRE, ${loaderData.num} / ${loaderData.year}, ${loaderData.title}, ${loaderData.client}, ${loaderData.nature}.`
      : null;
    const video = loaderData?.video;
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
                  isPartOf: {
                    "@type": "WebSite",
                    name: STUDIO.name,
                    url: `${loaderData!.origin}/`,
                  },
                  // seulement ce que la source dit vraiment : ni date ni vignette inventees
                  ...(video
                    ? {
                        video: {
                          "@type": "VideoObject",
                          name: video.label
                            ? `${loaderData!.title} — ${video.label}`
                            : loaderData!.title,
                          description: video.alt,
                          contentUrl: absolu(loaderData!.origin, video.src),
                        },
                      }
                    : {}),
                },
              },
            ]
          : []),
      ],
    };
  },
  component: ProjectPage,
});

/** Lecture complete d'une planche : chaque reglage absent prend le defaut de sa place. */
type Reglage = { mode: BitMode; threshold: number; gamma: number; ratio: number };

const regler = (l: Lecture | undefined, defaut: Reglage): Reglage => ({
  mode: l?.mode ?? defaut.mode,
  threshold: l?.threshold ?? defaut.threshold,
  gamma: l?.gamma ?? defaut.gamma,
  ratio: l?.ratio ?? defaut.ratio,
});

// planche 01 : photo douce, cadre paysage ; serie : planche de detail en seuil ;
// video : gris, cadre paysage, lue dans le temps (la planche porte PAUSE)
const PLANCHE_01: Reglage = { mode: "gris", threshold: 0.45, gamma: 0.78, ratio: 0.56 };
const PLANCHE_SERIE: Reglage = { mode: "bin", threshold: 0.42, gamma: 0.85, ratio: 1.05 };
const PLANCHE_VIDEO: Reglage = { mode: "gris", threshold: 0.45, gamma: 0.85, ratio: 0.56 };

const nn = (k: number) => String(k).padStart(2, "0");

type PlancheVue = Reglage & { src: string; alt: string; label: string; loupe?: number };

/**
 * Les planches 02, 03... dans l'ordre de la serie, chacune avec sa lecture.
 * Sans serie, les deux lectures de l'image principale : seuil, puis mosaique.
 */
function serieOf(p: Project): PlancheVue[] {
  if (p.serie?.length)
    return p.serie.map((d, k) => ({
      ...regler(d, PLANCHE_SERIE),
      src: d.src,
      alt: d.alt,
      label: `${p.title} — ${d.label ? mireText(d.label) : `PLANCHE ${nn(k + 2)}`}`,
    }));
  return [
    {
      ...PLANCHE_SERIE,
      src: p.image,
      alt: `${p.alt} Détail en seuil binaire.`,
      label: `${p.title} — DETAIL SEUIL`,
    },
    {
      ...PLANCHE_SERIE,
      mode: "brut",
      src: p.image,
      alt: `${p.alt} Détail en mosaïque brute.`,
      label: `${p.title} — DETAIL MOSAIQUE`,
      loupe: 4.5,
    },
  ];
}

function ProjectPage() {
  const p = Route.useLoaderData();
  const navigate = useNavigate();
  const i = projects.findIndex((o) => o.slug === p.slug);
  const n = projects.length;
  const prev = projects[(i - 1 + n) % n]!;
  const next = projects[(i + 1) % n]!;
  // la suite : les autres projets, precedent et suivant en tete, chacun une fois
  // (a deux projets, precedent et suivant sont le meme) ; le loader renvoie une
  // copie du projet courant, on le reconnait donc a son slug
  const others = [prev, next, ...projects].filter(
    (o, k, all) => o.slug !== p.slug && all.indexOf(o) === k,
  );
  const tag = (o: Project) => (o === next ? "SUIVANT" : o === prev ? "PRECEDENT" : "");

  const une = regler(p.lecture, PLANCHE_01);
  const signal = p.video ? { ...p.video, ...regler(p.video, PLANCHE_VIDEO) } : null;
  const serie = serieOf(p);
  const fin = serie.length + 1;
  // une planche seule en fin de serie : pleine largeur si elle est en paysage,
  // sinon a la largeur d'une colonne, au milieu, mais calee sur le pas : son
  // retrait est arrondi a la cellule pour que ses blocs tombent dans les
  // colonnes de la planche au-dessus (centree a la lettre, elle decalait d'une
  // demi-cellule en 1440). Sans round(), elle reste dans la colonne de gauche.
  const seule = serie.length % 2 === 1 ? serie.length - 1 : -1;

  // fleches du clavier : precedent / suivant, comme on feuillette des planches ;
  // un chiffre saute directement au projet N
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (document.documentElement.classList.contains("mire-modal")) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      // sur AZERTY un chiffre se tape avec Maj : seules les fleches refusent le modificateur
      if (!e.shiftKey && e.key === "ArrowLeft")
        void navigate({ to: "/projet/$slug", params: { slug: prev.slug } });
      if (!e.shiftKey && e.key === "ArrowRight")
        void navigate({ to: "/projet/$slug", params: { slug: next.slug } });
      if (/^[1-9]$/.test(e.key)) {
        const target = projects[Number(e.key) - 1];
        if (target) void navigate({ to: "/projet/$slug", params: { slug: target.slug } });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate, prev.slug, next.slug]);

  return (
    <main id="contenu" tabIndex={-1} className="min-h-screen bg-white text-black">
      <TopBar className="px-cell py-cell2" right={`${p.num} / ${p.year}`} />

      <section data-mire="EN-TETE" className="px-cell pb-cell4">
        <BlockType text={p.title} loop={false} drive="scan" maxHeight={0.4} />
      </section>

      {/* PLANCHE PRINCIPALE au premier ecran — media hybride, lecture au choix */}
      <section data-mire="PLANCHE 01" className="bg-white px-cell pb-cell4">
        <div className="u-mono mb-cell flex justify-between gap-cell">
          <h2>PLANCHE 01 — MATIERE</h2>
          <span className="hidden md:[@media(hover:hover)]:inline">
            SURVOL = LOUPE / MATIERE BRUTE
          </span>
          <span className="md:[@media(hover:hover)]:hidden">APPUI LONG = LOUPE</span>
        </div>
        <HybridMedia
          key={p.slug}
          src={p.image}
          alt={p.alt}
          label={p.title}
          ratio={une.ratio}
          mode={une.mode}
          threshold={une.threshold}
          gamma={une.gamma}
        />
      </section>

      <CalibrationBand height={5} seed={7} className="border-y-[10px] border-black" />

      {/* BLOC NOIR : mesures puis notes, d'un seul tenant */}
      <section data-mire="MESURES" className="on-black bg-black px-cell py-cell4 text-white">
        <h2 className="sr-only">Mesures</h2>
        <div className="u-mono grid grid-cols-2 gap-x-cell gap-y-cell2 md:grid-cols-4">
          <div className="min-w-0 break-words">
            <div>CLIENT</div>
            <div>{p.client}</div>
          </div>
          <div className="min-w-0 break-words">
            <div>NATURE</div>
            <div>{p.nature}</div>
          </div>
          <div className="min-w-0 break-words">
            <div>ANNEE</div>
            <div>{p.year}</div>
          </div>
          <div className="min-w-0 break-words">
            <div>REF</div>
            <div>
              MIRE-{p.num}-{p.year}
            </div>
          </div>
        </div>
      </section>

      {/* TEXTE COLONNE ETROITE, credits dessous */}
      <section data-mire="NOTES" className="on-black bg-black px-cell pb-cell4 text-white">
        <h2 className="sr-only">Notes</h2>
        <div className="u-copy max-w-[54ch] space-y-cell2">
          {p.lines.map((l) => (
            <p key={l}>{l}</p>
          ))}
        </div>
        {p.credits?.length ? (
          <div className="mt-cell4 max-w-[54ch] break-words">
            <h3 className="u-mono mb-cell">CREDITS</h3>
            <ul className="u-mono">
              {p.credits.map((c) => (
                <li key={c}>{mireText(c)}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      {/* SIGNAL : la video du projet, lue dans la grille comme une planche */}
      {signal && (
        <section data-mire="SIGNAL" className="bg-white px-cell py-cell4">
          <div className="u-mono mb-cell flex justify-between gap-cell">
            <h2>SIGNAL — VIDEO</h2>
            <span className="hidden md:inline">BOUCLE MUETTE / PAUSE SOUS LA PLANCHE</span>
          </div>
          <HybridMedia
            key={p.slug}
            src={signal.src}
            alt={signal.alt}
            label={`${p.title} — ${signal.label ? mireText(signal.label) : "VIDEO"}`}
            ratio={signal.ratio}
            mode={signal.mode}
            threshold={signal.threshold}
            gamma={signal.gamma}
          />
        </section>
      )}

      {/* SERIE : planches 02 a NN, une colonne, puis par paires a partir de lg */}
      <section
        data-mire="PLANCHES"
        className={`bg-white px-cell py-cell4 ${signal ? "border-t-[10px] border-black" : ""}`}
      >
        <div className="u-mono mb-cell flex justify-between gap-cell">
          <h2>{fin > 2 ? `PLANCHES 02 — ${nn(fin)}` : "PLANCHE 02"}</h2>
          <span className="hidden md:inline">LE DEFILEMENT COMPOSE LES PLANCHES</span>
        </div>
        <div className="grid items-start gap-cell lg:grid-cols-[repeat(2,round(down,calc((100%-var(--cell))/2),var(--cell)))]">
          {serie.map((d, k) => (
            <HybridMedia
              key={`${p.slug}-${k}`}
              src={d.src}
              alt={d.alt}
              label={d.label}
              ratio={d.ratio}
              mode={d.mode}
              threshold={d.threshold}
              gamma={d.gamma}
              lensRadius={d.loupe}
              drive="scroll"
              className={
                k !== seule
                  ? ""
                  : d.ratio < 0.8
                    ? "lg:col-span-2"
                    : "lg:col-span-2 lg:ml-[round(calc(25%_+_var(--cell)_/_4),var(--cell))] lg:w-[calc(50%_-_var(--cell)_/_2)] lg:justify-self-start"
              }
            />
          ))}
        </div>
      </section>

      <Suite key={p.slug} others={others} tag={tag} />

      <Colophon />
    </main>
  );
}

/**
 * SUITE : les autres projets. L'image du projet survole se compose en negatif ;
 * en tactile, c'est celle de la ligne que croise la ligne rouge. Une instance
 * par projet (cle = slug) : rien de la page precedente ne reste allume.
 */
function Suite({ others, tag }: { others: Project[]; tag: (o: Project) => string }) {
  const [hover, setHover] = useState<string | null>(null);
  const lignes = useRef<Array<HTMLElement | null>>([]);
  useTeteTactile(lignes, (k) => {
    const o = k === null ? undefined : others[k];
    setHover(o ? fondOf(o) : null);
  });

  return (
    <section data-mire="SUITE" className="on-black relative border-t-[10px] border-black">
      <BlockBackdrop src={hover} />
      <div
        className="relative px-cell py-cell2"
        style={{ mixBlendMode: "difference", color: "#FFFFFF" }}
        onMouseLeave={() => setHover(null)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) setHover(null);
        }}
      >
        <div className="u-mono mb-cell2 flex flex-wrap justify-between gap-cell">
          <h2>SUITE</h2>
          <span className="hidden md:inline">FLECHES DU CLAVIER : PRECEDENT / SUIVANT</span>
        </div>
        <ul>
          {others.map((o, k) => (
            <li
              key={o.slug}
              ref={(el) => {
                lignes.current[k] = el;
              }}
            >
              <Link
                to="/projet/$slug"
                params={{ slug: o.slug }}
                onMouseEnter={() => setHover(fondOf(o))}
                onFocus={() => setHover(fondOf(o))}
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
  );
}
