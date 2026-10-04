/**
 * Outillage commun des suites : ou se trouve le site, ou se trouve le
 * navigateur, et le petit journal d'assertions qui remplace un cadre de test.
 *
 * On reste sur `node:test` + `node:assert` : chaque fichier de suite est un
 * scenario long, sequentiel, qui pilote un navigateur — un cadre plus riche
 * n'apporterait ici qu'une dependance de plus.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const RACINE = fileURLToPath(new URL("..", import.meta.url));
/** Pieces fabriquees a la volee (bobine y4m, photo de 48 Mpx). */
export const ATELIER = path.join(RACINE, "tests", ".fixtures");
/** Captures d'ecran laissees derriere pour inspection. */
export const CAPTURES = path.join(RACINE, "tests", ".captures");

export const PORT = Number(process.env["MIRE_PORT"] ?? 4288);
export const BASE = process.env["MIRE_BASE"] ?? `http://127.0.0.1:${PORT}`;
export const CHROMIUM = process.env["MIRE_CHROMIUM"] ?? "/opt/pw-browsers/chromium";

export const Y4M = path.join(ATELIER, "mire.y4m");
export const GRANDE_PHOTO = path.join(ATELIER, "grande-photo.png");
export const DAMIER = path.join(ATELIER, "damier.png");
export const photo = (nom) => path.join(RACINE, "src", "assets", nom);

/** Arguments Chromium : une camera factice alimentee par la bobine y4m. */
export const CAMERA_FACTICE = [
  "--no-sandbox",
  "--use-fake-device-for-media-stream",
  "--use-fake-ui-for-media-stream",
  `--use-file-for-fake-video-capture=${Y4M}`,
];

/** Camera factice sans bobine : la mire verte tournante de Chromium. */
export const CAMERA_MIRE = [
  "--no-sandbox",
  "--use-fake-device-for-media-stream",
  "--use-fake-ui-for-media-stream",
];

export const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

export function capture(nom) {
  fs.mkdirSync(CAPTURES, { recursive: true });
  return path.join(CAPTURES, nom);
}

/* ------------------------------------------------------------------ */
/* Journal d'assertions                                               */
/* ------------------------------------------------------------------ */

let total = 0;
let echecs = [];

/**
 * Note une verification sans interrompre le scenario : un echec en milieu de
 * parcours ne doit pas priver du reste des constats. `conclure()` tranche.
 */
export function verifie(nom, condition, info = "") {
  total += 1;
  const ligne = `${condition ? "OK   " : "ECHEC"} ${nom}${info ? " — " + info : ""}`;
  console.log("    " + ligne);
  if (!condition) echecs.push(ligne);
}

/** Fait echouer le test en cours si des verifications ont echoue depuis la derniere fois. */
export function conclure() {
  const pile = echecs;
  echecs = [];
  assert.equal(pile.length, 0, "\n" + pile.join("\n"));
}

const compteur = path.join(ATELIER, "compteurs");
process.on("exit", () => {
  if (total === 0) return;
  try {
    fs.mkdirSync(compteur, { recursive: true });
    const nom = path.basename(process.argv[1] ?? "suite").replace(/\.test\.mjs$/, "");
    fs.writeFileSync(path.join(compteur, nom + ".json"), JSON.stringify({ nom, total }));
  } catch {
    /* le compte est un agrement, jamais une raison d'echouer */
  }
});

/* ------------------------------------------------------------------ */
/* Aides de page                                                      */
/* ------------------------------------------------------------------ */

/** Ouvre une page en gardant trace des erreurs de console. */
export async function nouvellePage(ctx) {
  const page = await ctx.newPage();
  page.setDefaultTimeout(20000);
  const erreurs = [];
  page.on("console", (m) => {
    if (m.type() === "error") erreurs.push(m.text());
  });
  page.on("pageerror", (e) => erreurs.push("pageerror: " + e.message));
  page.erreurs = erreurs;
  return page;
}

export const miroir = (page) => page.locator('section[data-mire="MIROIR"]');

/** Va sur l'atelier, laisse passer la sequence d'entree, amene le miroir a l'ecran. */
export async function allerAuMiroir(page, route = "/atelier") {
  await page.goto(BASE + route, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2600);
  await miroir(page).scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
}

/** Espionne getUserMedia : les pistes restent lisibles apres que React a lache sa reference. */
export const ESPION = `
window.__flux = [];
window.__contraintes = [];
if (navigator.mediaDevices) {
  const orig = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  navigator.mediaDevices.getUserMedia = async (c) => {
    window.__contraintes.push(JSON.stringify(c));
    if (window.__delai) await new Promise((r) => setTimeout(r, window.__delai));
    const s = await orig(c);
    window.__flux.push(s);
    return s;
  };
}
window.__delai = 0;
window.__etats = () => window.__flux.flatMap((s) => s.getTracks().map((t) => t.readyState));
`;

/** Compte les trames de video reellement peintes dans un canvas. */
export const COMPTE_TRAMES = `
window.__draws = 0;
const od = CanvasRenderingContext2D.prototype.drawImage;
CanvasRenderingContext2D.prototype.drawImage = function (src, ...rest) {
  if (src instanceof HTMLVideoElement) window.__draws++;
  return od.call(this, src, ...rest);
};
`;

export const etats = (page) => page.evaluate(() => window.__etats());
export const trames = (page) => page.evaluate(() => window.__draws);
