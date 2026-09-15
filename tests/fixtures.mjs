/**
 * Fabrique les pieces lourdes dont les suites ont besoin. Rien de tout cela
 * n'entre dans le depot : une photo de 48 Mpx et une bobine video pesent
 * ensemble une quinzaine de megaoctets, on les refait a chaque campagne.
 */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { ATELIER } from "./outils.mjs";

/* --- encodeur PNG minimal (niveaux de gris, 8 bits) --- */

const TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

const crc32 = (buf) => {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

const bloc = (type, data) => {
  const entete = Buffer.alloc(8);
  entete.writeUInt32BE(data.length, 0);
  entete.write(type, 4, "ascii");
  const somme = Buffer.alloc(4);
  somme.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, "ascii"), data])), 0);
  return Buffer.concat([entete, data, somme]);
};

/** Encode une image en niveaux de gris. `peindre(x, y)` rend une valeur 0..255. */
function png(largeur, hauteur, peindre) {
  const brut = Buffer.alloc(hauteur * (1 + largeur));
  for (let y = 0; y < hauteur; y++) {
    const base = y * (1 + largeur);
    brut[base] = 0; // filtre « aucun »
    for (let x = 0; x < largeur; x++) brut[base + 1 + x] = peindre(x, y);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(largeur, 0);
  ihdr.writeUInt32BE(hauteur, 4);
  ihdr[8] = 8; // profondeur
  ihdr[9] = 0; // niveaux de gris
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloc("IHDR", ihdr),
    bloc("IDAT", zlib.deflateSync(brut, { level: 1 })),
    bloc("IEND", Buffer.alloc(0)),
  ]);
}

/* --- les pieces --- */

/** Bobine YUV4MPEG2 : un damier de 80 px traverse par une bande mobile. */
function y4m(fichier) {
  const L = 640;
  const H = 480;
  const IMAGES = 12;
  const parts = [Buffer.from(`YUV4MPEG2 W${L} H${H} F25:1 Ip A1:1 C420mpeg2\n`, "ascii")];
  for (let f = 0; f < IMAGES; f++) {
    const y = Buffer.alloc(L * H, 16);
    for (let j = 0; j < H; j++) {
      for (let i = 0; i < L; i++) {
        const damier = (((i / 80) | 0) + ((j / 80) | 0)) % 2 === 0;
        const bande = Math.abs(i - ((f * 53) % L)) < 24;
        y[j * L + i] = damier || bande ? 235 : 16; // blanc video / noir video
      }
    }
    parts.push(
      Buffer.from("FRAME\n", "ascii"),
      y,
      Buffer.alloc((L / 2) * (H / 2), 128),
      Buffer.alloc((L / 2) * (H / 2), 128),
    );
  }
  fs.writeFileSync(fichier, Buffer.concat(parts));
}

/** Photo de 48 Mpx (8000 x 6000) : damier de 250 px, franchement contraste. */
function grandePhoto(fichier) {
  fs.writeFileSync(
    fichier,
    png(8000, 6000, (x, y) => ((((x / 250) | 0) + ((y / 250) | 0)) & 1 ? 0x10 : 0xf0)),
  );
}

/** Vignette de 64 px pour le presse-papiers. */
function damier(fichier) {
  fs.writeFileSync(
    fichier,
    png(64, 64, (x, y) => ((((x / 8) | 0) + ((y / 8) | 0)) & 1 ? 0x00 : 0xff)),
  );
}

const PIECES = [
  ["mire.y4m", y4m],
  ["grande-photo.png", grandePhoto],
  ["damier.png", damier],
];

/** Fabrique ce qui manque et rend le chemin de chaque piece. */
export function fabriquer() {
  fs.mkdirSync(ATELIER, { recursive: true });
  const faits = {};
  for (const [nom, faire] of PIECES) {
    const cible = path.join(ATELIER, nom);
    if (!fs.existsSync(cible) || fs.statSync(cible).size === 0) {
      /* En deux temps : une campagne interrompue en pleine ecriture laisserait
         sinon une piece tronquee, qui serait reprise telle quelle ensuite. */
      const brouillon = cible + ".part";
      faire(brouillon);
      fs.renameSync(brouillon, cible);
    }
    faits[nom] = cible;
  }
  return faits;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const [nom, chemin] of Object.entries(fabriquer()))
    console.log(nom, (fs.statSync(chemin).size / 1024) | 0, "Ko");
}
