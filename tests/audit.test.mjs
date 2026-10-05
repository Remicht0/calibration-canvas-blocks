/**
 * Audit global : la checklist de DESIGN.md section 8, l'accessibilite, la
 * navigation au clavier, les cartes de partage en navigation client et le
 * mouvement reduit — sur 3 largeurs et 5 routes.
 */
import { after, before, test } from "node:test";
import { chromium } from "playwright-core";
import { BASE, CAMERA_MIRE, CHROMIUM, SLUGS, capture, conclure, verifie } from "./outils.mjs";

const ROUTES = ["/", `/projet/${SLUGS[0]}`, "/atelier", "/contact", "/inconnue"];
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

/** Le titre en blocs de la page, relu cellule par cellule : ses lignes sont les bandes d'encre. */
const lireTitre = (page) =>
  page.evaluate(() => {
    const cv = document.querySelector('[data-mire="EN-TETE"] canvas');
    const cell = parseInt(getComputedStyle(document.documentElement).getPropertyValue("--cell"));
    const r = cv.getBoundingClientRect();
    const cols = Math.round(r.width / cell);
    const rows = Math.round(r.height / cell);
    const d = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data;
    const encre = [];
    for (let y = 0; y < rows; y++) {
      const rangee = [];
      for (let x = 0; x < cols; x++) {
        const px = Math.floor(((x + 0.5) * cv.width) / cols);
        const py = Math.floor(((y + 0.5) * cv.height) / rows);
        if (d[(py * cv.width + px) * 4] < 128) rangee.push(x);
      }
      encre.push(rangee);
    }
    const bandes = [];
    let cur = null;
    encre.forEach((rangee, y) => {
      if (!rangee.length) return void (cur = null);
      if (!cur) bandes.push((cur = { y, h: 0, x0: cols, x1: -1, n: 0 }));
      cur.h++;
      cur.n += rangee.length;
      cur.x0 = Math.min(cur.x0, rangee[0]);
      cur.x1 = Math.max(cur.x1, rangee[rangee.length - 1]);
    });
    return {
      texte: cv.parentElement.querySelector("h1").textContent,
      cols,
      grille: r.width % cell === 0 && r.height % cell === 0,
      bandes,
    };
  });

/**
 * La decoupe de titleLines (src/lib/mire.ts) : sous 3 colonnes par caractere,
 * coupee entre les mots ; un mot plus long que la ligne en morceaux egaux.
 */
/** Miroir de `titleLines` (src/lib/mire.ts) : 4 colonnes par caractere sur deux lignes au plus, sinon 3. */
function couper(t, max) {
  return t.split(/\s+/).flatMap((m) => {
    if (m.length <= max) return [m];
    const taille = Math.ceil(m.length / Math.ceil(m.length / max));
    const morceaux = [];
    for (let i = 0; i < m.length; i += taille) morceaux.push(m.slice(i, i + taille));
    return morceaux;
  });
}

/** Autant de lignes que le remplissage glouton, la plus longue la plus courte possible. */
function equilibrer(mots, max) {
  let n = 1;
  let long = 0;
  for (const m of mots) {
    if (long && long + 1 + m.length > max) {
      n++;
      long = m.length;
    } else long = long ? long + 1 + m.length : m.length;
  }
  // essai de toutes les coupes : les titres ont peu de mots
  let meilleur = null;
  const essai = (i, reste, lignes) => {
    if (i === mots.length) {
      if (reste !== 0) return;
      const pire = Math.max(...lignes.map((l) => l.length));
      if (!meilleur || pire < meilleur.pire) meilleur = { pire, lignes: [...lignes] };
      return;
    }
    if (reste === 0) return;
    for (let j = i + 1; j <= mots.length; j++) {
      const l = mots.slice(i, j).join(" ");
      if (l.length > max) break;
      essai(j, reste - 1, [...lignes, l]);
    }
  };
  essai(0, n, []);
  return meilleur.lignes;
}

