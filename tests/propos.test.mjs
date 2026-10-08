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
  await page.locator('header nav a[href="/a-propos"]').click();
  await page.waitForURL("**/a-propos", { timeout: 6000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const arrivee = await page.evaluate(() => ({
    url: location.pathname,
    focus: document.activeElement?.id,
    titre: document.title,
  }));
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
      return {
        n: cases.length,
        libelles: cases.map((e) => e.textContent?.trim()),
        coupe: cases.filter((e) => e.scrollWidth > e.clientWidth).map((e) => e.textContent),
        uneLigne: new Set(hauteurs).size === 1 && hauteurs[0] < 50,
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
    await ctx.close();
  }
  conclure();
});
