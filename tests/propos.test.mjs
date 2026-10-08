/**
 * Page A propos : le texte de Remi, son nom lu dans la source d'identite (jamais
 * recopie), aucun accord genre qui se rapporte a Remi, et un chemin pour y aller
 * depuis chaque page — barre haute, console mobile (six onglets qui tiennent
 * sur une ligne jusqu'a 320 px), colophon, plan du site.
 */
import fs from "node:fs";
import path from "node:path";
import { after, before, test } from "node:test";
import { chromium } from "playwright-core";
import { BASE, CHROMIUM, RACINE, conclure, nouvellePage, verifie } from "./outils.mjs";

const SOURCE = fs.readFileSync(path.join(RACINE, "src", "lib", "identite.ts"), "utf8");
const champ = (k) => SOURCE.match(new RegExp(`\\b${k}:\\s*"([^"]*)"`))?.[1];
const NOM = champ("legalName");
const mire = (t) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").toUpperCase();

/** Les accords que le texte de Remi portait (« nee », « etudiant », « deplace ») et leurs voisins. */
const GENRE = /\bNEE? A\b|\bETUDIANTE?S?\b|\bME SUIS DEPLACEE?\b|\bPASSIONNEE?\b|\bOBSEDEE?\b/;

let navigateur;
before(async () => {
  navigateur = await chromium.launch({ executablePath: CHROMIUM, args: ["--no-sandbox"] });
});
after(async () => {
  await navigateur?.close();
});

test("la page dit qui signe MIRE, sans rien recopier ni accorder", async () => {
  const ctx = await navigateur.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await nouvellePage(ctx);
  const rep = await page.goto(`${BASE}/a-propos`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  verifie("/a-propos : 200", rep?.status() === 200, String(rep?.status()));
  const r = await page.evaluate(() => ({
    titre: document.title,
    h1: document.querySelector("h1")?.textContent?.trim(),
    ancre: document.querySelector("h1")?.closest("#titre")?.id,
    description: document.querySelector('meta[name="description"]')?.content ?? "",
    // texte rendu dans la grille : sans les contenus hors mire (sr-only)
    texte: (() => {
      const main = document.querySelector("main");
      if (!main) return "";
      const w = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
      const morceaux = [];
      for (let n = w.nextNode(); n; n = w.nextNode())
        if (!n.parentElement?.closest(".sr-only")) morceaux.push(n.textContent);
      return morceaux.join(" ").replace(/\s+/g, " ");
    })(),
    ld: [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) =>
      JSON.parse(s.textContent || "{}"),
    ),
    courant: document.querySelector('header a[aria-current="page"]')?.textContent?.trim(),
    sections: [...document.querySelectorAll("main section[data-mire]")].map((s) => s.dataset.mire),
  }));
  verifie("onglet : À propos — MIRE", /^À propos — MIRE, /.test(r.titre), r.titre);
  verifie(
    "h1 lu « À propos », ancre #titre",
    r.h1 === "À propos" && r.ancre === "titre",
    `${r.h1} #${r.ancre}`,
  );
  verifie(
    "la description est en francais accentue et nomme Remi depuis la source",
    r.description.length > 60 && r.description.length <= 160 && r.description.includes(NOM),
    r.description,
  );
  verifie("le nom s'affiche, lu dans identite.ts", r.texte.includes(mire(NOM)), mire(NOM));
  verifie(
    "texte rendu en capitales sans accents",
    !/[a-zà-öø-ÿÀ-ÖØ-Þ]/.test(r.texte),
    r.texte.match(/.{0,20}[a-zà-öø-ÿÀ-ÖØ-Þ].{0,20}/)?.[0] ?? "",
  );
  verifie(
    "aucun accord genre ne se rapporte a Remi",
    !GENRE.test(r.texte),
    r.texte.match(GENRE)?.[0] ?? "",
  );
  verifie(
    "en-tete, releve, parcours, signature",
    ["EN-TETE", "RELEVE", "PARCOURS", "SIGNATURE"].every((s) => r.sections.includes(s)),
    r.sections.join(","),
  );
  const profil = r.ld.find((d) => d["@type"] === "ProfilePage");
  verifie(
    "donnees structurees : ProfilePage d'une Person, signature MIRE",
    profil?.mainEntity?.name === NOM && profil?.mainEntity?.alternateName === "MIRE",
    JSON.stringify(profil?.mainEntity ?? null),
  );
  verifie(
    "A PROPOS est la page courante de la barre haute",
    /A PROPOS$/.test(r.courant ?? ""),
    String(r.courant),
  );
  verifie("console vide", page.erreurs.length === 0, page.erreurs.join(" | ").slice(0, 200));
  await ctx.close();
  conclure();
});

