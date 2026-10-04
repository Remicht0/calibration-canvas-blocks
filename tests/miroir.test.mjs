/**
 * Instrument 05 MIROIR : cycle de vie de la camera, image locale, trame
 * deterministe, responsive, et les regles du systeme dans l'instrument.
 */
import fs from "node:fs";
import { test } from "node:test";
import { chromium } from "playwright-core";
import {
  BASE,
  CAMERA_FACTICE,
  CAMERA_MIRE,
  CHROMIUM,
  DAMIER,
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

/** Couleurs distinctes dans le canvas de la planche du miroir. */
const analyseCanvas = (page) =>
  page.evaluate(() => {
    const cv = document.querySelector('section[data-mire="MIROIR"] canvas');
    if (!cv) return null;
    const d = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data;
    let couleur = 0;
    let noir = 0;
    let blanc = 0;
    const n = cv.width * cv.height;
    for (let i = 0; i < n; i += 7) {
      const r = d[i * 4];
      const g = d[i * 4 + 1];
      const b = d[i * 4 + 2];
      if (r === 0 && g === 0 && b === 0) noir++;
      else if (r === 255 && g === 255 && b === 255) blanc++;
      else if (r === g && g === b) {
        /* palier de gris quantifie */
      } else couleur++;
    }
    return { w: cv.width, h: cv.height, couleur, noir, blanc, echantillons: Math.ceil(n / 7) };
  });

test("camera factice : ouverture, modes, figer, enregistrer, fermeture", async () => {
  const navigateur = await chromium.launch({ executablePath: CHROMIUM, args: CAMERA_MIRE });
  const ctx = await navigateur.newContext({
    viewport: { width: 1440, height: 900 },
    acceptDownloads: true,
  });
  await ctx.addInitScript(ESPION);
  const page = await nouvellePage(ctx);
  await allerAuMiroir(page);

  verifie("au repos : AUCUNE SOURCE", (await miroir(page).innerText()).includes("AUCUNE SOURCE"));
  verifie(
    "au repos : aucun canvas de planche",
    (await miroir(page).locator("canvas").count()) === 0,
  );
  await miroir(page).screenshot({ path: capture("miroir-01-repos-1440.png") });

  await page.getByRole("button", { name: /ouvrir la caméra/i }).click();
  await page.waitForTimeout(2200);
  verifie("camera ouverte : planche montee", (await miroir(page).locator("canvas").count()) > 0);
  verifie(
    "camera ouverte : etiquette MIROIR / CAMERA",
    (await miroir(page).innerText()).includes("MIROIR / CAMERA"),
  );
  verifie("camera ouverte : piste live", (await etats(page)).includes("live"));

  const gris = await analyseCanvas(page);
  verifie(
    "GRIS : aucun pixel couleur",
    gris.couleur === 0,
    `couleur=${gris.couleur}/${gris.echantillons}`,
  );
  verifie("GRIS : la planche est peinte", gris.w > 100 && gris.h > 100, `${gris.w}x${gris.h}`);
  await miroir(page).screenshot({ path: capture("miroir-02-gris-1440.png") });

  await page.getByRole("button", { name: /^BIN :/i }).click();
  await page.waitForTimeout(700);
  const bin = await analyseCanvas(page);
  verifie("BIN : que du noir et du blanc", bin.couleur === 0, String(bin.couleur));
  verifie(
    "BIN : une vraie trame (les deux valeurs presentes)",
    bin.noir > 20 && bin.blanc > 20,
    `noir=${bin.noir} blanc=${bin.blanc}`,
  );
  await miroir(page).screenshot({ path: capture("miroir-03-bin-1440.png") });

  await page.getByRole("button", { name: /^BRUT :/i }).click();
  await page.waitForTimeout(700);
  const brut = await analyseCanvas(page);
  verifie(
    "BRUT : la mire verte de Chromium passe en couleur",
    brut.couleur > 50,
    `couleur=${brut.couleur}/${brut.echantillons}`,
  );
  await miroir(page).screenshot({ path: capture("miroir-04-brut-1440.png") });

  await page.getByRole("button", { name: /^GRIS :/i }).click();
  await page.waitForTimeout(400);

  await page.getByRole("button", { name: /figer la trame/i }).click();
  await page.waitForTimeout(400);
  verifie("FIGER : le bloc lit DIRECT", (await miroir(page).innerText()).includes("DIRECT"));
  const fige1 = await analyseCanvas(page);
  await page.waitForTimeout(900);
  const fige2 = await analyseCanvas(page);
  verifie(
    "FIGER : la trame ne bouge plus",
    fige1.noir === fige2.noir && fige1.blanc === fige2.blanc,
  );
  await page.getByRole("button", { name: /reprendre le direct/i }).click();
  await page.waitForTimeout(600);

  const attenteTele = page.waitForEvent("download", { timeout: 8000 });
  await page.getByRole("button", { name: /enregistrer la trame/i }).click();
  let pngOk = false;
  let nomFichier = "";
  try {
    const d = await attenteTele;
    nomFichier = d.suggestedFilename();
    const f = capture("miroir-trame.png");
    await d.saveAs(f);
    const b = fs.readFileSync(f);
    pngOk = b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b.length > 500;
  } catch (e) {
    nomFichier = "(aucun telechargement) " + e.message;
  }
  verifie("ENREGISTRER : telechargement d'un PNG", pngOk, nomFichier);
  verifie(
    "ENREGISTRER : nom mire-<horodatage>.png",
    /^mire-\d{8}-\d{6}\.png$/.test(nomFichier),
    nomFichier,
  );

  await page
    .getByRole("button", { name: /plein cadre/i })
    .first()
    .click();
  await page.waitForTimeout(1800);
  const plein = await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"][aria-label="Plein cadre"]');
    if (!d) return null;
    const cv = d.querySelector("canvas");
    if (!cv) return { canvas: false };
    const px = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data;
    let poses = 0;
    for (let i = 0; i < cv.width * cv.height; i += 11) if (px[i * 4 + 3] > 0) poses++;
    return { canvas: true, w: cv.width, h: cv.height, poses };
  });
  verifie(
    "PLEIN CADRE : le flux passe dans la planche du masque",
    plein && plein.canvas && plein.poses > 100,
    JSON.stringify(plein),
  );
  verifie(
    "PLEIN CADRE : une seule acquisition vivante",
    (await etats(page)).filter((s) => s === "live").length === 1,
  );
  await page.screenshot({ path: capture("miroir-05-plein-cadre-1440.png") });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(1200);

  await page.getByRole("button", { name: /fermer la source/i }).click();
  await page.waitForTimeout(600);
  const apres = await etats(page);
  verifie(
    "FERMER : toutes les pistes sont ended",
    apres.length > 0 && apres.every((s) => s === "ended"),
    JSON.stringify(apres),
  );
  verifie(
    "FERMER : retour a AUCUNE SOURCE",
    (await miroir(page).innerText()).includes("AUCUNE SOURCE"),
  );

  /* --- onglet cache --- */
  await page.getByRole("button", { name: /ouvrir la caméra/i }).click();
  await page.waitForTimeout(1600);
  verifie("relance : une nouvelle piste vivante", (await etats(page)).includes("live"));
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForTimeout(500);
  verifie(
    "ONGLET CACHE : les pistes sont arretees",
    (await etats(page)).every((s) => s === "ended"),
  );
  verifie(
    "ONGLET CACHE : la mire dit CAMERA ARRETEE",
    (await miroir(page).innerText()).includes("CAMERA ARRETEE"),
  );
  await page.evaluate(() => {
    delete document.hidden;
    delete document.visibilityState;
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForTimeout(300);

  /* --- sortie d'ecran (hysteresis 1 s) --- */
  await page.getByRole("button", { name: /ouvrir la caméra/i }).click();
  await page.waitForTimeout(1600);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(600);
  verifie(
    "SORTIE D'ECRAN : la camera tourne encore a 600 ms",
    (await etats(page)).includes("live"),
  );
  await page.waitForTimeout(1400);
  verifie(
    "SORTIE D'ECRAN : les pistes sont arretees apres 1 s",
    (await etats(page)).every((s) => s === "ended"),
  );

  /* --- changement de route --- */
  await miroir(page).scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: /ouvrir la caméra/i }).click();
  await page.waitForTimeout(1600);
  await page.evaluate(() => {
    [...document.querySelectorAll("a")].find((x) => x.getAttribute("href") === "/contact")?.click();
  });
  await page.waitForTimeout(900);
  const apresRoute = await etats(page);
  verifie(
    "CHANGEMENT DE ROUTE : les pistes sont arretees",
    apresRoute.length > 0 && apresRoute.every((s) => s === "ended"),
    JSON.stringify(apresRoute),
  );

  verifie(
    "aucune erreur console",
    page.erreurs.length === 0,
    page.erreurs.join(" | ").slice(0, 300),
  );
  await navigateur.close();
  conclure();
});

