import { createFileRoute, Link } from "@tanstack/react-router";
import { CalibrationBand, Ticker } from "@/components/bars";
import { BlockType } from "@/components/mire";
import { BitmapClock } from "@/components/bitmap-extras";
import { TopBar } from "@/components/chrome";
import { Colophon } from "./index";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact — MIRE, studio de design graphique" },
      {
        name: "description",
        content:
          "Contacter le studio MIRE : adresse, téléphone, courriel et fiche de calibration. Identité, édition, signalétique.",
      },
      { property: "og:title", content: "Contact — MIRE, studio de design graphique" },
      {
        property: "og:description",
        content: "Fiche de calibration du studio MIRE : courriel, téléphone, adresse, mentions.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Contact,
});

const FICHE = [
  { k: "COURRIEL", v: "STUDIO@MIRE.FR" },
  { k: "TELEPHONE", v: "+33 1 00 00 00 00" },
  { k: "ADRESSE", v: "12 RUE DE LA MIRE, 75011 PARIS" },
  { k: "HORAIRES", v: "LUNDI — VENDREDI / 09H — 19H" },
  { k: "SIRET", v: "000 000 000 00000" },
  { k: "DELAI DE REPONSE", v: "48 HEURES OUVREES" },
];

function Contact() {
  return (
    <main id="contenu" tabIndex={-1} className="min-h-screen bg-white text-black">
      <TopBar className="px-cell py-cell2" right="FICHE 00" />

      <section data-mire="EN-TETE" className="px-cell pb-cell4">
        <BlockType text="CONTACT" loop={false} />
        <p className="u-copy mt-cell2 max-w-[52ch]">
          UN PROJET SE MESURE AVANT DE SE DESSINER. ECRIRE AVEC : NATURE, CALENDRIER, BUDGET,
          SUPPORTS. REPONSE SOUS 48 HEURES.
        </p>
      </section>

      <CalibrationBand height={5} seed={17} className="border-y-[10px] border-black" />

      <section data-mire="COORDONNEES" className="bg-black px-cell py-cell4 text-white">
        <div className="u-mono mb-cell2 flex flex-wrap justify-between gap-cell">
          <h2>FICHE DE CALIBRATION</h2>
          <BitmapClock label="HEURE STUDIO" />
        </div>
        <dl className="u-mono grid gap-y-cell2 md:grid-cols-2 md:gap-x-cell">
          {FICHE.map((f) => (
            <div key={f.k} className="border-t-[3px] border-white pt-cell">
              <dt>{f.k}</dt>
              <dd className="mt-[3px]">{f.v}</dd>
            </div>
          ))}
        </dl>
        <div className="u-mono mt-cell4 flex flex-wrap gap-cell2">
          <a href="mailto:studio@mire.fr" className="border-[3px] border-white px-cell py-[3px]">
            ECRIRE AU STUDIO
          </a>
          <a href="tel:+33100000000" className="border-[3px] border-white px-cell py-[3px]">
            APPELER
          </a>
        </div>
      </section>

      <Ticker
        items={[
          "IDENTITE",
          "EDITION",
          "SIGNALETIQUE",
          "HABILLAGE D'ANTENNE",
          "DIRECTION ARTISTIQUE",
          "REPONSE 48 H",
        ]}
      />

      <section data-mire="CALIBRATION" className="border-t-[10px] border-black px-cell py-cell4">
        <h2 className="u-display text-[13vw] leading-[0.95] md:text-[7vw]">
          ENVOYEZ
          <br />
          UNE MESURE.
        </h2>
        <div className="u-mono mt-cell2 flex flex-wrap gap-cell2">
          <Link to="/atelier" className="border-[3px] border-black px-cell py-[3px]">
            ATELIER
          </Link>
          <Link to="/" className="border-[3px] border-black px-cell py-[3px]">
            INDEX DES PROJETS
          </Link>
        </div>
      </section>

      <Colophon />
    </main>
  );
}
