import { createFileRoute, Link } from "@tanstack/react-router";
import { CalibrationBand, Ticker } from "@/components/bars";
import { BlockType } from "@/components/mire";
import { TopBar, VERS_INDEX } from "@/components/chrome";
import { Bloc } from "@/components/bloc";
import { Releve } from "@/components/releve";
import { Colophon } from "./index";
import { mireText } from "@/lib/glyphs";
import { PROPOS } from "@/lib/propos";
import { metier, siteOrigin, STUDIO } from "@/lib/site";

const TITRE = `À propos — ${STUDIO.name}, ${metier} à ${STUDIO.city}`;

export const Route = createFileRoute("/a-propos")({
  loader: () => ({ origin: siteOrigin() }),
  head: ({ loaderData }) => ({
    meta: [
      { title: TITRE },
      { name: "description", content: PROPOS.description },
      { property: "og:title", content: TITRE },
      { property: "og:description", content: PROPOS.description },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary_large_image" },
      // la personne derriere la signature : nom, signature, metier, ville
      ...(loaderData
        ? [
            {
              "script:ld+json": {
                "@context": "https://schema.org",
                "@type": "ProfilePage",
                url: `${loaderData.origin}/a-propos`,
                mainEntity: {
                  "@type": "Person",
                  name: STUDIO.legalName,
                  alternateName: STUDIO.name,
                  jobTitle: STUDIO.role,
                  knowsAbout: STUDIO.domaines,
                  workLocation: { "@type": "Place", name: STUDIO.city },
                  url: loaderData.origin,
                },
              },
            },
          ]
        : []),
    ],
  }),
  component: APropos,
});

function APropos() {
  return (
    <main id="contenu" tabIndex={-1} className="min-h-screen bg-white text-black">
      <TopBar className="px-cell py-cell2" right="FICHE 01" />

      <section data-mire="EN-TETE" className="px-cell pb-cell4">
        <BlockType ancre="titre" text="A PROPOS" label="À propos" loop={false} drive="scan" />
        <p className="u-copy mt-cell2 max-w-[46ch]">{mireText(PROPOS.intro)}</p>
      </section>

      <CalibrationBand height={5} seed={23} className="border-y-[10px] border-black" />

      <section data-mire="RELEVE" className="on-black bg-black px-cell py-cell4 text-white">
        <h2 className="u-mono mb-cell2">RELEVE</h2>
        <Releve
          lignes={PROPOS.releve.map((l) => ({ k: mireText(l.k), v: mireText(l.v) }))}
          filet="blanc"
        />
      </section>

      <section data-mire="PARCOURS" className="px-cell py-cell4">
        <h2 className="u-mono mb-cell2">PARCOURS</h2>
        <Paragraphes textes={PROPOS.paragraphes.slice(0, 2)} />
      </section>

      <Ticker items={PROPOS.releve.map((l) => mireText(l.v))} />

      <section data-mire="SIGNATURE" className="px-cell py-cell4">
        <h2 className="u-display text-[13vw] leading-[0.95] md:text-[7vw]">
          {PROPOS.accroche.map((ligne, i) => (
            <span key={ligne} className="block">
              {mireText(ligne)}
              {i < PROPOS.accroche.length - 1 && " "}
            </span>
          ))}
        </h2>
        <div className="mt-cell4">
          <Paragraphes textes={PROPOS.paragraphes.slice(2)} />
        </div>
        <div className="mt-cell4 flex flex-wrap gap-cell2">
          <Bloc as={Link} {...VERS_INDEX}>
            INDEX DES PROJETS
          </Bloc>
          <Bloc as={Link} to="/contact">
            CONTACT
          </Bloc>
        </div>
      </section>

      <Colophon />
    </main>
  );
}

/** Paragraphes courants : une colonne, deux a partir de 768 px. */
function Paragraphes({ textes }: { textes: string[] }) {
  return (
    <div className="grid gap-y-cell2 md:grid-cols-2 md:gap-x-cell">
      {textes.map((p) => (
        <p key={p} className="u-copy max-w-[46ch]">
          {mireText(p)}
        </p>
      ))}
    </div>
  );
}