test("refus de permission : la mire le dit dans sa langue", async () => {
  const navigateur = await chromium.launch({
    executablePath: CHROMIUM,
    args: ["--no-sandbox", "--use-fake-device-for-media-stream"],
  });
  const ctx = await navigateur.newContext({ viewport: { width: 1440, height: 900 } });
  // le seul refus qui tienne : une liste vide declaree avant tout appel
  await ctx.grantPermissions([], { origin: BASE });
  await ctx.addInitScript(ESPION);
  const page = await nouvellePage(ctx);
  await allerAuMiroir(page);

  await page.getByRole("button", { name: /ouvrir la caméra/i }).click();
  await page.waitForTimeout(1500);
  const txt = await miroir(page).innerText();
  verifie("SIGNAL REFUSE a l'ecran", txt.includes("SIGNAL REFUSE"), txt.split("\n")[0]);
  verifie(
    "le choix d'une image reste propose",
    /LE CHOIX D.UNE IMAGE RESTE POSSIBLE/.test(txt),
    txt.slice(0, 120),
  );
  verifie(
    "aucun message brut du navigateur",
    !/permission denied/i.test(txt) && !/NotAllowedError/.test(txt),
  );
  verifie("le bloc CHOISIR UNE IMAGE est toujours la", txt.includes("CHOISIR UNE IMAGE"));
  await miroir(page).screenshot({ path: capture("miroir-06-refus-1440.png") });
  verifie(
    "aucune erreur console",
    page.erreurs.length === 0,
    page.erreurs.join(" | ").slice(0, 300),
  );
  await navigateur.close();
  conclure();
});

