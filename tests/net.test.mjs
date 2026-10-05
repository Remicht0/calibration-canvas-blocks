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

test("sous le negatif, les marges d'une planche NET prennent le papier inverse", async () => {
  const ctx = await navigateur.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await nouvellePage(ctx);
  let vides = 0;
  for (const slug of SLUGS) {
    await page.goto(`${BASE}/projet/${slug}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1200);
    const fig = page.locator('section[data-mire="PLANCHE 01"] figure');
    await fig.locator("button", { hasText: /^NET$/ }).click();
    await page.mouse.move(5, 5);
    if (!(await page.evaluate(() => document.documentElement.classList.contains("mire-negative"))))
      await page.keyboard.press("n");
    await page.waitForTimeout(250);
    const cv = fig.locator("canvas[data-lecture]");
    const png = (await cv.screenshot()).toString("base64");
    // ce que montre l'ecran, la ou la planche ne peint rien (alpha 0)
    const r = await page.evaluate(async (b64) => {
      const cv = document.querySelector(
        'section[data-mire="PLANCHE 01"] figure canvas[data-lecture]',
      );
      const src = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data;
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = cv.width;
      c.height = cv.height;
      const x = c.getContext("2d");
      x.drawImage(img, 0, 0, cv.width, cv.height);
      const ecran = x.getImageData(0, 0, cv.width, cv.height).data;
      let vides = 0;
      let blancs = 0;
      for (let i = 0; i < src.length; i += 4 * 7) {
        if (src[i + 3] !== 0) continue;
        vides++;
        if (ecran[i] > 128 && ecran[i + 1] > 128 && ecran[i + 2] > 128) blancs++;
      }
      return { vides, blancs };
    }, png);
    vides += r.vides;
    verifie(`${slug} : aucune marge blanche sur la page noire`, r.blancs === 0, JSON.stringify(r));
  }
  // au moins une planche 01 n'a pas le format de son cadre : ses marges existent
  verifie("des marges transparentes ont bien ete mesurees", vides > 0, String(vides));
  await ctx.close();
  conclure();
});

test("NET sur telephone : resolution de l'ecran (3x) et pincement pour agrandir", async () => {
  const ctx = await navigateur.newContext({
    viewport: { width: 393, height: 852 },
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 3,
  });
  const page = await nouvellePage(ctx);
  await page.goto(`${BASE}/projet/${SLUGS[SLUGS.length - 1]}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  const fig = page.locator('section[data-mire="PLANCHE 01"] figure');
  await fig.locator("button", { hasText: /^NET$/ }).tap();
  await page.waitForTimeout(200);
  const r = await page.evaluate(() => {
    const cv = document.querySelector(
      'section[data-mire="PLANCHE 01"] figure canvas[data-lecture]',
    );
    const h = document.querySelector('section[data-mire="PLANCHE 01"] h2')?.parentElement;
    return {
      echelle: cv.width / parseFloat(cv.style.width),
      toucher: getComputedStyle(cv).touchAction,
      loupe: [...(h?.querySelectorAll("span") ?? [])].some(
        (s) =>
          s.textContent?.trim() === "APPUI LONG = LOUPE" && s.getBoundingClientRect().width > 0,
      ),
    };
  });
  verifie("dsf 3 : la planche NET est dessinee a 3x", r.echelle === 3, String(r.echelle));
  verifie(
    "393 : l'en-tete de la planche 01 dit encore APPUI LONG = LOUPE",
    r.loupe,
    String(r.loupe),
  );
  verifie("en NET, le canvas laisse pincer", r.toucher === "manipulation", r.toucher);

  const box = await fig.locator("canvas[data-lecture]").boundingBox();
  const cdp = await ctx.newCDPSession(page);
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const doigts = (e) => [
    { x: cx - 20 - e, y: cy, id: 0 },
    { x: cx + 20 + e, y: cy, id: 1 },
  ];
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: doigts(0) });
  for (let s = 1; s <= 12; s++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: doigts(s * 10) });
    await page.waitForTimeout(16);
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.waitForTimeout(400);
  const zoom = await page.evaluate(() => window.visualViewport?.scale ?? 1);
  verifie("en NET, le pincement agrandit l'image", zoom > 1, String(zoom));
  verifie("console vide", page.erreurs.length === 0, page.erreurs.join(" | ").slice(0, 200));
  await ctx.close();
  conclure();
});

