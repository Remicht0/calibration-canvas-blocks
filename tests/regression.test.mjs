/**
 * Non-regressions : le reste du site n'a pas bouge, la fiche de commande est a
 * jour, le miroir reste utilisable sous mouvement reduit, et l'impression pose
 * planches et titre entiers sans casser leur pilotage.
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
  SLUGS,
} from "./outils.mjs";

let navigateur;
before(async () => {
  navigateur = await chromium.launch({ executablePath: CHROMIUM, args: CAMERA_MIRE });
});
after(async () => {
  await navigateur?.close();
});

test("le reste du site ne bouge pas", async () => {
  for (const route of [
    "/",
    "/atelier",
    "/a-propos",
    "/contact",
    `/projet/${SLUGS[SLUGS.length - 1]}`,
  ]) {
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

test("impression : planches et titre poses entiers, puis rendus a leur pilotage", async () => {
  // cellules non blanches d'un canvas, echantillonnees ; -1 pour un canvas sans trame
  const encre = () => {
    const mesure = (cv) => {
      if (!cv || !cv.width) return -1;
      const d = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data;
      let n = 0;
      for (let i = 0; i < d.length; i += 64)
        if (d[i + 3] > 0 && Math.min(d[i], d[i + 1], d[i + 2]) < 250) n++;
      return n;
    };
    return {
      titre: mesure(document.querySelector("h1.sr-only + canvas")),
      planches: [...document.querySelectorAll('figure > [role="img"] canvas')].map(mesure),
    };
  };
  const imprimer = (page, ev) => page.evaluate((e) => window.dispatchEvent(new Event(e)), ev);
  for (const slug of SLUGS) {
    const ctx = await navigateur.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await nouvellePage(ctx);
    await page.goto(`${BASE}/projet/${slug}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);

    // haut de page : les planches sous le pli (defilement ou pas encore entrees) sont vides
    const haut = await page.evaluate(encre);
    await imprimer(page, "beforeprint");
    const feuille = await page.evaluate(encre);
    await imprimer(page, "afterprint");
    await page.waitForTimeout(400);
    const retour = await page.evaluate(encre);
    verifie(
      `${slug} : en haut de page, une planche au moins attend son entree`,
      haut.planches.some((n) => n === 0),
      JSON.stringify(haut.planches),
    );
    verifie(
      `${slug} : sur la feuille, toutes les planches sont posees`,
      feuille.planches.length > 0 && feuille.planches.every((n) => n > 0),
      JSON.stringify(feuille.planches),
    );
    verifie(
      `${slug} : apres impression, chaque planche retrouve son etat`,
      JSON.stringify(retour.planches) === JSON.stringify(haut.planches),
      `${JSON.stringify(haut.planches)} / ${JSON.stringify(retour.planches)}`,
    );

    // bas de page : la ligne rouge a lu le titre, il est vide a l'ecran
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1200);
    const bas = await page.evaluate(encre);
    await imprimer(page, "beforeprint");
    const titre = await page.evaluate(encre);
    await imprimer(page, "afterprint");
    await page.waitForTimeout(400);
    const relu = await page.evaluate(encre);
    verifie(`${slug} : en bas de page, le titre est lu (vide)`, bas.titre === 0, String(bas.titre));
    verifie(
      `${slug} : sur la feuille, le titre est pose entier`,
      titre.titre > 0,
      String(titre.titre),
    );
    verifie(
      `${slug} : apres impression, le titre est relu par la ligne`,
      relu.titre === 0,
      String(relu.titre),
    );

    // un element fixe se repete sur chaque feuille : masque ouvert ou non, aucun ne s'imprime
    await page.keyboard.press("?");
    await page.waitForTimeout(400);
    const ouverte = await page.evaluate(() => !!document.querySelector('[role="dialog"]'));
    await page.emulateMedia({ media: "print" });
    const fixes = await page.evaluate(() =>
      [...document.querySelectorAll("body *")]
        .filter((e) => getComputedStyle(e).position === "fixed" && e.getClientRects().length > 0)
        .map((e) => `${e.tagName}.${String(e.className).split(" ").slice(0, 3).join(".")}`),
    );
    await page.emulateMedia({ media: "screen" });
    verifie(
      `${slug} : fiche ouverte, aucun element fixe sur la feuille`,
      ouverte && fixes.length === 0,
      ouverte ? fixes.join(" | ") : "la fiche ne s'est pas ouverte",
    );
    verifie(
      `${slug} : console vide`,
      page.erreurs.length === 0,
      page.erreurs.join(" | ").slice(0, 200),
    );
    await ctx.close();
  }
  conclure();
});
