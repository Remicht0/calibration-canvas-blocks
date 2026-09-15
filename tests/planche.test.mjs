/**
 * La planche et son cartouche : le creux reserve exactement la place, rien ne
 * saute sous la section, et l'instrument respecte les regles du systeme.
 */
import { after, before, test } from "node:test";
import { chromium } from "playwright-core";
import {
  BASE,
  CAMERA_FACTICE,
  CHROMIUM,
  COMPTE_TRAMES,
  GRANDE_PHOTO,
  capture,
  conclure,
  miroir,
  nouvellePage,
  trames,
  verifie,
} from "./outils.mjs";

let navigateur;
before(async () => {
  navigateur = await chromium.launch({ executablePath: CHROMIUM, args: CAMERA_FACTICE });
});
after(async () => {
  await navigateur?.close();
});

const creux = (p) =>
  p.evaluate(() => {
    const z = document.querySelector('section[data-mire="MIROIR"] .mire-creux');
    return z ? Math.round(z.getBoundingClientRect().height) : -1;
  });

async function aller(p) {
  await p.goto(BASE + "/atelier", { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(2600);
  await miroir(p).scrollIntoViewIfNeeded();
  await p.waitForTimeout(500);
}

test("le creux reserve la hauteur de la planche, cartouche compris", async () => {
  for (const [l, h, nom] of [
    [1440, 900, "1440"],
    [820, 900, "820"],
    [393, 800, "393"],
  ]) {
    const ctx = await navigateur.newContext({
      permissions: ["camera"],
      viewport: { width: l, height: h },
    });
    await ctx.addInitScript(COMPTE_TRAMES);
    const p = await nouvellePage(ctx);
    await aller(p);
    const avant = await creux(p);
    const notesAvant = await p.evaluate(() =>
      Math.round(
        document.querySelector('section[data-mire="NOTES"]').getBoundingClientRect().top +
          window.scrollY,
      ),
    );
    await p.screenshot({ path: capture(`planche-repos-${nom}.png`) });
    await miroir(p).locator("button", { hasText: "OUVRIR LA CAMERA" }).click();
    await p.waitForTimeout(1800);
    const apres = await creux(p);
    const notesApres = await p.evaluate(() =>
      Math.round(
        document.querySelector('section[data-mire="NOTES"]').getBoundingClientRect().top +
          window.scrollY,
      ),
    );
    await p.screenshot({ path: capture(`planche-camera-${nom}.png`) });
    const cellule = l >= 768 ? 20 : 16;
    verifie(
      `${nom} px : le creux egale la planche (premiere ouverture)`,
      Math.abs(avant - apres) < cellule,
      `repos ${avant} / planche ${apres}`,
    );
    verifie(
      `${nom} px : rien ne bouge sous la section`,
      Math.abs(notesAvant - notesApres) < cellule,
      `NOTES ${notesAvant} -> ${notesApres}`,
    );
    await miroir(p).locator("button", { hasText: "FERMER" }).click();
    await p.waitForTimeout(600);
    const retour = await creux(p);
    verifie(
      `${nom} px : retour au creux a la fermeture`,
      Math.abs(retour - apres) <= 3,
      `${apres} -> ${retour}`,
    );
    const debord = await p.evaluate(() => [
      document.documentElement.scrollWidth,
      window.innerWidth,
    ]);
    verifie(`${nom} px : scrollWidth === innerWidth`, debord[0] === debord[1], debord.join(" vs "));
    await ctx.close();
  }
  conclure();
});

test("le creux tient sans JavaScript", async () => {
  for (const [l, h, nom] of [
    [1440, 900, "1440"],
    [393, 800, "393"],
  ]) {
    const sansJs = await navigateur.newContext({
      javaScriptEnabled: false,
      viewport: { width: l, height: h },
    });
    const a = await sansJs.newPage();
    await a.goto(BASE + "/atelier", { waitUntil: "load" });
    await a.waitForTimeout(400);
    const hSsr = await creux(a);
    await sansJs.close();

    const avecJs = await navigateur.newContext({ viewport: { width: l, height: h } });
    const b = await avecJs.newPage();
    await b.goto(BASE + "/atelier", { waitUntil: "domcontentloaded" });
    await b.waitForTimeout(2600);
    const hJs = await creux(b);
    await avecJs.close();
    const cellule = l >= 768 ? 20 : 16;
    verifie(
      `${nom} px : le creux est deja pose au rendu serveur`,
      hSsr > 0 && Math.abs(hSsr - hJs) < cellule,
      `sans JS ${hSsr} / apres mesure ${hJs} (cellule ${cellule})`,
    );
  }
  conclure();
});

test("aucune requete sortante, aucune cle de stockage", async () => {
  const ctx = await navigateur.newContext({
    permissions: ["camera"],
    viewport: { width: 1440, height: 900 },
  });
  await ctx.addInitScript(COMPTE_TRAMES);
  const p = await nouvellePage(ctx);
  const urls = [];
  p.on("request", (r) => urls.push(r.url()));
  await aller(p);
  await miroir(p).locator("button", { hasText: "OUVRIR LA CAMERA" }).click();
  await p.waitForTimeout(1800);
  await miroir(p)
    .locator("button", { hasText: "ENREGISTRER" })
    .click()
    .catch(() => {});
  await p.waitForTimeout(600);
  await p.locator('section[data-mire="MIROIR"] input[type="file"]').setInputFiles(GRANDE_PHOTO);
  await p.waitForTimeout(2500);
  const etrangers = urls.filter(
    (u) => !u.startsWith(BASE) && !u.startsWith("data:") && !u.startsWith("blob:"),
  );
  verifie(
    "aucune requete hors de l'origine",
    etrangers.length === 0,
    etrangers.slice(0, 3).join(" | "),
  );
  const stock = await p.evaluate(async () => ({
    ls: Object.keys(localStorage),
    ss: Object.keys(sessionStorage),
    idb: (await (indexedDB.databases?.() ?? Promise.resolve([]))).map((d) => d.name),
    ck: document.cookie,
  }));
  // mire-boot est pose par la sequence d'entree du site, avant tout miroir
  const cles = [...stock.ls, ...stock.ss.filter((k) => k !== "mire-boot"), ...stock.idb];
  verifie(
    "l'instrument n'ecrit aucune cle de stockage",
    cles.length === 0 && stock.ck === "",
    JSON.stringify(stock),
  );
  await ctx.close();
  conclure();
});

test("mouvement reduit : la planche se pose a l'arret", async () => {
  const ctx = await navigateur.newContext({
    permissions: ["camera"],
    reducedMotion: "reduce",
    viewport: { width: 1440, height: 900 },
  });
  await ctx.addInitScript(COMPTE_TRAMES);
  const p = await nouvellePage(ctx);
  await aller(p);
  await miroir(p).locator("button", { hasText: "OUVRIR LA CAMERA" }).click();
  await p.waitForTimeout(2000);
  const txt = await miroir(p).innerText();
  verifie(
    "sous mouvement reduit la planche se pose a l'arret",
    txt.includes("REPRENDRE"),
    txt.includes("FIGER") ? "elle joue encore (FIGER)" : "REPRENDRE",
  );
  const d0 = await trames(p);
  await p.waitForTimeout(1200);
  const d1 = await trames(p);
  verifie("plus aucune trame echantillonnee", d1 === d0, `${d0} -> ${d1}`);
  const lum = await p.evaluate(() => {
    const cv = document.querySelector('section[data-mire="MIROIR"] canvas');
    const px = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data;
    let s = 0;
    for (let i = 0; i < px.length; i += 4) s += px[i];
    return Math.round(s / (px.length / 4));
  });
  verifie("la trame figee n'est pas noire", lum > 12 && lum < 250, "moyenne " + lum);
  await p.screenshot({ path: capture("planche-reduit-1440.png") });
  await miroir(p).locator("button", { hasText: "REPRENDRE" }).click();
  await p.waitForTimeout(400);
  const d2 = await trames(p);
  await p.waitForTimeout(600);
  const d3 = await trames(p);
  verifie("REPRENDRE relance le direct", d3 > d2, `${d2} -> ${d3}`);
  await ctx.close();
  conclure();
});

test("regles du systeme : pas de soulignement, pas de rouge, pas d'arrondi", async () => {
  const ctx = await navigateur.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await nouvellePage(ctx);
  await p.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(2600);
  const soulignes = await p.evaluate(
    () =>
      [...document.querySelectorAll("main *")].filter((e) =>
        getComputedStyle(e).textDecorationLine.includes("underline"),
      ).length,
  );
  verifie("aucun soulignement dans la page", soulignes === 0, String(soulignes));
  const lien = p.locator('main a[href="/atelier"]', { hasText: "CALIBREZ" }).first();
  verifie(
    "le lien de l'atelier passe par la primitive Bloc",
    await lien.evaluate((e) => e.classList.contains("u-bloc") && e.classList.contains("u-mono")),
  );
  verifie("il est hors du paragraphe", await lien.evaluate((e) => !e.closest("p")));

  await p.goto(BASE + "/atelier", { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(2600);
  const classes = await p.evaluate(() =>
    [...document.querySelectorAll('section[data-mire="MIROIR"] span')]
      .filter((e) =>
        /DEPOSER|ACCES|MEGAPIXELS|LISIBLE|CHOISIR UNE IMAGE CI/.test(e.textContent || ""),
      )
      .map((e) => e.className),
  );
  verifie(
    "le texte courant du creux est en u-copy",
    classes.length > 0 && classes.every((c) => c.includes("u-copy")),
    JSON.stringify(classes),
  );
  const arrondis = await p.evaluate(
    () =>
      [...document.querySelectorAll('section[data-mire="MIROIR"] *')].filter(
        (e) => getComputedStyle(e).borderRadius !== "0px",
      ).length,
  );
  verifie("aucun coin arrondi dans l'instrument", arrondis === 0, String(arrondis));
  const rouges = await p.evaluate(() => {
    const rx = /rgb\(255,\s*0,\s*0\)/;
    return [...document.querySelectorAll('section[data-mire="MIROIR"] *')].filter((e) => {
      const s = getComputedStyle(e);
      return rx.test(s.color) || rx.test(s.backgroundColor) || rx.test(s.borderTopColor);
    }).length;
  });
  verifie("aucun rouge dans l'instrument", rouges === 0, String(rouges));
  await ctx.close();
  conclure();
});

test("pointeur grossier : aucun geste impossible propose", async () => {
  const ctx = await navigateur.newContext({
    permissions: ["camera"],
    viewport: { width: 393, height: 800 },
    hasTouch: true,
    isMobile: true,
  });
  const p = await nouvellePage(ctx);
  await aller(p);
  const txt = await miroir(p).innerText();
  verifie(
    "ni depot ni collage ne sont proposes",
    !txt.includes("DEPOSER") && !txt.includes("CTRL+V"),
    txt.split("\n").slice(0, 4).join(" / "),
  );
  verifie("une alternative reelle est donnee", txt.includes("OU CHOISIR UNE IMAGE CI-DESSOUS"));
  await p.screenshot({ path: capture("planche-tactile-393.png") });
  await ctx.close();
  conclure();
});

test("la ligne de depot tient sur une ligne en bureau", async () => {
  const ctx = await navigateur.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await nouvellePage(ctx);
  await p.goto(BASE + "/atelier", { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(2600);
  const lignes = await p.evaluate(() => {
    const e = [...document.querySelectorAll('section[data-mire="MIROIR"] span')].find((x) =>
      (x.textContent || "").startsWith("OU DEPOSER"),
    );
    if (!e) return -1;
    return Math.round(
      e.getBoundingClientRect().height / parseFloat(getComputedStyle(e).lineHeight),
    );
  });
  verifie("une seule ligne", lignes === 1, "lignes=" + lignes);
  await ctx.close();
  conclure();
});
