/**
 * Deux chemins moins frequentes : la bascule camera vers image, et le second
 * capteur — qui n'est propose que s'il existe vraiment.
 */
import { after, before, test } from "node:test";
import { chromium } from "playwright-core";
import {
  CAMERA_MIRE,
  CHROMIUM,
  ESPION,
  allerAuMiroir,
  capture,
  conclure,
  etats,
  miroir,
  nouvellePage,
  photo,
  verifie,
} from "./outils.mjs";

/** Deux capteurs factices : fake_device_0 et fake_device_1. */
const DEUX_CAPTEURS = [
  "--no-sandbox",
  "--use-fake-device-for-media-stream=device-count=2",
  "--use-fake-ui-for-media-stream",
];

let navigateur;
before(async () => {
  navigateur = await chromium.launch({ executablePath: CHROMIUM, args: CAMERA_MIRE });
});
after(async () => {
  await navigateur?.close();
});

const contraintes = (page) => page.evaluate(() => window.__contraintes);

test("bascule camera vers image", async () => {
  const ctx = await navigateur.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(ESPION);
  const page = await nouvellePage(ctx);
  await allerAuMiroir(page);
  await page.getByRole("button", { name: /ouvrir la caméra/i }).click();
  await page.waitForTimeout(1800);
  verifie("camera vivante avant la bascule", (await etats(page)).includes("live"));
  await page.locator('section[data-mire="MIROIR"] input[type=file]').setInputFiles(photo("p3.jpg"));
  await page.waitForTimeout(1800);
  verifie(
    "les pistes sont arretees",
    (await etats(page)).every((s) => s === "ended"),
  );
  const txt = await miroir(page).innerText();
  verifie(
    "etiquette du fichier",
    txt.includes("MIROIR / P3"),
    txt.split("\n").find((l) => l.includes("MIROIR")) ?? "",
  );
  verifie("le bloc OUVRIR LA CAMERA revient", txt.includes("OUVRIR LA CAMERA"));
  const c = await contraintes(page);
  verifie(
    "contrainte : audio false explicite",
    c.every((x) => /"audio":false/.test(x)),
    c.join(" "),
  );
  verifie("aucune erreur", page.erreurs.length === 0, page.erreurs.join(" | ").slice(0, 200));
  await ctx.close();
  conclure();
});

test("un seul capteur : CAMERA SUIVANTE n'est pas propose", async () => {
  const ctx = await navigateur.newContext({
    viewport: { width: 393, height: 852 },
    hasTouch: true,
    isMobile: true,
  });
  await ctx.addInitScript(ESPION);
  const page = await nouvellePage(ctx);
  await allerAuMiroir(page);
  verifie(
    "le navigateur se declare a pointeur grossier",
    await page.evaluate(() => matchMedia("(pointer: coarse)").matches),
  );
  await page.getByRole("button", { name: /ouvrir la caméra/i }).click();
  await page.waitForTimeout(2200);
  const capteurs = await page.evaluate(
    async () =>
      (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "videoinput")
        .length,
  );
  verifie("le navigateur n'expose qu'un capteur", capteurs === 1, String(capteurs));
  verifie(
    "aucun bloc CAMERA SUIVANTE : la contrainte facingMode serait souple et muette",
    (await miroir(page).locator("button", { hasText: "CAMERA SUIVANTE" }).count()) === 0,
  );
  await ctx.close();
  conclure();
});

test("deux capteurs : la bascule rouvre en facingMode environment", async () => {
  const deux = await chromium.launch({ executablePath: CHROMIUM, args: DEUX_CAPTEURS });
  const ctx = await deux.newContext({
    viewport: { width: 393, height: 852 },
    hasTouch: true,
    isMobile: true,
  });
  await ctx.addInitScript(ESPION);
  const page = await nouvellePage(ctx);
  await allerAuMiroir(page);
  await page.getByRole("button", { name: /ouvrir la caméra/i }).click();
  await page.waitForTimeout(2200);
  const txt = await miroir(page).innerText();
  verifie(
    "CAMERA SUIVANTE est proposee",
    txt.includes("CAMERA SUIVANTE"),
    txt
      .split("\n")
      .filter((l) => /CAMERA/.test(l))
      .join(" | "),
  );
  await miroir(page).screenshot({ path: capture("extra-deux-capteurs-393.png") });
  await page.getByRole("button", { name: /caméra suivante/i }).click();
  await page.waitForTimeout(2200);
  const c = await contraintes(page);
  verifie(
    "la bascule rouvre en facingMode environment",
    /environment/.test(c.join(" ")),
    c.join(" "),
  );
  const e = await etats(page);
  verifie(
    "une seule piste vivante apres la bascule",
    e.filter((s) => s === "live").length === 1,
    JSON.stringify(e),
  );
  verifie("la planche est toujours la", (await miroir(page).locator("canvas").count()) > 0);
  const debord = await page.evaluate(() => [
    document.documentElement.scrollWidth,
    window.innerWidth,
  ]);
  verifie("393 px coarse : aucun debordement", debord[0] === debord[1], debord.join(" / "));
  verifie("aucune erreur", page.erreurs.length === 0, page.erreurs.join(" | ").slice(0, 200));
  await deux.close();
  conclure();
});
