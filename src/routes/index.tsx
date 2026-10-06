import { createFileRoute, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { BlockBackdrop, BlockType, BlockVignette } from "@/components/mire";
import { CalibrationBand, Ticker } from "@/components/bars";
import { Bloc } from "@/components/bloc";
import { HybridMedia } from "@/components/media";
import { BitmapClock } from "@/components/bitmap-extras";
import { TopBar, VERS_INDEX } from "@/components/chrome";
import type { BitMode } from "@/lib/bitmap";
import { mireText } from "@/lib/glyphs";
import { fondOf, periode, planches, projects, teteOf, type Project } from "@/lib/projects";
import { netOf, petitOf } from "@/lib/sources";
import { raccourcisCoupes } from "@/lib/reglages";
import { domainesPhrase, presentation, siteOrigin, STUDIO, titreAccueil } from "@/lib/site";
import { useTeteTactile } from "@/lib/tete";
import { accueillirIndex, arriveeIndex } from "@/lib/arrivee-index";

export const Route = createFileRoute("/")({
  // origine absolue : la liste des projets en donnees structurees l'exige
  loader: () => ({ origin: siteOrigin() }),
  head: ({ loaderData }) => ({
    meta: [
      { title: titreAccueil },
      {
        name: "description",
        content: `${presentation}. ${domainesPhrase}. Un site construit comme une image de calibration : 1-bit, grille de blocs, une seule ligne rouge.`,
      },
      { property: "og:title", content: titreAccueil },
      {
        property: "og:description",
        content: `${domainesPhrase}. Rendu 1-bit par blocs, dissolution par chute de blocs.`,
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      // les projets de l'index, dans son ordre, chacun a son adresse absolue
      ...(loaderData
        ? [
            {
              "script:ld+json": {
                "@context": "https://schema.org",
                "@type": "ItemList",
                name: "Projets",
                numberOfItems: projects.length,
                itemListElement: projects.map((p, i) => ({
                  "@type": "ListItem",
                  position: i + 1,
                  item: {
                    "@type": "CreativeWork",
                    name: p.nom,
                    url: `${loaderData.origin}/projet/${p.slug}`,
                  },
                })),
              },
            },
          ]
        : []),
    ],
  }),
  component: Index,
});

/** Planches d'un projet : la planche 01, sa serie, sa video. */
const nPlanches = (p: Project) => 1 + (p.serie?.length ?? 0) + (p.video ? 1 : 0);

const LECTURES: BitMode[] = ["bin", "gris", "brut"];

/**
 * Banc d'essai : trois planches, de trois projets differents quand il y en a
 * assez (la tete de chaque projet d'abord, puis le reste), chacune lue dans un
 * des trois modes. Moins de trois planches : la meme source est relue.
 */
const BANC = (() => {
  const vus = new Set<string>();
  const tetes = planches.filter((d) => !vus.has(d.projet.slug) && !!vus.add(d.projet.slug));
  const suite = [...tetes, ...planches.filter((d) => !tetes.includes(d))];
  return LECTURES.flatMap((mode, k) => {
    const d = suite[k % suite.length];
    return d ? [{ ...d, mode }] : [];
  });
})();

// un Bloc dont la hauteur suit le libelle : passe a la ligne, il grandit au lieu de deborder,
// d'une cellule par ligne (interligne = une cellule, demi-cellule de marge moins le cadre) :
// une ligne = 2 cellules, deux lignes = 3 cellules, jamais de demi-cellule
const BLOC_SOUPLE =
  "h-auto min-h-cell2 max-w-full py-[calc(var(--cell)/2-3px)] leading-[var(--cell)]";

function Index() {
  const [hover, setHover] = useState<string | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [cursor, setCursor] = useState<number | null>(null);
  // apres une butee, l'index a rendu la main : il ne reprend les fleches qu'une fois sorti de l'ecran
  const released = useRef(false);
  const items = useRef<Array<HTMLLIElement | null>>([]);
  const index = useRef<HTMLElement>(null);
  const navigate = useNavigate();
  const hash = useRouterState({ select: (s) => s.location.hash });

  // Arrivee par un lien INDEX (barre haute, console, ligne de l'entree) : la
  // section prend le focus, le Tab continue dans l'index au lieu de remonter
  useEffect(() => {
    if (hash === "index" && arriveeIndex.demandee) accueillirIndex();
    arriveeIndex.demandee = false;
  }, [hash]);

  // Tactile : pas de survol. La ligne rouge est la tete de lecture : le projet
  // qu'elle croise est marque. Pas de fond en negatif : chaque ligne porte deja
  // sa vignette, et le fond pleine section la recouvrait.
  useTeteTactile(items, (i) => {
    const p = i === null ? undefined : projects[i];
    setActive(p ? p.slug : null);
  });

  // Clavier : HAUT / BAS deplacent une tete de lecture sur l'index (bloc plein,
  // fond en negatif, saut sec dans l'ecran), ESC la relache, un chiffre saute
  // au projet N. Les fleches ne sont prises que si l'index est a l'ecran ou
  // porte le focus : ailleurs, la page defile.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (document.documentElement.classList.contains("mire-modal")) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;

      if (/^[1-9]$/.test(e.key) && !raccourcisCoupes()) {
        const p = projects[Number(e.key) - 1];
        if (p) void navigate({ to: "/projet/$slug", params: { slug: p.slug } });
        return;
      }

      const section = index.current;
      if (!section) return;
      const focused = section.contains(document.activeElement);
      if (e.key === "Escape") {
        if (cursor === null) return;
        if (focused) (document.activeElement as HTMLElement | null)?.blur();
        setCursor(null);
        setActive(null);
        setHover(null);
        return;
      }

      const last = projects.length - 1;
      let next: number;
      if (e.key === "ArrowDown") next = cursor === null ? 0 : cursor + 1;
      else if (e.key === "ArrowUp") next = cursor === null ? 0 : cursor - 1;
      else if (e.key === "Home") next = 0;
      else if (e.key === "End") next = last;
      else return;

      const r = section.getBoundingClientRect();
      const visible = r.bottom > 0 && r.top < window.innerHeight;
      if (!visible) released.current = false;
      // premiere prise : seulement si l'index est a l'ecran et n'a pas deja rendu la main
      if (cursor === null && !focused && (!visible || released.current)) return;
      // butee : la tete de lecture rend la main, la page defile normalement
      if (next < 0 || next > last) {
        if (focused) (document.activeElement as HTMLElement | null)?.blur();
        released.current = true;
        setCursor(null);
        setActive(null);
        setHover(null);
        return;
      }
      e.preventDefault();
      const p = projects[next];
      if (!p) return;
      setCursor(next);
      setActive(p.slug);
      const li = items.current[next];
      li?.querySelector("a")?.focus({ preventScroll: true });
      li?.scrollIntoView({ block: "center", behavior: "instant" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cursor, navigate]);

  return (
    <main id="contenu" tabIndex={-1} className="min-h-screen bg-white text-black">
      {/* l'entree tient tout le premier ecran (choix de Remi) : MIRE en pleine
          largeur, la copie dessous ; en mobile, la ligne du bas reste au-dessus
          de la console. Le lien « N PROJETS » mene a l'index juste dessous. */}
      <section
        data-mire="ENTREE"
        className="flex min-h-[calc(100svh-var(--cell)*6)] flex-col justify-between gap-y-cell px-cell py-cell2 md:min-h-screen"
      >
        <TopBar right={mireText(STUDIO.role)} />

        <div>
          <BlockType ancre="titre" text="MIRE" drive="scan" reserve={0.46} />
          <p className="u-copy mt-cell2 max-w-[46ch]">
            IMAGE DE CALIBRATION — CHAQUE SURFACE EST REDUITE A DEUX VALEURS, NOIR PLEIN OU BLANC
            PLEIN, SUR UNE GRILLE DE BLOCS. LE SITE NE DECORE PAS. IL CALIBRE.
          </p>
        </div>

        <div className="u-mono flex flex-wrap justify-between gap-x-cell">
          <span>{mireText(STUDIO.city)}</span>
          {/* lien interne, pas une entree de navigation : courant seulement une fois sur #index */}
          <Link {...VERS_INDEX} activeOptions={{ includeHash: true }}>
            {projects.length} PROJETS / INDEX CI-DESSOUS
          </Link>
        </div>
      </section>

      {/* INDEX */}
      <section
        ref={index}
        id="index"
        data-mire="INDEX"
        className="on-black relative border-t-[10px] border-black"
      >
        <BlockBackdrop src={hover ? petitOf(hover) : hover} />
        <div
          className="relative"
          style={{ mixBlendMode: "difference", color: "#FFFFFF" }}
          onMouseLeave={() => {
            if (cursor === null) setHover(null);
          }}
          onBlur={(e) => {
            if (e.currentTarget.contains(e.relatedTarget)) return;
            setHover(null);
            if (cursor !== null) {
              setCursor(null);
              setActive(null);
            }
          }}
        >
          <div className="u-mono grid grid-cols-[calc(4ch+16px)_1fr] gap-x-cell px-cell py-cell2">
            <span>IDX</span>
            <h2>PROJETS {periode}</h2>
          </div>
          <ul>
            {projects.map((p, i) => {
              const n = nPlanches(p);
              return (
                <li
                  key={p.slug}
                  ref={(el) => {
                    items.current[i] = el;
                  }}
                >
                  <Link
                    to="/projet/$slug"
                    params={{ slug: p.slug }}
                    onMouseEnter={() => setHover(fondOf(p))}
                    onFocus={() => setHover(fondOf(p))}
                    className="u-mono grid grid-cols-[calc(4ch+16px)_minmax(0,1fr)] items-baseline gap-x-cell px-cell py-cell md:grid-cols-[calc(4ch+16px)_minmax(0,1fr)_6ch_22ch] lg:grid-cols-[calc(4ch+16px)_minmax(0,1fr)_6ch_22ch_12ch] xl:grid-cols-[calc(4ch+16px)_minmax(0,1fr)_6ch_22ch_12ch_auto]"
                  >
                    <span className="whitespace-nowrap">
                      {active === p.slug && (
                        <i
                          aria-hidden="true"
                          className="mr-[6px] inline-block size-[10px] bg-current align-middle"
                        />
                      )}
                      {p.num}
                    </span>
                    <span className="min-w-0">
                      <span className="u-display block text-[13vw] leading-[0.9] tracking-[-0.02em] md:text-[5.5vw]">
                        {p.title}
                      </span>
                      <span className="mt-[3px] block md:hidden">
                        {p.year} / {p.nature}
                      </span>
                    </span>
                    <span className="hidden md:block">{p.year}</span>
                    <span className="hidden md:block">{p.nature}</span>
                    <span className="hidden text-right lg:block">
                      {String(n).padStart(2, "0")} {n > 1 ? "PLANCHES" : "PLANCHE"}
                    </span>
                    {/* vignette toujours visible (choix de Remi) : bande sous le titre en
                        mobile, colonne a droite au bureau, calee en haut pour ne pas
                        deplacer les titres */}
                    <BlockVignette
                      src={petitOf(teteOf(p).src)}
                      threshold={teteOf(p).threshold}
                      cols={12}
                      rows={8}
                      rowsMobile={6}
                      className="col-start-2 mt-cell self-start md:col-span-3 lg:col-span-4 xl:col-span-1 xl:col-start-auto xl:mt-0"
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="h-cell4" />
        </div>
      </section>

      <CalibrationBand height={6} seed={2} className="border-y-[10px] border-black" />

      <Ticker
        items={[
          "SEUIL 0.45",
          "NOIR 000000",
          "BLANC FFFFFF",
          "REPERE FF0000",
          "PAS 16 / 20 PX",
          "AUCUN DEGRADE",
          "AUCUNE OMBRE",
          "TOUCHE [N] — INVERSER LE SIGNAL",
        ]}
      />

      {/* BANC D'ESSAI — trois planches des projets, trois lectures, chacune mene a son projet */}
      <section
        data-mire="BANC D'ESSAI"
        className="border-t-[10px] border-black bg-white px-cell py-cell4"
      >
        <div className="u-mono mb-cell2 flex flex-wrap justify-between gap-x-cell">
          <h2>BANC D&apos;ESSAI</h2>
          <span>
            TROIS PLANCHES / TROIS LECTURES
            <span className="hidden md:inline"> / LE DEFILEMENT COMPOSE</span>
          </span>
        </div>
        <div className="grid gap-x-cell gap-y-cell3 lg:grid-cols-[repeat(3,round(down,calc((100%-var(--cell)*2)/3),var(--cell)))]">
          {BANC.map((d) => {
            const titre = mireText(d.projet.title);
            return (
              // colonne : les liens VOIR s'alignent au pied des cartouches, de hauteurs inegales
              <div key={d.mode} className="flex min-w-0 flex-col">
                <HybridMedia
                  src={d.src}
                  blocSrc={petitOf(d.src)}
                  netSrc={netOf(d.src)}
                  alt={d.alt}
                  label={`LECTURE ${d.mode.toUpperCase()} — ${titre}`}
                  ratio={1}
                  mode={d.mode}
                  threshold={d.threshold ?? 0.45}
                  gamma={d.gamma ?? 0.85}
                  drive="scroll"
                  net
                />
                <div className="mt-auto pt-cell">
                  {/* Bloc polymorphe : il ne connait pas les routes, le chemin s'ecrit en clair */}
                  <Bloc as={Link} to={`/projet/${d.projet.slug}`} className={BLOC_SOUPLE}>
                    VOIR {titre}
                  </Bloc>
                </div>
              </div>
            );
          })}
        </div>
        <p className="u-copy mt-cell2 max-w-[54ch]">
          PAR DEFAUT, LES PHOTOS ET VIDEOS NE SONT PAS COLLEES SUR LA MIRE : ELLES SONT
          ECHANTILLONNEES DANS SA GRILLE. UN&nbsp;BLOC&nbsp;=&nbsp;UN&nbsp;PIXEL. EN BLOCS, LE
          SURVOL, OU L&apos;APPUI LONG, OUVRE UNE LOUPE DE MATIERE BRUTE.
          NET&nbsp;=&nbsp;IMAGE&nbsp;NETTE&nbsp;: L&apos;OEUVRE ENTIERE, DANS SES COULEURS.
        </p>
        <Bloc as={Link} to="/atelier" className={`mt-cell2 ${BLOC_SOUPLE}`}>
          CALIBREZ VOTRE IMAGE DANS L&apos;ATELIER
        </Bloc>
      </section>

      {/* PROCEDE — trois planches de mesure */}

      <section
        data-mire="PROCEDE"
        className="border-t-[10px] border-black bg-white px-cell py-cell4"
      >
        <div className="u-mono mb-cell2 flex justify-between">
          <h2>PROCEDE</h2>
          <span>PLANCHES 01 — 03</span>
        </div>
        <div className="grid grid-cols-1 gap-cell md:grid-cols-3">
          {[
            { n: "01", t: "SEUIL", d: "DEUX VALEURS. RIEN ENTRE LES DEUX." },
            { n: "02", t: "PAS", d: "UN BLOC. AUCUN DEMI-BLOC." },
            { n: "03", t: "CHUTE", d: "LE SEUL MOUVEMENT AUTORISE." },
          ].map((c) => (
            <article key={c.n} className="border-[3px] border-black">
              <CalibrationBand height={7} seed={Number(c.n) * 5} />
              <div className="u-mono border-t-[3px] border-black p-cell">
                <div className="flex justify-between">
                  <span>{c.n}</span>
                  <span>{c.t}</span>
                </div>
                <p className="u-copy mt-cell">{c.d}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ATELIER — bloc noir plein */}
      <section
        data-mire="MANIFESTE"
        className="on-black border-t-[10px] border-black bg-black px-cell py-cell6 text-white"
      >
        <h2 className="u-display text-[13vw] leading-[0.95] md:text-[7vw]">
          LE SITE NE
          <br />
          DECORE PAS.
          <br />
          IL CALIBRE.
        </h2>
        <div className="u-mono mt-cell4 grid gap-y-cell2 md:grid-cols-3 md:gap-x-cell">
          <p className="u-copy max-w-[34ch]">
            {mireText(`${STUDIO.role} depuis ${STUDIO.founded}. ${STUDIO.domaines.join(", ")}.`)}
          </p>
          <p className="u-copy max-w-[34ch]">
            CHAQUE PROJET COMMENCE PAR UNE MESURE : PAS DE GRILLE, TAUX D&apos;ENCRAGE, DISTANCE DE
            LECTURE.
          </p>
          <p className="u-copy max-w-[34ch]">
            AUCUNE IMAGE N&apos;EST RETOUCHEE. ELLE EST SEUILLEE.
          </p>
        </div>
      </section>

      <Colophon />
    </main>
  );
}

export function Colophon() {
  return (
    <footer className="border-t-[10px] border-black bg-white px-cell py-cell2 text-black">
      <div className="u-mono grid gap-y-cell md:grid-cols-2 md:gap-x-cell lg:grid-cols-4 [&>div]:min-w-0 [&>div]:break-words">
        <div>
          <h2>FICHE DE CALIBRATION</h2>
          <div>MIRE — {mireText(STUDIO.role)}</div>
        </div>
        <div>
          <Link to="/contact">CONTACT</Link>
          <div>{mireText(STUDIO.email)}</div>
          <div>{mireText(STUDIO.phone)}</div>
        </div>
        <div>
          <div>PROCEDE</div>
          <div>SEUIL BINAIRE 1-BIT</div>
          <div>PAS DE GRILLE 16 / 20 PX</div>
        </div>
        <div>
          <div>ENCRES</div>
          <div>NOIR 000000 / BLANC FFFFFF</div>
          <div>REPERE ROUGE FF0000</div>
        </div>
      </div>
      <div className="u-mono mt-cell4 flex flex-wrap items-center justify-between gap-cell">
        <span>2026</span>
        <BitmapClock label="HEURE LOCALE" />
        <Link to="/atelier">ATELIER / BANC</Link>
        <Link to="/contact">CONTACT</Link>
        <Link to="/contact" hash="mentions">
          MENTIONS LEGALES
        </Link>
        <span>FIN DE MIRE</span>
      </div>
    </footer>
  );
}
