/**
 * Regles de vie privee du miroir : la camera ne tourne que sous les yeux du
 * visiteur, rien ne part, rien ne reste.
 */
import { after, before, test } from "node:test";
import { chromium } from "playwright-core";
import {
  CAMERA_FACTICE,
  CHROMIUM,
  COMPTE_TRAMES,
  ESPION,
  GRANDE_PHOTO,
  allerAuMiroir,
  capture,
  conclure,
  etats,
  miroir,
  nouvellePage,
  trames,
  verifie,
} from "./outils.mjs";

/* En plus de l'espion : on pilote la visibilite de l'onglet et on peut
   ralentir le decodage d'image pour ouvrir la fenetre « lecture en cours ». */
const INIT = `
${ESPION}
${COMPTE_TRAMES}
window.__decode = 0;
window.__hidden = false;
Object.defineProperty(document, "hidden", { configurable: true, get: () => window.__hidden === true });
Object.defineProperty(document, "visibilityState", { configurable: true, get: () => (window.__hidden ? "hidden" : "visible") });
const ob = window.createImageBitmap;
window.createImageBitmap = async (...a) => {
  if (window.__decode) await new Promise((r) => setTimeout(r, window.__decode));
  return ob(...a);
};
`;

let navigateur;
before(async () => {
  navigateur = await chromium.launch({ executablePath: CHROMIUM, args: CAMERA_FACTICE });
});
after(async () => {
  await navigateur?.close();
});

async function ouvrir(opts = {}) {
  const ctx = await navigateur.newContext({
    permissions: ["camera"],
    acceptDownloads: true,
    ...opts,
  });
  await ctx.addInitScript(INIT);
  const page = await nouvellePage(ctx);
  return { ctx, page };
}

const bloc = (page, txt) => miroir(page).locator("button, label").filter({ hasText: txt }).first();
const avis = (page) =>
  miroir(page)
    .innerText()
    .catch(() => "");

test("la section quitte l'ecran pendant que la permission est demandee", async () => {
  const { ctx, page } = await ouvrir();
  await allerAuMiroir(page);
  await page.evaluate(() => {
    window.__delai = 2500;
  });
  await bloc(page, "OUVRIR LA CAMERA").click();
  await page.waitForTimeout(200);
  verifie("la demande en vol est affichee", (await avis(page)).includes("AUTORISATION EN COURS"));
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(1600);
  const apres = await avis(page);
  verifie(
    "sortie d'ecran : la demande est annulee",
    apres.includes("CAMERA ARRETEE"),
    apres.split("\n")[1] ?? "",
  );
  await page.waitForTimeout(2200);
  const e = await etats(page);
  verifie(
    "la permission accordee apres coup ne laisse aucune piste vivante",
    e.length > 0 && e.every((x) => x === "ended"),
    JSON.stringify(e),
  );
  verifie(
    "aucune trame echantillonnee",
    (await trames(page)) === 0,
    "drawImage(video)=" + (await trames(page)),
  );
  await ctx.close();
  conclure();
});

test("camera ouverte puis la section sort de l'ecran", async () => {
  const { ctx, page } = await ouvrir();
  await allerAuMiroir(page);
  await bloc(page, "OUVRIR LA CAMERA").click();
  await page.waitForTimeout(1200);
  verifie("camera ouverte", (await etats(page)).includes("live"));
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(1600);
  const e = await etats(page);
  verifie(
    "pistes ended quand la planche quitte l'ecran",
    e.every((x) => x === "ended"),
    JSON.stringify(e),
  );
  await ctx.close();
  conclure();
});

test("changement de route", async () => {
  const { ctx, page } = await ouvrir();
  await allerAuMiroir(page);
  await bloc(page, "OUVRIR LA CAMERA").click();
  await page.waitForTimeout(1200);
  verifie("camera ouverte", (await etats(page)).includes("live"));
  await page.locator('section[data-mire="NOTES"] a', { hasText: "INDEX" }).first().click();
  await page.waitForTimeout(900);
  const e = await etats(page);
  verifie(
    "pistes ended au changement de route",
    e.every((x) => x === "ended"),
    JSON.stringify(e),
  );
  await ctx.close();
  conclure();
});

test("onglet cache", async () => {
  const { ctx, page } = await ouvrir();
  await allerAuMiroir(page);
  await bloc(page, "OUVRIR LA CAMERA").click();
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    window.__hidden = true;
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForTimeout(400);
  const e = await etats(page);
  verifie(
    "pistes ended quand l'onglet est cache",
    e.every((x) => x === "ended"),
    JSON.stringify(e),
  );
  verifie("l'interface le dit", (await avis(page)).includes("CAMERA ARRETEE"));
  await ctx.close();
  conclure();
});

