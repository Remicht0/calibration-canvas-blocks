/**
 * Autorisation encore en vol : quoi qu'il arrive pendant l'attente, le flux
 * qui arrive apres coup est coupe a l'arrivee.
 */
import { after, before, test } from "node:test";
import { chromium } from "playwright-core";
import {
  CAMERA_MIRE,
  CHROMIUM,
  ESPION,
  allerAuMiroir,
  conclure,
  etats,
  miroir,
  nouvellePage,
  photo,
  verifie,
} from "./outils.mjs";

let navigateur;
before(async () => {
  navigateur = await chromium.launch({ executablePath: CHROMIUM, args: CAMERA_MIRE });
});
after(async () => {
  await navigateur?.close();
});

/** getUserMedia ralenti de 2 s : la fenetre d'attente devient assez large pour
    qu'un depart de page tombe en plein dedans. */
async function prepare() {
  const ctx = await navigateur.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(ESPION);
  const page = await nouvellePage(ctx);
  await allerAuMiroir(page);
  await page.evaluate(() => {
    window.__delai = 2000;
  });
  return { ctx, page };
}

test("onglet cache pendant l'autorisation", async () => {
  const { ctx, page } = await prepare();
  await page.getByRole("button", { name: /ouvrir la caméra/i }).click();
  await page.waitForTimeout(400);
  verifie("l'etat lit AUTORISATION", (await miroir(page).innerText()).includes("AUTORISATION"));
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForTimeout(3000);
  const e = await etats(page);
  verifie(
    "le flux arrive apres coup est coupe",
    e.length > 0 && e.every((s) => s === "ended"),
    JSON.stringify(e),
  );
  const txt = await miroir(page).innerText();
  verifie(
    "l'instrument ne reste pas bloque sur AUTORISATION",
    !txt.includes("AUTORISATION"),
    txt.split("\n").slice(1, 3).join(" | "),
  );
  verifie("la mire dit CAMERA ARRETEE", txt.includes("CAMERA ARRETEE"));
  verifie("aucune planche n'est montee", (await miroir(page).locator("canvas").count()) === 0);
  verifie("aucune erreur", page.erreurs.length === 0, page.erreurs.join(" | ").slice(0, 200));
  await ctx.close();
  conclure();
});

test("changement de route pendant l'autorisation", async () => {
  const { ctx, page } = await prepare();
  await page.getByRole("button", { name: /ouvrir la caméra/i }).click();
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    [...document.querySelectorAll("a")].find((x) => x.getAttribute("href") === "/contact")?.click();
  });
  await page.waitForTimeout(3500);
  const e = await etats(page);
  verifie(
    "le flux arrive apres le depart est coupe",
    e.length > 0 && e.every((s) => s === "ended"),
    JSON.stringify(e),
  );
  verifie(
    "on est bien sur /contact",
    (await page.evaluate(() => location.pathname)) === "/contact",
  );
  verifie("aucune erreur", page.erreurs.length === 0, page.erreurs.join(" | ").slice(0, 200));
  await ctx.close();
  conclure();
});

test("image choisie pendant l'autorisation", async () => {
  const { ctx, page } = await prepare();
  await page.getByRole("button", { name: /ouvrir la caméra/i }).click();
  await page.waitForTimeout(400);
  await page.locator('section[data-mire="MIROIR"] input[type=file]').setInputFiles(photo("p4.jpg"));
  await page.waitForTimeout(3500);
  const e = await etats(page);
  verifie(
    "le flux arrive apres coup est coupe",
    e.length > 0 && e.every((s) => s === "ended"),
    JSON.stringify(e),
  );
  const txt = await miroir(page).innerText();
  verifie(
    "l'image a bien pris la place",
    txt.includes("MIROIR / P4"),
    txt.split("\n").find((l) => l.includes("MIROIR")) ?? "",
  );
  verifie("aucune erreur", page.erreurs.length === 0, page.erreurs.join(" | ").slice(0, 200));
  await ctx.close();
  conclure();
});
