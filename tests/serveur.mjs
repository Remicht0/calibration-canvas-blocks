/**
 * Construit le site et le sert, le temps d'une campagne de tests.
 * `vite dev` ne demarre pas dans tous les conteneurs (pas d'IPv6) : on passe
 * par la sortie Nitro, qui est aussi ce que voit un visiteur.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
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

/** Demarre le serveur et attend qu'il reponde. Rend la fonction d'arret. */
export async function demarrer(port) {
  const enfant = spawn(process.execPath, [SORTIE], {
    cwd: RACINE,
    env: { ...process.env, PORT: String(port), HOST: "127.0.0.1" },
    stdio: ["ignore", "inherit", "inherit"],
  });
  let mort = null;
  enfant.on("exit", (code) => {
    mort = code;
  });

  const arreter = async () => {
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
      if (r.ok) {
        console.log(`[serveur] pret sur ${base}`);
        return arreter;
      }
    } catch {
      /* pas encore la */
    }
    await attendre(500);
  }
  await arreter();
  throw new Error(`le serveur n'a pas repondu sur ${base}`);
}
