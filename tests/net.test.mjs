/**
 * Lecture NET : sur une planche de projet, le visiteur peut voir l'image
 * d'origine, nette et dans ses couleurs, a la place des blocs. Elle n'est
 * jamais la lecture par defaut, elle n'existe pas sur les instruments de
 * l'atelier, elle suit la planche en plein cadre et garde ses couleurs sous
 * le negatif.
 *
 * Aucun nom de projet en dur : les slugs sont lus dans la source.
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

const PLANCHES =
  'main section:is([data-mire="PLANCHE 01"], [data-mire="SIGNAL"], [data-mire="PLANCHES"]) figure';

/**
 * Part des cellules dont les pixels ne sont pas tous de la meme couleur.
 * En blocs, chaque cellule est un seul remplissage : exactement 0. En NET,
 * l'image passe sous la grille : toute cellule qui porte un bord ou une trame
 * varie (un logo en aplats en garde peu, un dixieme environ ; une photo, la
 * plupart). Au-dessus de 5 %, ce n'est plus une grille de blocs.
 */
const detail = (page, selecteur) =>
  page.evaluate((sel) => {
    const cv = document.querySelector(sel);
    if (!cv || !cv.width) return -1;
    const cell = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--cell"));
    const k = cv.width / parseFloat(cv.style.width);
    const pas = Math.round(cell * k);
    const cols = Math.floor(cv.width / pas);
    const rows = Math.floor(cv.height / pas);
    const d = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data;
    let variees = 0;
    let n = 0;
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < cols; x++) {
        n++;
        const o = (y * pas * cv.width + x * pas) * 4;
        let diff = false;
        // un echantillon de pixels dans la cellule, bords compris
        for (let j = 0; j < pas && !diff; j += Math.max(1, Math.floor(pas / 5)))
          for (let i = 0; i < pas && !diff; i += Math.max(1, Math.floor(pas / 5))) {
            const q = ((y * pas + j) * cv.width + x * pas + i) * 4;
            if (
              Math.abs(d[q] - d[o]) > 8 ||
              Math.abs(d[q + 1] - d[o + 1]) > 8 ||
              Math.abs(d[q + 2] - d[o + 2]) > 8
            )
              diff = true;
          }
        if (diff) variees++;
      }
    return n ? variees / n : -1;
  }, selecteur);

const lectures = (page) =>
  page.evaluate((sel) => {
    return [...document.querySelectorAll(sel)].map((f) => {
      const groupe = f.querySelector('[aria-label="Mode de lecture"]');
      const boutons = [...(groupe?.querySelectorAll("button") ?? [])];
      return {
        lecture: f.querySelector("canvas")?.dataset.lecture ?? "",
        net:
          boutons.find((b) => b.textContent?.trim() === "NET")?.getAttribute("aria-pressed") ??
          null,
        presse:
          boutons.find((b) => b.getAttribute("aria-pressed") === "true")?.textContent?.trim() ?? "",
      };
    });
  }, PLANCHES);

test("chaque planche de projet propose NET, jamais par defaut", async () => {
  const ctx = await navigateur.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await nouvellePage(ctx);
  for (const slug of SLUGS) {
    await page.goto(`${BASE}/projet/${slug}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(800);
    const l = await lectures(page);
    verifie(`/projet/${slug} : des planches`, l.length > 0, String(l.length));
    verifie(
      `/projet/${slug} : un bouton NET sur chaque planche, non presse`,
      l.every((p) => p.net === "false"),
      JSON.stringify(l.map((p) => p.net)),
    );
    verifie(
      `/projet/${slug} : chaque planche s'ouvre en blocs`,
      l.every(
        (p) => ["bin", "gris", "brut"].includes(p.lecture) && p.presse === p.lecture.toUpperCase(),
      ),
      l.map((p) => `${p.lecture}/${p.presse}`).join(" "),
    );
  }
  verifie("console vide", page.erreurs.length === 0, page.erreurs.join(" | ").slice(0, 200));
  await ctx.close();
  conclure();
});

