/**
 * Non-regressions : le reste du site n'a pas bouge, la fiche de commande est a
 * jour, et le miroir reste utilisable sous mouvement reduit.
 */
import { after, before, test } from "node:test";
import { chromium } from "playwright-core";
import {
  BASE,
  CAMERA_MIRE,
  CHROMIUM,
  COMPTE_TRAMES,
  ESPION,
  capture,
  conclure,
  miroir,
  nouvellePage,
  trames,
  verifie,
} from "./outils.mjs";

let navigateur;
before(async () => {
  navigateur = await chromium.launch({ executablePath: CHROMIUM, args: CAMERA_MIRE });
});
after(async () => {
  await navigateur?.close();
});

test("le reste du site ne bouge pas", async () => {
  for (const route of ["/", "/atelier", "/contact", "/projet/mire-tv"]) {
    const ctx = await navigateur.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await nouvellePage(ctx);
    const rep = await page.goto(BASE + route, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(2000);
    verifie(`${route} : 200`, rep && rep.status() === 200, String(rep && rep.status()));
    const peintes = await page.evaluate(() => {
      let n = 0;
      let vides = 0;
      for (const cv of document.querySelectorAll("figure canvas")) {
        if (!cv.width) continue;
        n++;
        const d = cv
          .getContext("2d")
          .getImageData(0, 0, Math.min(cv.width, 200), Math.min(cv.height, 200)).data;
        let poses = 0;
        for (let i = 0; i < d.length; i += 40) if (d[i + 3] > 0) poses++;
        if (poses < 3) vides++;
      }
      return { n, vides };
    });
    verifie(
      `${route} : les planches sont peintes`,
      peintes.n === 0 || peintes.vides === 0,
      JSON.stringify(peintes),
    );
    const debord = await page.evaluate(() => [
      document.documentElement.scrollWidth,
      window.innerWidth,
    ]);
    verifie(`${route} : aucun debordement`, debord[0] === debord[1], debord.join(" / "));
    verifie(
      `${route} : console vide`,
      page.erreurs.length === 0,
      page.erreurs.join(" | ").slice(0, 200),
    );
    await ctx.close();
  }
  conclure();
});

test("fiche de commande", async () => {
  for (const l of [393, 1440]) {
    const ctx = await navigateur.newContext({
      viewport: { width: l, height: l === 393 ? 852 : 900 },
    });
    const page = await nouvellePage(ctx);
    await page.goto(BASE + "/atelier", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2600);
    await page.keyboard.press("?");
    await page.waitForTimeout(700);
    const txt = await page.evaluate(
      () => document.querySelector('[role="dialog"]')?.innerText ?? "",
    );
    verifie(`${l} px : CTRL+V est dans la fiche`, txt.includes("CTRL+V"));
    const mesures = await page.evaluate(() => {
      const d = document.querySelector('[role="dialog"]');
      return [
        d.scrollWidth,
        d.clientWidth,
        document.documentElement.scrollWidth,
        window.innerWidth,
      ];
    });
    verifie(
      `${l} px : la fiche ne deborde pas`,
      mesures[0] <= mesures[1] && mesures[2] === mesures[3],
      mesures.join(" / "),
    );
    await page.screenshot({ path: capture(`regression-aide-${l}.png`) });
    verifie(`${l} px : aucune erreur`, page.erreurs.length === 0, page.erreurs.join(" | "));
    await ctx.close();
  }
  conclure();
});

test("mouvement reduit : le miroir reste utilisable", async () => {
  const ctx = await navigateur.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  });
  await ctx.addInitScript(ESPION + COMPTE_TRAMES);
  const page = await nouvellePage(ctx);
  await page.goto(BASE + "/atelier", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await miroir(page).scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: /ouvrir la caméra/i }).click();
  await page.waitForTimeout(2200);
  const poses = await page.evaluate(() => {
    const cv = document.querySelector('section[data-mire="MIROIR"] canvas');
    if (!cv) return null;
    const d = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data;
    let n = 0;
    for (let i = 0; i < cv.width * cv.height; i += 9) if (d[i * 4 + 3] > 0) n++;
    return n;
  });
  verifie("la planche est posee d'un coup", poses !== null && poses > 1000, String(poses));
  const txt = await miroir(page).innerText();
  // La planche se fige sur la premiere trame reelle : le bloc propose REPRENDRE.
  verifie(
    "la planche se fige sur la premiere trame (bloc REPRENDRE)",
    txt.includes("REPRENDRE"),
    txt.split("\n").find((l) => /FIGER|REPRENDRE/.test(l)) ?? "",
  );
  const d0 = await trames(page);
  await page.waitForTimeout(1200);
  const d1 = await trames(page);
  verifie("plus rien n'est echantillonne tant qu'on ne relance pas", d1 === d0, `${d0} -> ${d1}`);
  // la source est bien vivante : REPRENDRE fait repartir la trame
  await miroir(page).locator("button", { hasText: "REPRENDRE" }).click();
  await page.waitForTimeout(1000);
  const d2 = await trames(page);
  verifie("REPRENDRE fait repartir la trame", d2 > d1, `${d1} -> ${d2}`);
  await miroir(page).screenshot({ path: capture("regression-reduit-1440.png") });
  verifie("aucune erreur", page.erreurs.length === 0, page.erreurs.join(" | ").slice(0, 200));
  await ctx.close();
  conclure();
});