function lignesAttendues(texte, cols) {
  const t = texte.trim();
  if (!t || cols / t.length >= 4) return [texte];
  const facile = Math.max(1, Math.floor(cols / 4));
  if (t.split(/\s+/).every((m) => m.length <= facile)) {
    const lignes = equilibrer(couper(t, facile), facile);
    if (lignes.length <= 2) return lignes;
  }
  if (cols / t.length >= 3) return [texte];
  const max = Math.max(1, Math.floor(cols / 3));
  return equilibrer(couper(t, max), max);
}

test("titres en blocs : sur plusieurs lignes quand ils ne tiennent pas, lus par la ligne rouge", async () => {
  for (const [l, h] of LARGEURS) {
    const ctx = await navigateur.newContext({ viewport: { width: l, height: h } });
    // la sequence d'entree ne rejoue pas : le titre se lit des qu'il est compose
    await ctx.addInitScript(() => sessionStorage.setItem("mire-boot", "1"));
    for (const slug of SLUGS) {
      const page = await ctx.newPage();
      await page.goto(`${BASE}/projet/${slug}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(2200);
      const t = await lireTitre(page);
      const attendu = lignesAttendues(t.texte, t.cols);
      const tag = `${l} px ${t.texte} (${t.cols} col.)`;
      verifie(`${tag} : sur la grille`, t.grille);
      verifie(
        `${tag} : chaque lettre garde au moins 3 colonnes`,
        attendu.length === 1 || Math.max(...attendu.map((x) => x.length)) * 3 <= t.cols,
        JSON.stringify(attendu),
      );
      verifie(
        `${tag} : ${attendu.length} ligne(s), coupees entre les mots`,
        t.bandes.length === attendu.length,
        `${t.bandes.length} bande(s) pour ${JSON.stringify(attendu)}`,
      );
      const large = Math.max(...t.bandes.map((b) => b.x1 - b.x0 + 1));
      verifie(
        `${tag} : la ligne la plus large tient toute la largeur`,
        large >= t.cols - 2,
        `${large}`,
      );

      // la ligne rouge lit le titre : ce qu'elle a depasse tombe, en remontant tout revient
      const haut = await page.evaluate(() => {
        const r = document.querySelector('[data-mire="EN-TETE"] canvas').getBoundingClientRect();
        return Math.round(r.top + scrollY + r.height / 2);
      });
      await page.evaluate((y) => window.scrollTo(0, y), haut);
      await page.waitForTimeout(400);
      const lu = await lireTitre(page);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(400);
      const relu = await lireTitre(page);
      const encre = (b) => b.reduce((s, x) => s + x.n, 0);
      verifie(
        `${tag} : la ligne rouge efface ce qu'elle a lu`,
        encre(lu.bandes) < encre(t.bandes),
        `${encre(t.bandes)} -> ${encre(lu.bandes)}`,
      );
      verifie(
        `${tag} : en remontant, le titre se recompose`,
        encre(relu.bandes) === encre(t.bandes),
        `${encre(t.bandes)} -> ${encre(relu.bandes)}`,
      );
      await page.screenshot({ path: capture(`audit-titre-${slug}-${l}.png`) });
      await page.close();
    }
    await ctx.close();
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
  await page.click(`a[href="/projet/${SLUGS[1] ?? SLUGS[0]}"]`);
  await page.waitForTimeout(2500);
  const apres = await page.evaluate(() => ({
    url: location.pathname,
    og: document.querySelector('meta[property="og:image"]')?.content,
    n: document.querySelectorAll('meta[property="og:image"]').length,
  }));
  verifie(
    "la carte de partage est celle du projet, et en un seul exemplaire",
    apres.url === `/projet/${SLUGS[1] ?? SLUGS[0]}` &&
      apres.og === `${BASE}/og/${SLUGS[1] ?? SLUGS[0]}.png` &&
      apres.n === 1,
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
  await page.goto(`${BASE}/projet/${SLUGS[1] ?? SLUGS[0]}`, { waitUntil: "networkidle" });
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