test("image locale : fichier, depot, collage, fichier illisible", async () => {
  const navigateur = await chromium.launch({ executablePath: CHROMIUM, args: CAMERA_MIRE });
  const ctx = await navigateur.newContext({
    viewport: { width: 1440, height: 900 },
    permissions: ["clipboard-read", "clipboard-write"],
  });
  await ctx.addInitScript(ESPION);
  const page = await nouvellePage(ctx);
  const reseau = [];
  page.on("request", (r) => {
    const u = r.url();
    if (u.startsWith(BASE) || u.startsWith("data:") || u.startsWith("blob:")) return;
    reseau.push(u);
  });
  await allerAuMiroir(page);

  await page.locator('section[data-mire="MIROIR"] input[type=file]').setInputFiles(photo("p1.jpg"));
  await page.waitForTimeout(1800);
  const txt = await miroir(page).innerText();
  verifie("fichier : la planche est montee", (await miroir(page).locator("canvas").count()) > 0);
  verifie("fichier : etiquette MIROIR / P1", txt.includes("MIROIR / P1"));
  verifie("fichier : SOURCE lit le nom du fichier", /SOURCE\s+P1/.test(txt.replace(/\n/g, " ")));
  const im = await analyseCanvas(page);
  verifie(
    "fichier : la planche est peinte",
    im && im.w > 100,
    JSON.stringify(im && { w: im.w, h: im.h }),
  );
  verifie("fichier : aucune couleur en GRIS", im.couleur === 0, String(im.couleur));
  verifie("fichier : aucune CAMERA SUIVANTE sur une image", !txt.includes("CAMERA SUIVANTE"));
  verifie("fichier : aucun flux ouvert", (await page.evaluate(() => window.__flux.length)) === 0);
  await miroir(page).screenshot({ path: capture("miroir-07-image-1440.png") });

  /* --- depot par glisser-deposer --- */
  await page.getByRole("button", { name: /fermer l'image/i }).click();
  await page.waitForTimeout(400);
  const b64 = fs.readFileSync(photo("p2.jpg")).toString("base64");
  await page.evaluate(async (data) => {
    const blob = await (await fetch("data:image/jpeg;base64," + data)).blob();
    const dt = new DataTransfer();
    dt.items.add(new File([blob], "depose.jpg", { type: "image/jpeg" }));
    const cible = document.querySelector('section[data-mire="MIROIR"] > div > div');
    cible.dispatchEvent(
      new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: dt }),
    );
    cible.dispatchEvent(
      new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt }),
    );
  }, b64);
  await page.waitForTimeout(1600);
  verifie(
    "depot : la planche prend le fichier depose",
    (await miroir(page).innerText()).includes("MIROIR / DEPOSE"),
    (await miroir(page).innerText()).split("\n").find((l) => l.includes("MIROIR")) ?? "",
  );

  /* --- collage : vrai presse-papiers, vraie frappe --- */
  await page.getByRole("button", { name: /fermer l'image/i }).click();
  await page.waitForTimeout(400);
  await miroir(page).scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  const png = fs.readFileSync(DAMIER).toString("base64");
  await page.evaluate(async (data) => {
    const blob = await (await fetch("data:image/png;base64," + data)).blob();
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
  }, png);
  await page.keyboard.press("Control+V");
  await page.waitForTimeout(1600);
  verifie(
    "collage : la planche prend l'image du presse-papiers",
    (await miroir(page).locator("canvas").count()) > 0,
    (await miroir(page).innerText()).split("\n").find((l) => l.includes("MIROIR")) ?? "",
  );

  /* --- fichier illisible --- */
  await page.getByRole("button", { name: /fermer l'image/i }).click();
  await page.waitForTimeout(400);
  await page.locator('section[data-mire="MIROIR"] input[type=file]').setInputFiles({
    name: "faux.png",
    mimeType: "image/png",
    buffer: Buffer.from("ceci n'est pas une image"),
  });
  await page.waitForTimeout(900);
  verifie(
    "fichier menteur : FICHIER ILLISIBLE",
    (await miroir(page).innerText()).includes("FICHIER ILLISIBLE"),
  );
  await miroir(page).screenshot({ path: capture("miroir-08-illisible-1440.png") });

  verifie("aucune requete reseau vers un tiers", reseau.length === 0, reseau.slice(0, 3).join(" "));
  const stock = await page.evaluate(() => {
    const tout = [];
    for (const st of [localStorage, sessionStorage])
      for (let i = 0; i < st.length; i++)
        tout.push(st.key(i) + "=" + String(st.getItem(st.key(i))).slice(0, 40));
    return tout;
  });
  // seule cle du site : le drapeau de sequence d'entree, pose avant le miroir
  verifie(
    "aucune image ni empreinte d'image en stockage",
    stock.every((e) => e.startsWith("mire-boot") && e.length < 20),
    stock.join(" ; "),
  );
  verifie(
    "aucune erreur console",
    page.erreurs.length === 0,
    page.erreurs.join(" | ").slice(0, 300),
  );
  await navigateur.close();
  conclure();
});

test("bobine y4m : trame binaire deterministe", async () => {
  const navigateur = await chromium.launch({ executablePath: CHROMIUM, args: CAMERA_FACTICE });
  const ctx = await navigateur.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(ESPION);
  const page = await nouvellePage(ctx);
  await allerAuMiroir(page);
  await page.getByRole("button", { name: /ouvrir la caméra/i }).click();
  await page.waitForTimeout(2200);
  await page.getByRole("button", { name: /^BIN :/i }).click();
  await page.waitForTimeout(700);
  const a = await analyseCanvas(page);
  verifie(
    "trame binaire nette",
    a.couleur === 0 && a.noir > 100 && a.blanc > 100,
    `noir=${a.noir} blanc=${a.blanc} couleur=${a.couleur}`,
  );
  const texte = await miroir(page).innerText();
  verifie("ENCRE est mesuree", /ENCRE/.test(texte));
  verifie(
    "aucun libelle de peripherique a l'ecran",
    !/\.y4m/i.test(texte) && !/fake_device/i.test(texte),
  );
  await miroir(page).screenshot({ path: capture("miroir-09-y4m-bin-1440.png") });
  await navigateur.close();
  conclure();
});

test("responsive 393 / 820 / 1440", async () => {
  const navigateur = await chromium.launch({ executablePath: CHROMIUM, args: CAMERA_MIRE });
  for (const [l, h] of [
    [393, 852],
    [820, 1180],
    [1440, 900],
  ]) {
    const ctx = await navigateur.newContext({ viewport: { width: l, height: h } });
    await ctx.addInitScript(ESPION);
    const page = await nouvellePage(ctx);
    await allerAuMiroir(page);
    const repos = await page.evaluate(() => [
      document.documentElement.scrollWidth,
      window.innerWidth,
    ]);
    verifie(`${l} px : aucun debordement au repos`, repos[0] === repos[1], repos.join(" / "));
    await miroir(page).screenshot({ path: capture(`miroir-10-repos-${l}.png`) });

    await page.getByRole("button", { name: /ouvrir la caméra/i }).click();
    await page.waitForTimeout(2000);
    await miroir(page).scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    const cam = await page.evaluate(() => [
      document.documentElement.scrollWidth,
      window.innerWidth,
    ]);
    verifie(`${l} px : aucun debordement, camera ouverte`, cam[0] === cam[1], cam.join(" / "));
    const grille = await page.evaluate(() => {
      const cv = document.querySelector('section[data-mire="MIROIR"] canvas');
      if (!cv) return null;
      const cellule = window.innerWidth < 768 ? 16 : 20;
      return {
        w: parseFloat(cv.style.width),
        cellule,
        reste: parseFloat(cv.style.width) % cellule,
      };
    });
    verifie(
      `${l} px : le canvas est un multiple exact de la cellule`,
      grille && grille.reste === 0,
      JSON.stringify(grille),
    );
    await miroir(page).screenshot({ path: capture(`miroir-11-camera-${l}.png`) });
    verifie(
      `${l} px : aucune erreur console`,
      page.erreurs.length === 0,
      page.erreurs.join(" | ").slice(0, 200),
    );
    await ctx.close();
  }
  await navigateur.close();
  conclure();
});

test("systeme de design dans l'instrument", async () => {
  const navigateur = await chromium.launch({ executablePath: CHROMIUM, args: CAMERA_MIRE });
  const ctx = await navigateur.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(ESPION);
  const page = await nouvellePage(ctx);
  await allerAuMiroir(page);
  await page.getByRole("button", { name: /ouvrir la caméra/i }).click();
  await page.waitForTimeout(2000);

  const styles = await page.evaluate(() => {
    const mauvais = [];
    for (const el of document.querySelectorAll('section[data-mire="MIROIR"] *')) {
      const s = getComputedStyle(el);
      if (s.borderTopLeftRadius !== "0px")
        mauvais.push("radius " + el.tagName + " " + s.borderTopLeftRadius);
      if (s.boxShadow !== "none") mauvais.push("ombre " + el.tagName);
      if (s.transitionDuration !== "0s")
        mauvais.push("transition " + el.tagName + " " + s.transitionDuration);
      if (/gradient/.test(s.backgroundImage)) mauvais.push("degrade " + el.tagName);
      for (const p of ["color", "backgroundColor", "borderTopColor"]) {
        const m = s[p].match(/rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?\)/);
        if (!m) continue;
        const [r, g, b] = [+m[1], +m[2], +m[3]];
        const a = m[4] === undefined ? 1 : parseFloat(m[4]);
        if (a !== 0 && a !== 1) mauvais.push("alpha " + p + " " + s[p] + " " + el.tagName);
        if (a !== 0 && !(r === g && g === b))
          mauvais.push("couleur " + p + " " + s[p] + " " + el.tagName);
      }
    }
    return mauvais;
  });
  verifie(
    "aucun radius / ombre / transition / degrade / couleur",
    styles.length === 0,
    styles.slice(0, 4).join(" ; "),
  );

  const libelles = await page.evaluate(() => {
    const mauvais = [];
    for (const el of document.querySelectorAll(
      'section[data-mire="MIROIR"] .u-mono, section[data-mire="MIROIR"] .u-copy, section[data-mire="MIROIR"] .u-bloc, section[data-mire="MIROIR"] h2',
    )) {
      if (el.querySelector(".u-mono, .u-copy, .u-bloc")) continue;
      const txt = [...el.childNodes]
        .filter((n) => n.nodeType === 3)
        .map((n) => n.textContent)
        .join("")
        .trim();
      if (txt && /[a-zàâäéèêëîïôöùûüç]/.test(txt)) mauvais.push(txt.slice(0, 40));
    }
    return mauvais;
  });
  verifie(
    "tout le texte visible est en capitales sans accents",
    libelles.length === 0,
    libelles.slice(0, 3).join(" ; "),
  );

  const noms = await page.evaluate(() => {
    const sans = [];
    for (const b of document.querySelectorAll(
      'section[data-mire="MIROIR"] button, section[data-mire="MIROIR"] label',
    )) {
      // un <label> prete son nom au controle qu'il enveloppe : c'est la que le nom vit
      const porteur = b.tagName === "LABEL" ? (b.querySelector("input, select, textarea") ?? b) : b;
      const l = porteur.getAttribute("aria-label");
      if (!l) sans.push(b.textContent.trim().slice(0, 24) + " (sans aria-label)");
      else if (l === l.toUpperCase() && /[A-Z]{3}/.test(l)) sans.push(l + " (en capitales)");
    }
    return sans;
  });
  verifie(
    "chaque commande a un nom accessible accentue en bas de casse",
    noms.length === 0,
    noms.slice(0, 3).join(" ; "),
  );

  await page.keyboard.press("n");
  await page.waitForTimeout(500);
  await miroir(page).screenshot({ path: capture("miroir-12-negatif-1440.png") });
  verifie(
    "NEGATIF : la classe est posee",
    await page.evaluate(() => document.documentElement.classList.contains("mire-negative")),
  );
  await page.keyboard.press("n");
  await page.waitForTimeout(300);

  verifie(
    "aucune erreur console",
    page.erreurs.length === 0,
    page.erreurs.join(" | ").slice(0, 300),
  );
  await navigateur.close();
  conclure();
});