test("NET montre l'image nette, sans reglage de blocs, et la suit en plein cadre", async () => {
  const ctx = await navigateur.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await nouvellePage(ctx);
  for (const slug of SLUGS) {
    await page.goto(`${BASE}/projet/${slug}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1600);
    const fig = page.locator('section[data-mire="PLANCHE 01"] figure');
    const cv = 'section[data-mire="PLANCHE 01"] figure canvas';
    const avant = await detail(page, cv);
    verifie(`${slug} : en blocs, chaque cellule est d'un seul tenant`, avant === 0, String(avant));
    await fig.locator("button", { hasText: /^NET$/ }).click();
    await page.waitForTimeout(150);
    const apres = await detail(page, cv);
    const etat = await page.evaluate(() => {
      const f = document.querySelector('section[data-mire="PLANCHE 01"] figure');
      return {
        lecture: f.querySelector("canvas").dataset.lecture,
        reglage: !!f.querySelector('[aria-label="Réglage de la planche"]'),
        annonce: f.querySelector('[aria-live="polite"]')?.textContent ?? "",
      };
    });
    verifie(
      `${slug} : NET dessine l'image sous la grille`,
      etat.lecture === "net" && apres > 0.05,
      `${etat.lecture} ${apres.toFixed(2)}`,
    );
    verifie(`${slug} : NET n'a ni seuil ni paliers`, !etat.reglage, String(etat.reglage));
    verifie(
      `${slug} : NET est annonce au lecteur d'ecran`,
      /nette/.test(etat.annonce),
      etat.annonce,
    );

    // les raccourcis de reglage ne font rien en NET
    await fig.hover();
    await page.keyboard.press("+");
    await page.keyboard.press("a");
    const toujours = await page.evaluate(
      () => document.querySelector('section[data-mire="PLANCHE 01"] figure canvas').dataset.lecture,
    );
    verifie(`${slug} : + et A laissent la planche en NET`, toujours === "net", toujours);

    // plein cadre : la meme lecture, nette a la taille de l'ecran
    await page.keyboard.press("f");
    await page.waitForTimeout(1300);
    const plein = '[role="dialog"][aria-label="Plein cadre"] canvas';
    const pleinLecture = await page.evaluate(
      (s) => document.querySelector(s)?.dataset.lecture ?? "",
      plein,
    );
    const pleinDetail = await detail(page, plein);
    verifie(
      `${slug} : le plein cadre s'ouvre en NET, net`,
      pleinLecture === "net" && pleinDetail > 0.05,
      `${pleinLecture} ${pleinDetail.toFixed(2)}`,
    );
    await page.keyboard.press("Escape");
    await page.waitForTimeout(900);
    const ferme = await page.evaluate(() => ({
      dialogue: !!document.querySelector('[role="dialog"][aria-label="Plein cadre"]'),
      focus: document.activeElement?.textContent?.trim() ?? "",
    }));
    verifie(
      `${slug} : ESC ferme le plein cadre, le focus revient a PLEIN`,
      !ferme.dialogue && /^PLEIN/.test(ferme.focus),
      JSON.stringify(ferme),
    );

    // retour aux blocs : la grille revient, d'un seul tenant
    await fig.locator("button", { hasText: /^BIN$/ }).click();
    await page.waitForTimeout(150);
    const retour = await detail(page, cv);
    verifie(`${slug} : BIN rend les blocs`, retour === 0, String(retour));
  }
  verifie("console vide", page.erreurs.length === 0, page.erreurs.join(" | ").slice(0, 200));
  await ctx.close();
  conclure();
});

test("NET garde ses couleurs sous le negatif, et n'est pas retenu d'une visite a l'autre", async () => {
  const ctx = await navigateur.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await nouvellePage(ctx);
  await page.goto(`${BASE}/projet/${SLUGS[0]}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  const fig = page.locator('section[data-mire="PLANCHE 01"] figure');
  await fig.locator("button", { hasText: /^NET$/ }).click();
  await page.evaluate(() => document.body.focus());
  await page.mouse.move(5, 5);
  await page.keyboard.press("n");
  await page.waitForTimeout(200);
  const f = await page.evaluate(() => {
    const net = document.querySelector('canvas[data-lecture="net"]');
    const bloc = document.querySelector('canvas[data-lecture]:not([data-lecture="net"])');
    return {
      negatif: document.documentElement.classList.contains("mire-negative"),
      net: net ? getComputedStyle(net).filter : "",
      bloc: bloc ? getComputedStyle(bloc).filter : "",
    };
  });
  verifie(
    "sous le negatif, la planche NET est inversee une seconde fois, les blocs non",
    f.negatif && f.net === "invert(1)" && f.bloc === "none",
    JSON.stringify(f),
  );
  await page.keyboard.press("n");
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  const l = await lectures(page);
  verifie(
    "apres rechargement, aucune planche n'est en NET",
    l.every((p) => p.lecture !== "net" && p.net === "false"),
    l.map((p) => p.lecture).join(" "),
  );
  await ctx.close();
  conclure();
});

test("NET en tactile : visible, cliquable, sans debordement", async () => {
  const ctx = await navigateur.newContext({
    viewport: { width: 393, height: 852 },
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 2,
  });
  const page = await nouvellePage(ctx);
  for (const slug of SLUGS) {
    await page.goto(`${BASE}/projet/${slug}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1200);
    const fig = page.locator('section[data-mire="PLANCHE 01"] figure');
    await fig.locator("button", { hasText: /^NET$/ }).tap();
    await page.waitForTimeout(150);
    const r = await page.evaluate(() => ({
      lecture: document.querySelector('section[data-mire="PLANCHE 01"] figure canvas').dataset
        .lecture,
      debord: document.documentElement.scrollWidth - window.innerWidth,
      indice:
        document.querySelector('section[data-mire="PLANCHE 01"] h2')?.parentElement?.textContent ??
        "",
    }));
    const net = await detail(page, 'section[data-mire="PLANCHE 01"] figure canvas');
    verifie(
      `393 ${slug} : NET au doigt, image nette`,
      r.lecture === "net" && net > 0.05,
      `${r.lecture} ${net.toFixed(2)}`,
    );
    verifie(`393 ${slug} : aucun debordement`, r.debord === 0, String(r.debord));
    verifie(
      `393 ${slug} : l'en-tete de la planche 01 nomme NET`,
      /NET = IMAGE NETTE/.test(r.indice),
      r.indice,
    );
  }
  verifie("console vide", page.erreurs.length === 0, page.erreurs.join(" | ").slice(0, 200));
  await ctx.close();
  conclure();
});

test("NET n'existe que sur les images de projet", async () => {
  const ctx = await navigateur.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await nouvellePage(ctx);
  await page.goto(`${BASE}/atelier`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const atelier = await page.evaluate(
    () =>
      [...document.querySelectorAll("main button")].filter((b) => b.textContent?.trim() === "NET")
        .length,
  );
  verifie("atelier : aucun bouton NET sur les instruments", atelier === 0, String(atelier));
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const banc = await page.evaluate(() => {
    const figs = [...document.querySelectorAll("main figure")];
    return {
      planches: figs.length,
      net: figs.filter((f) =>
        [...f.querySelectorAll("button")].some((b) => b.textContent?.trim() === "NET"),
      ).length,
    };
  });
  verifie(
    "accueil : chaque planche du banc d'essai (des images de projet) propose NET",
    banc.planches > 0 && banc.net === banc.planches,
    JSON.stringify(banc),
  );
  verifie("console vide", page.erreurs.length === 0, page.erreurs.join(" | ").slice(0, 200));
  await ctx.close();
  conclure();
});
