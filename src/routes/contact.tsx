import { createFileRoute, Link } from "@tanstack/react-router";
import { CalibrationBand, Ticker } from "@/components/bars";
import { BlockType } from "@/components/mire";
import { BitmapClock } from "@/components/bitmap-extras";
import { TopBar } from "@/components/chrome";
import { Bloc } from "@/components/bloc";
import { Colophon } from "./index";
import { mireText } from "@/lib/glyphs";
import {
  adresse,
  domainesPhrase,
  mailtoHref,
  metier,
  presentation,
  STUDIO,
  telHref,
} from "@/lib/site";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: `Contact — ${STUDIO.name}, ${metier} à ${STUDIO.city}` },
      {
        name: "description",
        content: `Contacter ${presentation} : courriel, téléphone, adresse. ${domainesPhrase}.`,
      },
      { property: "og:title", content: `Contact — ${STUDIO.name}, ${metier} à ${STUDIO.city}` },
      {
        property: "og:description",
        content: `Fiche de calibration de ${STUDIO.name} : courriel, téléphone, adresse, horaires, mentions légales.`,
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Contact,
});

type Ligne = { k: string; v: string };

const FICHE: Ligne[] = [
  { k: "COURRIEL", v: mireText(STUDIO.email) },
  { k: "TELEPHONE", v: mireText(STUDIO.phone) },
  { k: "ADRESSE", v: mireText(adresse) },
  { k: "HORAIRES", v: "LUNDI — VENDREDI / 09H — 19H" },
  ...(STUDIO.siret ? [{ k: "SIRET", v: mireText(STUDIO.siret) }] : []),
  { k: "DELAI DE REPONSE", v: mireText(STUDIO.delaiReponse) },
];

/* Identification de l'editeur et de l'hebergeur (loi pour la confiance dans l'economie
   numerique, art. 6) : les lignes facultatives n'apparaissent que renseignees. */
const MENTIONS: Ligne[] = [
  { k: "EDITEUR", v: mireText(`${STUDIO.legalName}, ${metier}, sous le nom ${STUDIO.name}`) },
  { k: "ADRESSE", v: mireText(adresse) },
  { k: "CONTACT", v: `${mireText(STUDIO.email)} / ${mireText(STUDIO.phone)}` },
  { k: "DIRECTEUR DE LA PUBLICATION", v: mireText(STUDIO.legalName) },
  ...(STUDIO.siret ? [{ k: "SIRET", v: mireText(STUDIO.siret) }] : []),
  ...(STUDIO.hebergeur
    ? [
        {
          k: "HEBERGEUR",
          v: mireText(
            `${STUDIO.hebergeur.nom}, ${STUDIO.hebergeur.adresse}, ${STUDIO.hebergeur.telephone}`,
          ),
        },
      ]
    : []),
];

/** Releve en deux colonnes ; un nombre impair de lignes etend la derniere, sans laisser de trou. */
function Releve({ lignes, filet }: { lignes: Ligne[]; filet: "blanc" | "noir" }) {
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

function Contact() {
  return (
    <main id="contenu" tabIndex={-1} className="min-h-screen bg-white text-black">
      <TopBar className="px-cell py-cell2" right="FICHE 00" />

      <section data-mire="EN-TETE" className="px-cell pb-cell4">
        <BlockType ancre="titre" text="CONTACT" loop={false} drive="scan" />
        <p className="u-copy mt-cell2 max-w-[52ch]">
          UN PROJET SE MESURE AVANT DE SE DESSINER. ECRIRE AVEC : NATURE, CALENDRIER, BUDGET,
          SUPPORTS. REPONSE SOUS {mireText(STUDIO.delaiReponse)}.
        </p>
      </section>

      <CalibrationBand height={5} seed={17} className="border-y-[10px] border-black" />

      <section data-mire="COORDONNEES" className="on-black bg-black px-cell py-cell4 text-white">
        <div className="u-mono mb-cell2 flex flex-wrap justify-between gap-cell">
          <h2>FICHE DE CALIBRATION</h2>
          <BitmapClock label={`HEURE ${mireText(STUDIO.city)}`} timeZone={STUDIO.timeZone} />
        </div>
        <Releve lignes={FICHE} filet="blanc" />
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
          `REPONSE ${mireText(STUDIO.delaiReponse)}`,
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

      <section
        id="mentions"
        data-mire="MENTIONS"
        className="border-t-[10px] border-black px-cell py-cell4"
      >
        <h2 className="u-mono mb-cell2">MENTIONS LEGALES</h2>
        <Releve lignes={MENTIONS} filet="noir" />
      </section>

      <Colophon />
    </main>
  );
}
