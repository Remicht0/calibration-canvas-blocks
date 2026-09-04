import { createFileRoute, Link } from "@tanstack/react-router";
import { BitmapBoard, BitmapClock, NoiseField } from "@/components/bitmap-extras";
import { CalibrationBand, Ticker } from "@/components/bars";
import { BlockType } from "@/components/mire";
import { Colophon } from "./index";

export const Route = createFileRoute("/atelier")({
  head: () => ({
    meta: [
      { title: "Atelier — MIRE, banc de calibration" },
      {
        name: "description",
        content:
          "L'atelier de MIRE : horloge 1-bit, table de composition en blocs, planche de bruit. Le protocole de calibration du studio, manipulable directement.",
      },
      { property: "og:title", content: "Atelier — MIRE, banc de calibration" },
      {
        property: "og:description",
        content:
          "Horloge en blocs, automate cellulaire, planche de bruit : les outils du studio MIRE en libre manipulation.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Atelier,
});

function Atelier() {
  return (
    <main id="contenu" tabIndex={-1} className="min-h-screen bg-white text-black">
      <div className="u-mono grid gap-cell px-cell py-cell2 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
        <Link to="/">RETOUR / INDEX</Link>
        <div className="min-w-0 sm:justify-self-end">
          <BitmapClock label="ATELIER" />
        </div>
      </div>

      <section data-mire="EN-TETE" className="px-cell pb-cell4">
        <BlockType text="ATELIER" loop={false} />
        <p className="u-copy mt-cell2 max-w-[56ch]">
          TROIS INSTRUMENTS. AUCUNE DECORATION. CHACUN NE SAIT FAIRE QU&apos;UNE CHOSE : POSER UN
          BLOC, OU NE PAS LE POSER.
        </p>
      </section>

      <CalibrationBand height={5} seed={11} className="border-y-[10px] border-black" />

      {/* INSTRUMENT 01 — table de composition */}
      <section data-mire="AUTOMATE" className="bg-white px-cell py-cell4">
        <div className="u-mono mb-cell2 flex justify-between">
          <h2>INSTRUMENT 01 — TABLE DE COMPOSITION</h2>
          <span className="hidden md:inline">DESSINER PUIS PROPAGER</span>
        </div>
        <BitmapBoard rows={14} />
        <p className="u-copy mt-cell2 max-w-[56ch]">
          UN BLOC POSE A LA MAIN SURVIT S&apos;IL A DEUX OU TROIS VOISINS. IL NAIT S&apos;IL EN A
          EXACTEMENT TROIS. LA SURFACE EST UN TORE : LE BORD DROIT TOUCHE LE BORD GAUCHE.
        </p>
      </section>

      {/* INSTRUMENT 02 — planche de bruit */}
      <section
        data-mire="BRUIT"
        className="border-t-[10px] border-black bg-black px-cell py-cell4 text-white"
      >
        <div className="u-mono mb-cell2 flex justify-between">
          <h2>INSTRUMENT 02 — PLANCHE DE BRUIT</h2>
          <span className="hidden md:inline">CENTRE ECRAN = SIGNAL NET</span>
        </div>
        <div className="border-[3px] border-white">
          <NoiseField rows={10} seed={3} />
        </div>
        <p className="u-copy mt-cell2 max-w-[56ch]">
          LE BRUIT SE RESORBE A MESURE QUE LA PLANCHE ATTEINT LE CENTRE DU CADRE. C&apos;EST LE
          REGLAGE, PAS UN EFFET.
        </p>
      </section>

      <Ticker
        items={[
          "AUTOMATE 23/3",
          "HORLOGE 3x5",
          "BRUIT DETERMINISTE",
          "PAS 16 / 20 PX",
          "TOUCHE [N] — INVERSER LE SIGNAL",
          "AUCUN DEGRADE",
        ]}
      />

      {/* INSTRUMENT 03 — horloge */}
      <section
        data-mire="HORLOGE"
        className="border-t-[10px] border-black bg-white px-cell py-cell4"
      >
        <div className="u-mono mb-cell2 flex justify-between">
          <h2>INSTRUMENT 03 — HORLOGE</h2>
          <span className="hidden md:inline">FONTE INTERNE 3 x 5 BLOCS</span>
        </div>
        <div className="border-[3px] border-black p-cell2">
          <BitmapClock label="HEURE ATELIER" scale={2.2} />
        </div>
      </section>

      <section data-mire="NOTES" className="border-t-[10px] border-black bg-white px-cell py-cell4">
        <h2 className="u-display text-[12vw] leading-[0.95] md:text-[6vw]">
          UN BLOC
          <br />
          OU RIEN.
        </h2>
        <div className="u-mono mt-cell2">
          <Link to="/">INDEX DES PROJETS</Link>
          <Link to="/contact" className="ml-cell2">
            CONTACT
          </Link>
        </div>
      </section>

      <Colophon />
    </main>
  );
}
