import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { BlockBackdrop, BlockType } from "@/components/mire";
import { projects } from "@/lib/projects";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MIRE — Studio de design graphique" },
      {
        name: "description",
        content:
          "MIRE, studio de design graphique. Identite, edition, signaletique. Un site construit comme une image de calibration : 1-bit, grille de blocs, une seule ligne rouge.",
      },
      { property: "og:title", content: "MIRE — Studio de design graphique" },
      {
        property: "og:description",
        content:
          "Identite, edition, signaletique. Rendu 1-bit par blocs, dissolution par chute de blocs.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const [hover, setHover] = useState<string | null>(null);

  return (
    <main className="min-h-screen bg-white text-black">
      {/* ENTREE */}
      <section className="flex min-h-screen flex-col justify-between px-cell py-cell2">
        <div className="u-mono flex justify-between">
          <span>MIRE</span>
          <span>STUDIO DE DESIGN GRAPHIQUE</span>
        </div>

        <div>
          <BlockType text="MIRE" />
          <p className="u-mono mt-cell2 max-w-[52ch]">
            IMAGE DE CALIBRATION — CHAQUE SURFACE EST REDUITE A DEUX VALEURS,
            NOIR PLEIN OU BLANC PLEIN, SUR UNE GRILLE DE BLOCS. LE SITE NE
            DECORE PAS. IL CALIBRE.
          </p>
        </div>

        <div className="u-mono flex justify-between">
          <span>PARIS</span>
          <span>{projects.length} PROJETS / INDEX CI-DESSOUS</span>
        </div>
      </section>

      {/* INDEX */}
      <section className="relative border-t-[10px] border-black">
        <BlockBackdrop src={hover} />
        <div
          className="relative"
          style={{ mixBlendMode: "difference", color: "#FFFFFF" }}
          onMouseLeave={() => setHover(null)}
        >
          <div className="u-mono grid grid-cols-[4ch_1fr] gap-x-cell px-cell py-cell2">
            <span>IDX</span>
            <span>PROJETS 2022 — 2024</span>
          </div>
          <ul>
            {projects.map((p) => (
              <li key={p.slug}>
                <Link
                  to="/projet/$slug"
                  params={{ slug: p.slug }}
                  onMouseEnter={() => setHover(p.image)}
                  onFocus={() => setHover(p.image)}
                  className="u-mono grid grid-cols-[4ch_1fr] items-baseline gap-x-cell px-cell py-cell md:grid-cols-[4ch_1fr_8ch_24ch]"
                >
                  <span>{p.num}</span>
                  <span className="u-display text-[8vw] leading-[0.9] tracking-[-0.02em] md:text-[3.2vw]">
                    {p.title}
                  </span>
                  <span className="hidden md:block">{p.year}</span>
                  <span className="hidden md:block">{p.nature}</span>
                </Link>
              </li>
            ))}
          </ul>
          <div className="h-cell4" />
        </div>
      </section>

      <Colophon />
    </main>
  );
}

export function Colophon() {
  return (
    <footer className="border-t-[10px] border-black bg-white px-cell py-cell2 text-black">
      <div className="u-mono grid gap-y-cell md:grid-cols-4">
        <div>
          <div>FICHE DE CALIBRATION</div>
          <div>MIRE — STUDIO</div>
        </div>
        <div>
          <div>CONTACT</div>
          <div>STUDIO@MIRE.FR</div>
          <div>+33 1 00 00 00 00</div>
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
      <div className="u-mono mt-cell4 flex justify-between">
        <span>2026</span>
        <span>FIN DE MIRE</span>
      </div>
    </footer>
  );
}
