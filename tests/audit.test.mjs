/**
 * Audit global : la checklist de DESIGN.md section 8, l'accessibilite, la
 * navigation au clavier, les cartes de partage en navigation client et le
 * mouvement reduit — sur 3 largeurs et 5 routes.
 */
import { after, before, test } from "node:test";
import { chromium } from "playwright-core";
import { BASE, CAMERA_MIRE, CHROMIUM, capture, conclure, verifie } from "./outils.mjs";

const ROUTES = ["/", "/projet/tmc", "/atelier", "/contact", "/inconnue"];
const LARGEURS = [
  [393, 852],
  [820, 1180],
  [1440, 900],
];

let navigateur;
before(async () => {
  navigateur = await chromium.launch({ executablePath: CHROMIUM, args: CAMERA_MIRE });
});
after(async () => {
  await navigateur?.close();
});

test("checklist DESIGN.md section 8 sur 3 largeurs x 5 routes", async () => {
  for (const [l, h] of LARGEURS) {
    for (const route of ROUTES) {
      const ctx = await navigateur.newContext({ viewport: { width: l, height: h } });
      const page = await ctx.newPage();
      const erreurs = [];
      page.on("console", (m) => {
        if (/Failed to load resource/.test(m.text())) return; // couvert par le statut
        if (m.type() === "error" || m.type() === "warning")
          erreurs.push(`${m.type()}: ${m.text()}`);
      });
      page.on("pageerror", (e) => erreurs.push(`pageerror: ${e.message}`));
      page.on("requestfailed", (rq) => {
        // les fontes distantes sont bloquees par le bac a sable, pas par le site
        if (rq.url().startsWith(BASE)) erreurs.push(`requestfailed: ${rq.url()}`);
      });
      const rep = await page.goto(BASE + route, { waitUntil: "networkidle" });
      await page.waitForTimeout(2200);
      const r = await page.evaluate(() => {
        const de = document.documentElement;
        const rouges = [];
        const rayons = [];
        for (const el of document.querySelectorAll("body *")) {
          const cs = getComputedStyle(el);
          const rect = el.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) continue;
          if (cs.backgroundColor === "rgb(255, 0, 0)") rouges.push(el.className);
          if (cs.borderRadius && cs.borderRadius !== "0px")
            rayons.push(el.tagName + "." + el.className + "=" + cs.borderRadius);
        }
        const repere = document.querySelector(".bg-mire-red");
        return {
          scrollWidth: de.scrollWidth,
          innerWidth: window.innerWidth,
          rouges: rouges.length,
          rayons,
          repereHaut: repere ? repere.getBoundingClientRect().top : null,
          cellule: parseInt(getComputedStyle(de).getPropertyValue("--cell")),
          h1: document.querySelectorAll("h1").length,
          contenu: !!document.getElementById("contenu"),
          evitement: !!document.querySelector('a[href="#contenu"]'),
          medias: document.querySelectorAll("img, video").length,
          roleImgSansNom: [...document.querySelectorAll('[role="img"]')].filter(
            (e) => !e.getAttribute("aria-label"),
          ).length,
          boutonsSansNom: [...document.querySelectorAll("button")].filter(
            (b) => !(b.textContent.trim() || b.getAttribute("aria-label")),
          ).length,
        };
      });
      const tag = `${l}x${h} ${route}`;
      const statut = route === "/inconnue" ? 404 : 200;
      verifie(`${tag} : reponse`, rep.status() === statut, `${rep.status()} (attendu ${statut})`);
      verifie(
        `${tag} : scrollWidth === innerWidth`,
        r.scrollWidth === r.innerWidth,
        `${r.scrollWidth} / ${r.innerWidth}`,
      );
      verifie(`${tag} : une seule ligne rouge`, r.rouges === 1, String(r.rouges));
      verifie(
        `${tag} : aucun border-radius`,
        r.rayons.length === 0,
        r.rayons.slice(0, 2).join(", "),
      );
      verifie(
        `${tag} : le repere est sur la grille`,
        r.repereHaut === null || r.repereHaut % r.cellule === 0,
        `${r.repereHaut} / ${r.cellule}`,
      );
      verifie(`${tag} : un seul h1`, r.h1 === 1, String(r.h1));
      verifie(`${tag} : main#contenu et lien d'evitement`, r.contenu && r.evitement);
      verifie(`${tag} : aucun img/video brut`, r.medias === 0, String(r.medias));
      verifie(`${tag} : aucun role=img sans nom`, r.roleImgSansNom === 0);
      verifie(`${tag} : aucun bouton sans nom`, r.boutonsSansNom === 0);
      verifie(`${tag} : console vide`, erreurs.length === 0, erreurs.join(" | ").slice(0, 200));
      await ctx.close();
    }
  }
  conclure();
});

