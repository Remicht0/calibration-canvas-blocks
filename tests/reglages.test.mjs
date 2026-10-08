/**
 * Reglages du visiteur : FIGER arrete le mouvement (bandeau, bandes, videos,
 * WCAG 2.2.2) et RACCOURCIS COUPES fait taire les touches a un caractere
 * (WCAG 2.1.4). Les deux sont memorises comme le negatif.
 */
import { after, before, test } from "node:test";
import { chromium } from "playwright-core";
import { BASE, CHROMIUM, SLUGS, conclure, nouvellePage, verifie } from "./outils.mjs";

let navigateur;
before(async () => {
  navigateur = await chromium.launch({ executablePath: CHROMIUM, args: ["--no-sandbox"] });
});
after(async () => {
  await navigateur?.close();
});

/** Empreinte du premier canvas de bande de calibration a l'ecran. */
const empreinteBande = (page) =>
  page.evaluate(() => {
    const cv = [...document.querySelectorAll('div[class*="contain:inline-size"] > canvas')].find(
      (c) => {
        const r = c.getBoundingClientRect();
        return r.top >= 0 && r.bottom <= innerHeight && r.width > 100;
      },
    );
    if (!cv) return "";
    const d = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data;
    let h = 0;
    for (let i = 0; i < d.length; i += 4 * 7) h = (h * 31 + d[i]) | 0;
    return String(h);
  });

test("FIGER arrete le bandeau et les bandes, et s'en souvient", async () => {
  const ctx = await navigateur.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await nouvellePage(ctx);
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const bouton = page.locator("#figer");
  const boite = await bouton.boundingBox();
  const cell = await page.evaluate(() =>
    parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--cell")),
  );
  verifie(
    "FIGER est dans la gouttiere droite, au-dessus d'AIDE",
    !!boite && boite.x >= 1440 - 3 * cell,
    JSON.stringify(boite),
  );
  // une bande vivante d'abord : elle respire
  await page.evaluate(() =>
    document
      .querySelector('div[class*="contain:inline-size"] > canvas')
      ?.scrollIntoView({ block: "center" }),
  );
  await page.waitForTimeout(400);
  const a = await empreinteBande(page);
  await page.waitForTimeout(700);
  const b = await empreinteBande(page);
  verifie("sans FIGER, la bande bouge", a !== "" && a !== b, `${a} / ${b}`);

  await bouton.click();
  await page.waitForTimeout(300);
  const etat = await page.evaluate(() => ({
    classe: document.documentElement.classList.contains("mire-fige"),
    presse: document.getElementById("figer")?.getAttribute("aria-pressed"),
    bandeau: (() => {
      const t = document.querySelector(".mire-ticker");
      return t ? getComputedStyle(t).animationPlayState : "";
    })(),
  }));
  verifie(
    "FIGER est presse, le bandeau est a l'arret",
    etat.classe && etat.presse === "true" && etat.bandeau === "paused",
    JSON.stringify(etat),
  );
  const c = await empreinteBande(page);
  await page.waitForTimeout(900);
  const d = await empreinteBande(page);
  verifie("FIGER : la bande ne bouge plus", c !== "" && c === d, `${c} / ${d}`);

  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  const apres = await page.evaluate(() => ({
    classe: document.documentElement.classList.contains("mire-fige"),
    presse: document.getElementById("figer")?.getAttribute("aria-pressed"),
  }));
  verifie(
    "apres rechargement, le site reste fige",
    apres.classe && apres.presse === "true",
    JSON.stringify(apres),
  );
  await page.locator("#figer").click();
  const libre = await page.evaluate(() => document.documentElement.classList.contains("mire-fige"));
  verifie("un second clic rend le mouvement", !libre, String(libre));
  verifie("console vide", page.erreurs.length === 0, page.erreurs.join(" | ").slice(0, 200));
  await ctx.close();
  conclure();
});

test("RACCOURCIS COUPES : N, ?, chiffres muets ; fleches et console intactes", async () => {
  const ctx = await navigateur.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await nouvellePage(ctx);
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  await page.locator("#aide").click();
  await page.waitForTimeout(200);
  const bascule = page.locator('[role="dialog"] button', { hasText: /^(ACTIFS|COUPES)$/ });
  await bascule.click();
  const coupe = await page.evaluate(() =>
    document.documentElement.classList.contains("mire-sans-raccourcis"),
  );
  verifie("la fiche AIDE coupe les raccourcis", coupe, String(coupe));
  // Tab reste dans la fiche, entre FERMER et RACCOURCIS
  await page.keyboard.press("Tab");
  const dans = await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'));
  verifie("le focus reste dans la fiche", dans, String(dans));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  await page.mouse.move(5, 5);

  await page.keyboard.press("n");
  await page.keyboard.press("?");
  await page.keyboard.press("1");
  await page.waitForTimeout(600);
  const muet = await page.evaluate(() => ({
    negatif: document.documentElement.classList.contains("mire-negative"),
    fiche: !!document.querySelector('[role="dialog"]'),
    chemin: location.pathname,
  }));
  verifie(
    "N, ? et 1 ne font plus rien",
    !muet.negatif && !muet.fiche && muet.chemin === "/",
    JSON.stringify(muet),
  );

  // les fleches restent : feuilleter les projets
  await page.goto(`${BASE}/projet/${SLUGS[0]}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await page.mouse.move(5, 5);
  await page.keyboard.press("ArrowRight");
  await page.waitForURL(`**/projet/${SLUGS[1]}`, { timeout: 5000 }).catch(() => {});
  verifie(
    "la fleche droite feuillette toujours",
    page.url().endsWith(`/projet/${SLUGS[1]}`),
    page.url(),
  );
  await page.reload({ waitUntil: "networkidle" });
  const garde = await page.evaluate(() =>
    document.documentElement.classList.contains("mire-sans-raccourcis"),
  );
  verifie("apres rechargement, les raccourcis restent coupes", garde, String(garde));
  await ctx.close();

  // telephone : le bouton NEGATIF de la console marche toujours, et FIGER y est
  const tel = await navigateur.newContext({
    viewport: { width: 393, height: 852 },
    isMobile: true,
    hasTouch: true,
  });
  await tel.addInitScript(() => localStorage.setItem("mire-raccourcis-coupes", "1"));
  const p2 = await nouvellePage(tel);
  await p2.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await p2.waitForTimeout(1200);
  const console_ = p2.locator('nav[aria-label="Console de navigation"]');
  await console_.locator("button", { hasText: /^NEGATIF$/ }).tap();
  await p2.waitForTimeout(200);
  const neg = await p2.evaluate(() => document.documentElement.classList.contains("mire-negative"));
  verifie("console : NEGATIF marche, raccourcis coupes ou non", neg, String(neg));
  await console_.locator("button", { hasText: /^FIGER$/ }).tap();
  const fige = await p2.evaluate(() => document.documentElement.classList.contains("mire-fige"));
  verifie("console : FIGER fige le site", fige, String(fige));
  const debord = await p2.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  verifie("console a six onglets, aucun debordement", debord === 0, String(debord));
  await tel.close();
  conclure();
});
