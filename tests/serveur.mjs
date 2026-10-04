/**
 * Construit le site et le sert, le temps d'une campagne de tests.
 * `vite dev` ne demarre pas dans tous les conteneurs (pas d'IPv6) : on passe
 * par la sortie Nitro, qui est aussi ce que voit un visiteur.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { RACINE, attendre } from "./outils.mjs";

const SORTIE = path.join(RACINE, ".output", "server", "index.mjs");

const lancer = (commande, args, env) =>
  new Promise((resoudre, rejeter) => {
    const p = spawn(commande, args, {
      cwd: RACINE,
      env: { ...process.env, ...env },
      stdio: ["ignore", "inherit", "inherit"],
    });
    p.on("error", rejeter);
    p.on("exit", (code) =>
      code === 0 ? resoudre() : rejeter(new Error(`${commande} ${args.join(" ")} : code ${code}`)),
    );
  });

/** Construit la sortie serveur. */
export async function construire() {
  console.log("[serveur] construction (NITRO_PRESET=node-server)");
  await lancer("bun", ["run", "build"], { NITRO_PRESET: "node-server" });
  if (!fs.existsSync(SORTIE)) throw new Error("construction sans sortie serveur : " + SORTIE);
}

/** Vrai si personne n'ecoute deja sur ce port. */
export function portLibre(port) {
  return new Promise((resoudre) => {
    const sonde = net.createServer();
    sonde.once("error", () => resoudre(false));
    sonde.once("listening", () => sonde.close(() => resoudre(true)));
    sonde.listen(port, "127.0.0.1");
  });
}

/**
 * Demarre le serveur et attend qu'il reponde. Rend la fonction d'arret.
 * `surMort` est appelee si le serveur s'arrete apres coup, en pleine campagne :
 * sans elle, les suites continuent de jouer contre un port muet et rendent une
 * page d'echecs de ressources au lieu de la seule cause reelle.
 */
export async function demarrer(port, surMort) {
  /* Sans ce controle, un service etranger qui repond deja sur ce port ferait
     jouer toute la campagne contre lui, en silence et en vert. */
  if (!(await portLibre(port)))
    throw new Error(`le port ${port} est deja pris : donnez un autre MIRE_PORT`);

  const enfant = spawn(process.execPath, [SORTIE], {
    cwd: RACINE,
    env: { ...process.env, PORT: String(port), HOST: "127.0.0.1" },
    stdio: ["ignore", "inherit", "inherit"],
  });
  let mort = null;
  let pret = false;
  let voulu = false;
  enfant.on("exit", (code, signal) => {
    mort = code ?? signal;
    if (pret && !voulu) surMort?.(mort);
  });

  const arreter = async () => {
    voulu = true;
    if (enfant.exitCode !== null || enfant.signalCode !== null) return;
    enfant.kill("SIGTERM");
    for (let i = 0; i < 40 && enfant.exitCode === null; i++) await attendre(50);
    if (enfant.exitCode === null) enfant.kill("SIGKILL");
  };

  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 120; i++) {
    if (mort !== null) throw new Error(`le serveur s'est arrete (code ${mort})`);
    try {
      const r = await fetch(base + "/", { signal: AbortSignal.timeout(2000) });
      if (mort !== null) break;
      if (r.ok) {
        pret = true;
        console.log(`[serveur] pret sur ${base}`);
        return arreter;
      }
    } catch {
      /* pas encore la */
    }
    await attendre(500);
  }
  await arreter();
  throw new Error(
    mort !== null
      ? `le serveur s'est arrete (code ${mort})`
      : `le serveur n'a pas repondu sur ${base}`,
  );
}