test("navigation au clavier depuis le haut de page", async () => {
  const ctx = await navigateur.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.waitForTimeout(2200);
  await page.keyboard.press("Tab");
  const premier = await page.evaluate(() => {
    const a = document.activeElement;
    const r = a.getBoundingClientRect();
    return { texte: a.textContent, visible: r.width > 1 && r.height > 1 };
  });
  verifie(
    "le lien d'evitement est le premier arret, et il se voit",
    /ALLER AU CONTENU/.test(premier.texte) && premier.visible,
    JSON.stringify(premier),
  );
  await page.keyboard.press("Enter");
  await page.waitForTimeout(200);
  const apres = await page.evaluate(
    () => document.activeElement.id || document.activeElement.tagName,
  );
  verifie("il donne le focus a main#contenu", apres === "contenu", apres);

  for (let i = 0; i < 40; i++) {
    await page.keyboard.press("Tab");
    if ((await page.evaluate(() => document.activeElement.textContent)) === "GRIS") break;
  }
  await page.keyboard.press("Enter");
  const enfonce = await page.evaluate(() => document.activeElement.getAttribute("aria-pressed"));
  verifie("le bloc de mode repond a ENTREE", enfonce === "true", String(enfonce));

  await page.keyboard.press("n");
  await page.waitForTimeout(100);
  const negatif = await page.evaluate(() => ({
    classe: document.documentElement.className,
    enfonce: document.querySelector('[aria-keyshortcuts="n"]')?.getAttribute("aria-pressed"),
  }));
  verifie(
    "touche N : tout s'inverse et l'etat est reflete",
    /mire-negative/.test(negatif.classe) && negatif.enfonce === "true",
    JSON.stringify(negatif),
  );
  await ctx.close();
  conclure();
});

test("og:image suit la route en navigation client", async () => {
  const ctx = await navigateur.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const erreurs = [];
  page.on("pageerror", (e) => erreurs.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && !/Failed to load resource/.test(m.text())) erreurs.push(m.text());
  });
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.waitForTimeout(2200);
  await page.click('a[href="/projet/cylindre"]');
  await page.waitForTimeout(2500);
  const apres = await page.evaluate(() => ({
    url: location.pathname,
    og: document.querySelector('meta[property="og:image"]')?.content,
    n: document.querySelectorAll('meta[property="og:image"]').length,
  }));
  verifie(
    "la carte de partage est celle du projet, et en un seul exemplaire",
    apres.url === "/projet/cylindre" && apres.og === BASE + "/og/cylindre.png" && apres.n === 1,
    JSON.stringify(apres),
  );
  verifie(
    "aucune erreur en navigation client",
    erreurs.length === 0,
    erreurs.join(" | ").slice(0, 200),
  );
  await ctx.close();
  conclure();
});

test("mouvement reduit : les planches sont posees d'un coup", async () => {
  const ctx = await navigateur.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  });
  const page = await ctx.newPage();
  await page.goto(BASE + "/projet/cylindre", { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  const encre = await page.evaluate(() => {
    const sortie = [];
    for (const c of document.querySelectorAll("figure canvas")) {
      const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
      let sombre = 0;
      for (let i = 0; i < d.length; i += 4 * 97) if (d[i] < 128) sombre++;
      sortie.push(sombre);
    }
    return sortie;
  });
  verifie(
    "sans attendre, les planches portent deja de l'encre",
    encre.length > 0 && encre.every((n) => n > 0),
    JSON.stringify(encre),
  );
  await page.screenshot({ path: capture("audit-reduit-1440.png") });
  await ctx.close();
  conclure();
});
