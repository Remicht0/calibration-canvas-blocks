/**
 * Campagne complete : fabrique les pieces, construit le site, le sert, joue
 * les suites, arrete tout — et sort en 0 ou en 1.
 *
 *   bun run test                      tout, de bout en bout
 *   MIRE_PORT=4250 bun run test       sur un autre port
 *   MIRE_BASE=http://... bun run test contre un serveur deja debout
 *   MIRE_SUITES=miroir,clavier        seulement ces suites
 *   MIRE_CHROMIUM=/chemin/chromium    un autre navigateur pilote
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { ATELIER, CAPTURES, PORT, RACINE } from "./outils.mjs";
import { fabriquer } from "./fixtures.mjs";
import { construire, demarrer } from "./serveur.mjs";

const DOSSIER = path.join(RACINE, "tests");
const COMPTEURS = path.join(ATELIER, "compteurs");

const choix = (process.env["MIRE_SUITES"] ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const suites = fs
  .readdirSync(DOSSIER)
  .filter((f) => f.endsWith(".test.mjs"))
  .filter((f) => choix.length === 0 || choix.includes(f.replace(/\.test\.mjs$/, "")))
  .sort()
  .map((f) => path.join(DOSSIER, f));

if (suites.length === 0) {
  console.error("aucune suite a jouer");
  process.exit(1);
}

fs.rmSync(COMPTEURS, { recursive: true, force: true });
fs.rmSync(CAPTURES, { recursive: true, force: true });

console.log("[pieces] fabrication des fixtures");
for (const [nom, chemin] of Object.entries(fabriquer()))
  console.log(`  ${nom} — ${(fs.statSync(chemin).size / 1024).toFixed(1)} Ko`);

const externe = !!process.env["MIRE_BASE"];
const base = process.env["MIRE_BASE"] ?? `http://127.0.0.1:${PORT}`;
let arreter = null;
/** Le processus qui joue les suites : a couper avant le serveur, sinon il
    reste debout avec ses navigateurs quand la campagne est interrompue. */
let suitesEnCours = null;
/** Renseigne si le serveur tombe en pleine campagne : le verdict ne peut plus
    etre vert, quoi que rendent les suites deja jouees. */
let serveurTombe = null;
let code = 1;
const depart = Date.now();

const tomber = async () => {
  if (suitesEnCours && suitesEnCours.exitCode === null) suitesEnCours.kill("SIGTERM");
  suitesEnCours = null;
  if (arreter) await arreter();
  arreter = null;
};
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    void tomber().then(() => process.exit(1));
  });

try {
  if (!externe) {
    await construire();
    arreter = await demarrer(PORT, (raison) => {
      serveurTombe = raison;
      console.error(`\n[serveur] arret inattendu (${raison}) — la campagne est coupee\n`);
      if (suitesEnCours && suitesEnCours.exitCode === null) suitesEnCours.kill("SIGTERM");
    });
  } else {
    console.log(`[serveur] fourni : ${base}`);
  }

  console.log(`\n[suites] ${suites.length} a jouer sur ${base}\n`);
  code = await new Promise((resoudre) => {
    const p = spawn(
      process.execPath,
      ["--test", "--test-concurrency=1", "--test-reporter=spec", ...suites],
      {
        cwd: RACINE,
        env: { ...process.env, MIRE_BASE: base },
        stdio: ["ignore", "inherit", "inherit"],
      },
    );
    suitesEnCours = p;
    p.on("error", () => resoudre(1));
    p.on("exit", (c) => resoudre(c ?? 1));
  });
} catch (e) {
  console.error("\n[campagne] " + e.message);
  code = 1;
} finally {
  await tomber();
}

if (serveurTombe !== null) code = 1;

let assertions = 0;
if (fs.existsSync(COMPTEURS))
  for (const f of fs.readdirSync(COMPTEURS))
    assertions += JSON.parse(fs.readFileSync(path.join(COMPTEURS, f), "utf8")).total;

const duree = ((Date.now() - depart) / 1000).toFixed(1);
console.log(
  `\n=== ${suites.length} suites, ${assertions} verifications, ${duree} s — ${code ? "ECHEC" : "SUCCES"} ===`,
);
process.exit(code ? 1 : 0);