test("demontage : la page part ailleurs", async () => {
  const { ctx, page } = await ouvrir();
  await allerAuMiroir(page);
  await bloc(page, "OUVRIR LA CAMERA").click();
  await page.waitForTimeout(1200);
  await page
    .locator("header a, nav a")
    .filter({ hasText: "INDEX" })
    .first()
    .click()
    .catch(() => page.locator('a[href="/"]').first().click());
  await page.waitForTimeout(900);
  const e = await etats(page);
  verifie(
    "pistes ended au demontage",
    e.length > 0 && e.every((x) => x === "ended"),
    JSON.stringify(e),
  );
  await ctx.close();
  conclure();
});

test("pagehide puis retour de bfcache", async () => {
  const { ctx, page } = await ouvrir();
  await allerAuMiroir(page);
  await bloc(page, "OUVRIR LA CAMERA").click();
  await page.waitForTimeout(1200);
  await page.evaluate(() =>
    window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true })),
  );
  await page.waitForTimeout(200);
  const e1 = await etats(page);
  verifie(
    "pagehide coupe les pistes",
    e1.every((x) => x === "ended"),
    JSON.stringify(e1),
  );
  verifie(
    "avant pageshow la planche est encore la (etat React gele)",
    (await miroir(page).locator("figcaption").count()) === 1,
  );
  await page.evaluate(() =>
    window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })),
  );
  await page.waitForTimeout(400);
  const txt = await avis(page);
  verifie(
    "pageshow resynchronise l'interface",
    txt.includes("CAMERA ARRETEE"),
    txt.split("\n")[1] ?? "",
  );
  verifie(
    "le bloc OUVRIR LA CAMERA est revenu",
    (await bloc(page, "OUVRIR LA CAMERA").count()) === 1,
  );
  await ctx.close();
  conclure();
});

test("fiche d'aide ouverte : l'echantillonnage s'arrete", async () => {
  const { ctx, page } = await ouvrir();
  await allerAuMiroir(page);
  await bloc(page, "OUVRIR LA CAMERA").click();
  await page.waitForTimeout(1500);
  const d0 = await trames(page);
  await page.waitForTimeout(600);
  const d1 = await trames(page);
  verifie("la planche echantillonne quand elle est visible", d1 > d0, `${d0} -> ${d1}`);
  await page.keyboard.press("?");
  await page.waitForTimeout(400);
  verifie(
    "la fiche est ouverte",
    (await page.locator('[role="dialog"][aria-label="Raccourcis clavier de la mire"]').count()) ===
      1,
  );
  const d2 = await trames(page);
  await page.waitForTimeout(1200);
  const d3 = await trames(page);
  verifie("aucune trame peinte sous le masque", d3 === d2, `${d2} -> ${d3}`);
  await page.screenshot({ path: capture("vie-privee-aide-1440.png") });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(600);
  const d4 = await trames(page);
  await page.waitForTimeout(600);
  const d5 = await trames(page);
  verifie("la planche reprend a la fermeture de la fiche", d5 > d4, `${d4} -> ${d5}`);
  await ctx.close();
  conclure();
});

test("grande image, puis ANNULER pendant le decodage", async () => {
  const { ctx, page } = await ouvrir();
  await allerAuMiroir(page);
  await page.evaluate(() => {
    window.__decode = 1500;
  });
  await page.locator('section[data-mire="MIROIR"] input[type="file"]').setInputFiles(GRANDE_PHOTO);
  await page.waitForTimeout(300);
  const lecture = await avis(page);
  verifie(
    "le creux affiche la lecture en cours",
    lecture.includes("LECTURE"),
    lecture.split("\n")[1] ?? "",
  );
  verifie(
    "aucune planche vide montee pendant le decodage",
    (await miroir(page).locator("figcaption").count()) === 0,
  );
  verifie("un bloc ANNULER existe pendant la lecture", (await bloc(page, "ANNULER").count()) === 1);
  await bloc(page, "ANNULER").click();
  await page.waitForTimeout(2600);
  verifie("rien ne s'affiche apres coup", (await miroir(page).locator("figcaption").count()) === 0);
  const blobs = await page.evaluate(
    () =>
      window.performance.getEntriesByType("resource").filter((r) => r.name.startsWith("blob:"))
        .length,
  );
  verifie("aucune ressource blob chargee", blobs === 0, String(blobs));
  verifie("SOURCE remise a AUCUNE", (await avis(page)).includes("AUCUNE SOURCE"));
  await ctx.close();
  conclure();
});

test("image chargee puis fermee : la planche est rendue", async () => {
  const { ctx, page } = await ouvrir();
  await allerAuMiroir(page);
  await page.locator('section[data-mire="MIROIR"] input[type="file"]').setInputFiles(GRANDE_PHOTO);
  await page.waitForTimeout(3000);
  verifie("la planche est montee", (await miroir(page).locator("figcaption").count()) === 1);
  await page.screenshot({ path: capture("vie-privee-image-1440.png") });
  await bloc(page, "FERMER").click();
  await page.waitForTimeout(500);
  verifie("la planche a disparu", (await miroir(page).locator("figcaption").count()) === 0);
  await ctx.close();
  conclure();
});
