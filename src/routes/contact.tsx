import { createFileRoute, Link } from "@tanstack/react-router";
import { CalibrationBand, Ticker } from "@/components/bars";
import { BlockType } from "@/components/mire";
import { BitmapClock } from "@/components/bitmap-extras";
import { TopBar } from "@/components/chrome";
import { Bloc } from "@/components/bloc";
import { Colophon } from "./index";
import { mireText } from "@/lib/glyphs";
import { adresse, mailtoHref, STUDIO, telHref } from "@/lib/site";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact — MIRE, graphiste indépendant" },
      {
        name: "description",
        content:
          "Contacter MIRE, graphiste indépendant à Bordeaux : courriel, téléphone, adresse. Identité visuelle et édition.",
      },
      { property: "og:title", content: "Contact — MIRE, graphiste indépendant" },
      {
        property: "og:description",
        content: "Fiche de calibration de MIRE : courriel, téléphone, adresse, horaires.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Contact,
});

const FICHE = [
  { k: "COURRIEL", v: mireText(STUDIO.email) },
  { k: "TELEPHONE", v: mireText(STUDIO.phone) },
  { k: "ADRESSE", v: mireText(adresse) },
  { k: "HORAIRES", v: "LUNDI — VENDREDI / 09H — 19H" },
  ...(STUDIO.siret ? [{ k: "SIRET", v: mireText(STUDIO.siret) }] : []),
  { k: "DELAI DE REPONSE", v: "48 HEURES OUVREES" },
];

function Contact() {
  return (
    <main id="contenu" tabIndex={-1} className="min-h-screen bg-white text-black">
      <TopBar className="px-cell py-cell2" right="FICHE 00" />

      <section data-mire="EN-TETE" className="px-cell pb-cell4">
        <BlockType text="CONTACT" loop={false} drive="scan" />
        <p className="u-copy mt-cell2 max-w-[52ch]">
          UN PROJET SE MESURE AVANT DE SE DESSINER. ECRIRE AVEC : NATURE, CALENDRIER, BUDGET,
          SUPPORTS. REPONSE SOUS 48 HEURES.
        </p>
      </section>

      <CalibrationBand height={5} seed={17} className="border-y-[10px] border-black" />

      <section data-mire="COORDONNEES" className="on-black bg-black px-cell py-cell4 text-white">
        <div className="u-mono mb-cell2 flex flex-wrap justify-between gap-cell">
          <h2>FICHE DE CALIBRATION</h2>
          <BitmapClock label={`HEURE ${mireText(STUDIO.city)}`} timeZone={STUDIO.timeZone} />
        </div>
        <dl className="u-mono grid gap-y-cell2 md:grid-cols-2 md:gap-x-cell">
          {FICHE.map((f, i) => (
            <div
              key={f.k}
              className={
                FICHE.length % 2 && i === FICHE.length - 1
                  ? "border-t-[3px] border-white pt-cell md:col-span-2"
                  : "border-t-[3px] border-white pt-cell"
              }
            >
              <dt>{f.k}</dt>
              <dd className="mt-[3px]">{f.v}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-cell4 flex flex-wrap gap-cell2">
          <Bloc as="a" href={mailtoHref}>
            ECRIRE
          </Bloc>
          <Bloc as="a" href={telHref}>
            APPELER
          </Bloc>
        </div>
      </section>

      <Ticker
        items={[
          mireText(STUDIO.role),
          mireText(STUDIO.city),
          ...STUDIO.domaines.map(mireText),
          "REPONSE 48 H",
        ]}
      />

      <section data-mire="CALIBRATION" className="border-t-[10px] border-black px-cell py-cell4">
        <h2 className="u-display text-[13vw] leading-[0.95] md:text-[7vw]">
          ENVOYEZ
          <br />
          UNE MESURE.
        </h2>
        <div className="mt-cell2 flex flex-wrap gap-cell2">
          <Bloc as={Link} to="/atelier">
            ATELIER
          </Bloc>
          <Bloc as={Link} to="/">
            INDEX DES PROJETS
          </Bloc>
        </div>
      </section>

      <Colophon />
    </main>
  );
}