test("telephone : apres NET, le doigt reste sur NET, jamais sur PLEIN", async () => {
  for (const [l, h] of [
    [393, 852],
    [360, 740],
  ]) {
    const ctx = await navigateur.newContext({
      viewport: { width: l, height: h },
      hasTouch: true,
      isMobile: true,
      deviceScaleFactor: 3,
    });
    const page = await nouvellePage(ctx);
    for (const slug of SLUGS) {
      await page.goto(`${BASE}/projet/${slug}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(1000);
      const net = page
        .locator('section[data-mire="PLANCHE 01"] figure')
        .locator("button", { hasText: /^NET$/ });
      // au milieu de l'ecran : jamais sous la console du bas
      await net.evaluate((el) => el.scrollIntoView({ block: "center" }));
      await page.waitForTimeout(100);
      const b = await net.boundingBox();
      const x = b.x + b.width / 2;
      const y = b.y + b.height / 2;
      await page.touchscreen.tap(x, y);
      await page.waitForTimeout(150);
      const sous = await page.evaluate(
        ([px, py]) => {
          const el = document.elementFromPoint(px, py)?.closest("button");
          return el?.textContent?.trim() ?? "";
        },
        [x, y],
      );
      verifie(`${l} ${slug} : sous le doigt, toujours NET`, sous === "NET", sous);
    }
    await ctx.close();
  }
  conclure();
});

test("une fenetre qui change d'ecran (resolution) redessine la planche a la bonne echelle", async () => {
  const ctx = await navigateur.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await nouvellePage(ctx);
  const cdp = await ctx.newCDPSession(page);
  // meme taille, autre resolution : rien pour le ResizeObserver
  const ecran = (dsf) =>
    cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 1440,
      height: 900,
      deviceScaleFactor: dsf,
      mobile: false,
    });
  for (const slug of SLUGS) {
    await ecran(2);
    await page.goto(`${BASE}/projet/${slug}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    const fig = page.locator('section[data-mire="PLANCHE 01"] figure');
    await fig.locator("button", { hasText: /^NET$/ }).click();
    for (const dsf of [3, 1, 2]) {
      await ecran(dsf);
      await page.waitForTimeout(400);
      // un redessin apres le changement (ici GRIS puis NET) : c'est la qu'un
      // bitmap reste a l'ancienne echelle decalerait l'image
      await fig.locator("button", { hasText: /^GRIS$/ }).click();
      await fig.locator("button", { hasText: /^NET$/ }).click();
      await page.waitForTimeout(100);
      const r = await page.evaluate(() => {
        const cv = document.querySelector(
          'section[data-mire="PLANCHE 01"] figure canvas[data-lecture]',
        );
        const k = cv.width / parseFloat(cv.style.width);
        // l'image contenue est centree : ses marges se repondent, au pixel pres
        const d = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data;
        let x0 = cv.width;
        let x1 = -1;
        let y0 = cv.height;
        let y1 = -1;
        for (let y = 0; y < cv.height; y += 2)
          for (let x = 0; x < cv.width; x += 2)
            if (d[(y * cv.width + x) * 4 + 3] > 0) {
              if (x < x0) x0 = x;
              if (x > x1) x1 = x;
              if (y < y0) y0 = y;
              if (y > y1) y1 = y;
            }
        return {
          k,
          dpr: window.devicePixelRatio,
          gauche: x0,
          droite: cv.width - 1 - x1,
          haut: y0,
          bas: cv.height - 1 - y1,
        };
      });
      verifie(
        `${slug} ecran ${dsf}x : le bitmap suit la resolution (plafond 3x)`,
        r.k === Math.min(r.dpr, 3),
        JSON.stringify(r),
      );
      verifie(
        `${slug} ecran ${dsf}x : l'image reste entiere et centree`,
        Math.abs(r.gauche - r.droite) <= 3 * r.k + 2 && Math.abs(r.haut - r.bas) <= 3 * r.k + 2,
        JSON.stringify(r),
      );
    }
  }
  verifie("console vide", page.erreurs.length === 0, page.erreurs.join(" | ").slice(0, 200));
  await ctx.close();
  conclure();
});
