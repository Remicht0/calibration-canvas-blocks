// MIRE — petites versions des images de projet, pour les lectures en blocs.
//
//   bun run petit
//
// Une planche en blocs n'a jamais plus de quelques dizaines de cellules de
// large (172 en plein cadre sur un ecran de 3 440 px) : la source de 1 600 px
// etait decodee pour rien. Chaque JPG de src/assets/ est reduit a 640 px de
// cote long (moyenne de boite, meme principe que la reduction des cartes de
// partage) dans src/assets/petit/, sous le meme nom. La source de 1 600 px
// reste celle de NET et des cartes de partage. Relancer a chaque ajout ou
// changement d'image de projet, et commiter les fichiers.

import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { decode, encode } from "jpeg-js";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCES = join(RACINE, "src", "assets");
const SORTIE = join(SOURCES, "petit");
const COTE = 640;
const QUALITE = 85;

mkdirSync(SORTIE, { recursive: true });

/** Reduction par moyenne de boite : chaque pixel de sortie moyenne la zone qu'il couvre. */
function reduire(src: Uint8Array, w: number, h: number, ow: number, oh: number) {
  const out = new Uint8Array(ow * oh * 4);
  for (let y = 0; y < oh; y++) {
    const y0 = Math.floor((y * h) / oh);
    const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * h) / oh));
    for (let x = 0; x < ow; x++) {
      const x0 = Math.floor((x * w) / ow);
      const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * w) / ow));
      let r = 0;
      let g = 0;
      let b = 0;
      let n = 0;
      for (let yy = y0; yy < y1; yy++)
        for (let xx = x0; xx < x1; xx++) {
          const i = (yy * w + xx) * 4;
          r += src[i]!;
          g += src[i + 1]!;
          b += src[i + 2]!;
          n++;
        }
      const o = (y * ow + x) * 4;
      out[o] = r / n;
      out[o + 1] = g / n;
      out[o + 2] = b / n;
      out[o + 3] = 255;
    }
  }
  return out;
}

let avant = 0;
let apres = 0;
for (const f of readdirSync(SOURCES)
  .filter((f) => /\.jpe?g$/i.test(f))
  .sort()) {
  const chemin = join(SOURCES, f);
  const { width: w, height: h, data } = decode(readFileSync(chemin), { useTArray: true });
  const k = Math.min(1, COTE / Math.max(w, h));
  const ow = Math.max(1, Math.round(w * k));
  const oh = Math.max(1, Math.round(h * k));
  const px = k < 1 ? reduire(data, w, h, ow, oh) : data;
  const jpg = encode({ width: ow, height: oh, data: px }, QUALITE).data;
  writeFileSync(join(SORTIE, f), jpg);
  avant += statSync(chemin).size;
  apres += jpg.length;
  console.log(`${f.padEnd(36)} ${w}x${h} -> ${ow}x${oh}  ${(jpg.length / 1024).toFixed(0)} Ko`);
}
console.log(
  `total : ${(avant / 1024).toFixed(0)} Ko -> ${(apres / 1024).toFixed(0)} Ko (${Math.round((1 - apres / avant) * 100)} % de moins)`,
);
