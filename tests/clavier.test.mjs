/**
 * Navigation et focus au clavier dans l'instrument 05 : on entre, on regle,
 * on enregistre, on ferme — sans jamais perdre le focus ni lire un libelle
 * en capitales a voix haute.
 */
import { test } from "node:test";
import { chromium } from "playwright-core";
import {
  CAMERA_FACTICE,
  CHROMIUM,
  GRANDE_PHOTO,
  allerAuMiroir,
  capture,
  conclure,
  miroir,
  nouvellePage,
  verifie,
} from "./outils.mjs";

/* Une sentinelle par image : si le focus retombe sur le corps du document,
   on le sait a la milliseconde pres. */
const INIT = `
window.__perdu = [];
window.__surveille = false;
(function boucle() {
  if (window.__surveille) {
    const a = document.activeElement;
    if (!a || a === document.body || a === document.documentElement) window.__perdu.push(Math.round(performance.now()));
  }
  requestAnimationFrame(boucle);
})();
`;

test("parcours complet au clavier", async () => {
  const navigateur = await chromium.launch({ executablePath: CHROMIUM, args: CAMERA_FACTICE });
  const ctx = await navigateur.newContext({ permissions: ["camera"], acceptDownloads: true });
  await ctx.addInitScript(INIT);
  const p = await nouvellePage(ctx);

  const actif = () =>
    p.evaluate(() => {
      const a = document.activeElement;
      if (!a) return "NUL";
      return (
        a.tagName +
        " · " +
        (a.getAttribute("aria-label") || a.textContent || "").trim().slice(0, 34)
      );
    });
  const dansInstrument = () =>
    p.evaluate(() => {
      const s = document.querySelector('section[data-mire="MIROIR"]');
      return !!(s && document.activeElement && s.contains(document.activeElement));
    });

  await allerAuMiroir(p);

  let tabulations = 0;
  let entre = false;
  await p.evaluate(() => document.getElementById("evitement")?.focus?.());
  for (let i = 0; i < 120; i++) {
    await p.keyboard.press("Tab");
    tabulations++;
    if ((await actif()).includes("Ouvrir la caméra")) {
      entre = true;
      break;
    }
  }
  verifie("OUVRIR LA CAMERA est atteint au Tab seul", entre, tabulations + " tabulations");
  await p.evaluate(() => {
    window.__surveille = true;
  });

  const journal = [];
  async function etape(nom, action, attente = 900) {
    await action();
    await p.waitForTimeout(attente);
    const a = await actif();
    const dedans = await dansInstrument();
    journal.push(`${nom} -> ${a}`);
    verifie(`focus garde : ${nom}`, dedans && !a.startsWith("BODY"), a);
  }

  await etape("ENTREE sur OUVRIR LA CAMERA", () => p.keyboard.press("Enter"), 1600);
  verifie("la camera est ouverte", (await miroir(p).locator("figcaption").count()) === 1);
  await p.screenshot({ path: capture("clavier-camera-1440.png") });

  await etape("MAJ+TAB (1)", () => p.keyboard.press("Shift+Tab"));
  await etape("MAJ+TAB (2)", () => p.keyboard.press("Shift+Tab"));
  await etape("MAJ+TAB (3)", () => p.keyboard.press("Shift+Tab"));
  let a = await actif();
  for (let i = 0; i < 12 && !a.includes("BIN"); i++) {
    await p.keyboard.press("Shift+Tab");
    a = await actif();
  }
  await etape("ENTREE sur BIN", () => p.keyboard.press("Enter"), 600);
  verifie("la planche est passee en BIN", (await miroir(p).innerText()).includes("SEUIL"));

  a = await actif();
  for (let i = 0; i < 6 && !a.includes("Monter le seuil"); i++) {
    await p.keyboard.press("Shift+Tab");
    a = await actif();
  }
  await etape("ENTREE sur + (regler le seuil)", () => p.keyboard.press("Enter"), 500);
  await etape("ENTREE sur + (deuxieme cran)", () => p.keyboard.press("Enter"), 500);

  a = await actif();
  for (let i = 0; i < 8 && !a.includes("Figer"); i++) {
    await p.keyboard.press("Tab");
    a = await actif();
  }
  verifie("le bloc FIGER est atteint", (await actif()).includes("Figer"), await actif());
  await etape("ENTREE sur FIGER", () => p.keyboard.press("Enter"), 600);
  verifie(
    "la planche est figee (bloc REPRENDRE)",
    (await miroir(p).innerText()).includes("REPRENDRE"),
  );

  a = await actif();
  for (let i = 0; i < 16 && !a.includes("Enregistrer la trame"); i++) {
    await p.keyboard.press("Tab");
    a = await actif();
  }
  verifie(
    "le bloc ENREGISTRER est atteint",
    (await actif()).includes("Enregistrer la trame"),
    await actif(),
  );
  const tele1 = p.waitForEvent("download", { timeout: 8000 }).catch(() => null);
  await etape("ENTREE sur ENREGISTRER", () => p.keyboard.press("Enter"), 900);
  const fichier1 = await tele1;
  verifie("un PNG est enregistre", !!fichier1, fichier1 ? fichier1.suggestedFilename() : "aucun");

  /* deux fois le meme message : la region live doit tout de meme muter */
  await p.evaluate(() => {
    const l = document.querySelectorAll('section[data-mire="MIROIR"] [aria-live="polite"]');
    window.__mut = 0;
    new MutationObserver(() => {
      window.__mut++;
    }).observe(l[l.length - 1], { childList: true, characterData: true, subtree: true });
  });
  const tele2 = p.waitForEvent("download", { timeout: 8000 }).catch(() => null);
  await etape("ENTREE sur ENREGISTRER (meme message)", () => p.keyboard.press("Enter"), 900);
  await tele2;
  const mutations = await p.evaluate(() => window.__mut);
  verifie("la region live rejoue un message identique", mutations > 0, mutations + " mutations");
  await p.waitForTimeout(4500);
  const vide = await p.evaluate(() => {
    const l = document.querySelectorAll('section[data-mire="MIROIR"] [aria-live="polite"]');
    return l[l.length - 1].textContent;
  });
  verifie("la region live se vide apres annonce", vide === "", JSON.stringify(vide));

  a = await actif();
  for (let i = 0; i < 10 && !a.includes("Fermer la source"); i++) {
    await p.keyboard.press("Tab");
    a = await actif();
  }
  verifie(
    "le nom accessible de FERMER parle de la camera",
    (await actif()).includes("Fermer la source et arr"),
    await actif(),
  );
  await etape("ENTREE sur FERMER", () => p.keyboard.press("Enter"), 900);
  verifie(
    "le focus est rendu a OUVRIR LA CAMERA",
    (await actif()).includes("Ouvrir la caméra"),
    await actif(),
  );
  verifie("la source est fermee", (await miroir(p).locator("figcaption").count()) === 0);

  verifie(
    "le focus n'est jamais tombe sur le corps du document",
    (await p.evaluate(() => window.__perdu.length)) === 0,
    (await p.evaluate(() => window.__perdu.length)) + " images",
  );

  /* nom accessible du bloc de choix de fichier */
  const instantane = await p.accessibility.snapshot();
  const noeuds = [];
  (function marche(n) {
    if (!n) return;
    noeuds.push(n);
    (n.children || []).forEach(marche);
  })(instantane);
  const noms = noeuds.map((n) => n.name).filter(Boolean);
  verifie(
    "le champ de fichier est nomme en francais accentue",
    noms.some((n) => n === "Choisir une image sur cet appareil"),
    noms
      .filter((n) => /image/i.test(n))
      .slice(0, 4)
      .join(" | "),
  );
  const controles = noeuds.filter((n) =>
    /button|link|textbox|checkbox|combobox/.test(n.role || ""),
  );
  verifie(
    "aucune commande nommee par les capitales de la mire",
    !controles.some((n) => n.name === "CHOISIR UNE IMAGE"),
    controles
      .filter((n) => /CHOISIR/.test(n.name || ""))
      .map((n) => n.role + ":" + n.name)
      .join(" | "),
  );

  /* sur une image, FERMER ne parle plus de camera */
  await p.locator('section[data-mire="MIROIR"] input[type="file"]').setInputFiles(GRANDE_PHOTO);
  await p.waitForTimeout(2500);
  const etiquette = await miroir(p)
    .locator("button", { hasText: "FERMER" })
    .first()
    .getAttribute("aria-label");
  verifie(
    "sur une image, FERMER ne parle plus de camera",
    etiquette === "Fermer l'image affichée",
    String(etiquette),
  );
  await p.screenshot({ path: capture("clavier-image-1440.png") });
  await miroir(p).locator("button", { hasText: "FERMER" }).first().click();
  await p.waitForTimeout(400);

  /* CAMERA SUIVANTE : jamais propose sans second capteur */
  const capteurs = await p.evaluate(
    async () =>
      (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "videoinput")
        .length,
  );
  await miroir(p).locator("button", { hasText: "OUVRIR LA CAMERA" }).click();
  await p.waitForTimeout(1500);
  const bascule = await miroir(p).locator("button", { hasText: "CAMERA SUIVANTE" }).count();
  verifie(
    "CAMERA SUIVANTE suit le nombre reel de capteurs",
    capteurs > 1 === (bascule === 1),
    `capteurs=${capteurs}, bloc=${bascule}`,
  );
  await miroir(p).locator("button", { hasText: "FERMER" }).click();
  await p.waitForTimeout(300);

  console.log("    journal du focus :");
  journal.forEach((l) => console.log("      " + l));
  verifie("aucune erreur console", p.erreurs.length === 0, p.erreurs.slice(0, 3).join(" | "));

  await navigateur.close();
  conclure();
});