test("on y va de partout : barre haute, colophon, plan du site", async () => {
  const ctx = await navigateur.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await nouvellePage(ctx);
  await page.goto(`${BASE}/contact`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  const liens = await page.evaluate(() => ({
    haut: !!document.querySelector('header nav a[href="/a-propos"]'),
    pied: !!document.querySelector('footer a[href="/a-propos"]'),
  }));
  verifie(
    "barre haute et colophon menent a /a-propos",
    liens.haut && liens.pied,
    JSON.stringify(liens),
  );
  // le titre que la transition compose est celui de la page visee
  await page.evaluate(() => {
    window.__titres = [];
    addEventListener("mire:wipe", (e) => {
      if (!e.detail) return;
      const masque = document.querySelector("[data-mire-nocapture][data-titre]");
      window.__titres.push(masque?.dataset.titre);
    });
  });
  await page.locator('header nav a[href="/a-propos"]').click();
  await page.waitForURL("**/a-propos", { timeout: 6000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const arrivee = await page.evaluate(() => ({
    titres: window.__titres,
    url: location.pathname,
    focus: document.activeElement?.id,
    titre: document.title,
  }));
  verifie(
    "la transition compose A PROPOS, pas MIRE",
    arrivee.titres.length > 0 && arrivee.titres.every((t) => t === "A PROPOS"),
    JSON.stringify(arrivee.titres),
  );
  verifie(
    "navigation client : titre et focus sur le h1",
    arrivee.url === "/a-propos" && arrivee.focus === "titre" && /^À propos/.test(arrivee.titre),
    JSON.stringify(arrivee),
  );
  const plan = await (await page.request.get(`${BASE}/sitemap.xml`)).text();
  verifie("le plan du site liste /a-propos", plan.includes("/a-propos</loc>"), "");
  await ctx.close();
  conclure();
});

test("console mobile : six onglets sur une ligne, de 320 a 767 px", async () => {
  for (const largeur of [320, 360, 393, 767]) {
    const ctx = await navigateur.newContext({
      viewport: { width: largeur, height: 800 },
      isMobile: true,
      hasTouch: true,
    });
    const page = await nouvellePage(ctx);
    await page.goto(`${BASE}/a-propos`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1200);
    const c = await page.evaluate(() => {
      const nav = document.querySelector('nav[aria-label="Console de navigation"]');
      const cases = [...(nav?.querySelectorAll(":scope > div:last-child > *") ?? [])];
      const hauteurs = cases.map((e) => Math.round(e.getBoundingClientRect().height));
      const hauts = cases.map((e) => Math.round(e.getBoundingClientRect().top));
      // air entre chaque libelle et le filet de sa case
      const air = cases.map((e) => {
        const r = document.createRange();
        r.selectNodeContents(e);
        return (e.getBoundingClientRect().width - r.getBoundingClientRect().width) / 2;
      });
      return {
        n: cases.length,
        libelles: cases.map((e) => e.textContent?.trim()),
        coupe: cases.filter((e) => e.scrollWidth > e.clientWidth).map((e) => e.textContent),
        uneLigne: new Set(hauts).size === 1 && new Set(hauteurs).size === 1 && hauteurs[0] < 50,
        airMin: Math.min(...air),
        hauteurs,
        courant: nav?.querySelector('a[aria-current="page"]')?.textContent?.trim(),
        debord: document.documentElement.scrollWidth - innerWidth,
      };
    });
    verifie(
      `${largeur} px : six onglets dont A PROPOS, courant ici`,
      c.n === 6 && c.libelles.includes("A PROPOS") && c.courant === "A PROPOS",
      JSON.stringify(c.libelles),
    );
    verifie(
      `${largeur} px : aucun libelle coupe, une seule ligne, aucun debordement`,
      c.coupe.length === 0 && c.uneLigne && c.debord === 0,
      JSON.stringify({ coupe: c.coupe, hauteurs: c.hauteurs, debord: c.debord }),
    );
    verifie(
      `${largeur} px : au moins 2 px d'air entre chaque libelle et son filet`,
      c.airMin >= 2,
      c.airMin.toFixed(2),
    );
    await ctx.close();
  }
  conclure();
});

test("texte agrandi : les onglets passent a la ligne, la page reserve leur hauteur", async () => {
  for (const largeur of [320, 393]) {
    const ctx = await navigateur.newContext({
      viewport: { width: largeur, height: 800 },
      isMobile: true,
      hasTouch: true,
    });
    const page = await nouvellePage(ctx);
    await page.goto(`${BASE}/a-propos`, { waitUntil: "networkidle" });
    await page.waitForTimeout(800);
    // zoom texte 200 % (WCAG 1.4.4) sur les etiquettes
    await page.addStyleTag({ content: ".u-mono{font-size:24px !important}" });
    await page.waitForTimeout(400);
    const c = await page.evaluate(() => {
      const nav = document.querySelector('nav[aria-label="Console de navigation"]');
      const cases = [...(nav?.querySelectorAll(":scope > div:last-child > *") ?? [])];
      return {
        dehors: cases
          .filter((e) => {
            const r = e.getBoundingClientRect();
            return r.left < -0.5 || r.right > innerWidth + 0.5;
          })
          .map((e) => e.textContent),
        rangees: new Set(cases.map((e) => Math.round(e.getBoundingClientRect().top))).size,
        console: Math.ceil(nav?.getBoundingClientRect().height ?? 0),
        reserve: parseFloat(getComputedStyle(document.body).paddingBottom),
        debord: document.documentElement.scrollWidth - innerWidth,
      };
    });
    verifie(
      `${largeur} px, texte x2 : aucun onglet hors de l'ecran`,
      c.dehors.length === 0 && c.debord === 0 && c.rangees > 1,
      JSON.stringify(c),
    );
    verifie(
      `${largeur} px, texte x2 : le bas de page reste au-dessus de la console`,
      c.reserve >= c.console,
      `${c.reserve} / ${c.console}`,
    );
    await ctx.close();
  }
  conclure();
});

test("barre haute : une seule rangee de 768 a 1022 px, meme sur l'atelier", async () => {
  const ctx = await navigateur.newContext({
    viewport: { width: 768, height: 900 },
    reducedMotion: "reduce",
  });
  const page = await nouvellePage(ctx);
  for (const route of ["/atelier", "/", "/a-propos", "/projet/moire"]) {
    await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" });
    const fautes = [];
    for (let l = 768; l <= 1022; l += 6) {
      await page.setViewportSize({ width: l, height: 900 });
      await page.waitForTimeout(40);
      const r = await page.evaluate(() => {
        const nav = document.querySelector('header nav[aria-label="Navigation principale"]');
        const liens = [...(nav?.querySelectorAll("a") ?? [])].filter((a) => a.offsetWidth > 0);
        const droite = nav?.parentElement?.lastElementChild;
        const fin = Math.max(...liens.map((a) => a.getBoundingClientRect().right));
        const debut = droite && droite !== nav ? droite.getBoundingClientRect().left : Infinity;
        return {
          rangees: new Set(liens.map((a) => Math.round(a.getBoundingClientRect().top))).size,
          ecart: debut - fin,
        };
      });
      if (r.rangees !== 1 || r.ecart < 16) fautes.push(`${l}:${JSON.stringify(r)}`);
    }
    verifie(
      `${route} : cinq liens sur une rangee, ecart garde a droite`,
      fautes.length === 0,
      fautes.slice(0, 3).join(" "),
    );
  }
  await ctx.close();
  conclure();
});
