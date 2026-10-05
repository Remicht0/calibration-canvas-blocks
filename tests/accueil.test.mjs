/**
 * L'accueil montre ses projets : l'index affleure au premier ecran sans passer
 * sous le chrome fixe, INDEX (barre haute, console, ligne de l'entree) y mene
 * d'un saut sec et lui donne le focus, le banc d'essai nomme chaque planche et
 * renvoie a son projet sur le pas de grille, et les donnees structurees
 * listent les projets.
 *
 * Aucun nom de projet n'est ecrit ici : les slugs sont lus dans la source,
 * la suite tient de 2 a 6 projets.
 */
import { after, before, test } from "node:test";
import { chromium } from "playwright-core";
import { BASE, CHROMIUM, SLUGS, capture, conclure, nouvellePage, verifie } from "./outils.mjs";

const LARGEURS = [
  [393, 852],
  [820, 1180],
  [1440, 900],
  // bureaux bas : l'entree depasse sa hauteur minimale, l'index doit tout de meme affleurer
  [1440, 800],
  [1280, 720],
];

let navigateur;
before(async () => {
  navigateur = await chromium.launch({ executablePath: CHROMIUM, args: ["--no-sandbox"] });
});
after(async () => {
  await navigateur?.close();
});

/** Un contexte a la taille voulue ; le tactile pour le mobile, comme un vrai telephone. */
async function ouvrir(l, h) {
  const tactile = l < 768;
  const ctx = await navigateur.newContext({
    viewport: { width: l, height: h },
    hasTouch: tactile,
    isMobile: tactile,
  });
  const page = await nouvellePage(ctx);
  return { ctx, page };
}

/** Ou en est la page : adresse, defilement, haut de la section INDEX, liens courants. */
const etat = (page) =>
  page.evaluate(() => {
    const ix = document.getElementById("index");
    return {
      url: location.pathname + location.hash,
      y: Math.round(scrollY),
      haut: ix ? Math.round(ix.getBoundingClientRect().top) : null,
      courants: [...document.querySelectorAll('[aria-current="page"]')].map((a) =>
        a.textContent.trim(),
      ),
    };
  });

/** Note scrollY a chaque image : un saut sec ne passe par aucune valeur intermediaire. */
const espionner = (page) =>
  page.evaluate(() => {
    window.__ys = [];
    window.__chutes = 0;
    window.addEventListener("mire:wipe", (e) => {
      if (e.detail) window.__chutes++;
    });
    const boucle = () => {
      window.__ys.push(Math.round(scrollY));
      requestAnimationFrame(boucle);
    };
    requestAnimationFrame(boucle);
  });

const releve = (page) =>
  page.evaluate(() => {
    const vus = [];
    for (const y of window.__ys) if (vus[vus.length - 1] !== y) vus.push(y);
    return { vus, chutes: window.__chutes };
  });

test("les projets au premier ecran, hors du chrome fixe", async () => {
  for (const [l, h] of LARGEURS) {
    const { ctx, page } = await ouvrir(l, h);
    await page.goto(BASE + "/", { waitUntil: "networkidle" });
    await page.waitForTimeout(2600);
    const r = await page.evaluate(() => {
      const boite = (el) => {
        if (!el) return null;
        const b = el.getBoundingClientRect();
        return b.width && b.height
          ? { top: b.top, bottom: b.bottom, left: b.left, right: b.right }
          : null;
      };
      const titre = document.querySelector("#index li .u-display");
      // la barre haute de l'entree porte aussi un INDEX vers #index : on veut la ligne du bas
      const lien = [...document.querySelectorAll('[data-mire="ENTREE"] a[href="/#index"]')].find(
        (a) => /PROJETS/.test(a.textContent ?? ""),
      );
      const blocs = [...document.querySelectorAll("main .u-bloc")].filter(
        (b) => b.scrollHeight > b.clientHeight + 1 || b.scrollWidth > b.clientWidth + 1,
      );
      // un Bloc a toujours un nombre entier de cellules de haut, meme passe a la ligne
      const cell = parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue("--cell"),
      );
      const horsPas = [...document.querySelectorAll("main .u-bloc")]
        .map((b) => [b.textContent.trim(), b.getBoundingClientRect().height])
        .filter(([, h]) => Math.abs(h / cell - Math.round(h / cell)) > 0.02);
      return {
        entete: boite(document.querySelector("#index h2")),
        titre: boite(titre),
        corps: titre ? parseFloat(getComputedStyle(titre).fontSize) : 0,
        lien: boite(lien),
        lienTexte: lien?.textContent ?? "",
        aide: boite(document.getElementById("aide")),
        console: boite(document.querySelector('nav[aria-label="Console de navigation"]')),
        debordes: blocs.map((b) => b.textContent.trim()),
        // l'entree : barre haute, bloc MIRE + copie, ligne du bas
        entree: [...(document.querySelector('[data-mire="ENTREE"]')?.children ?? [])].map(boite),
        cell,
        horsPas,
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth,
        innerHeight,
      };
    });
    const tag = `${l}x${h}`;
    // le bas utile : au-dessus de la console (mobile) ou du bouton AIDE (bureau)
    const bas = Math.min(r.innerHeight, r.console?.top ?? Infinity, r.aide?.top ?? Infinity);
    const croise = (a, b) =>
      !!a && !!b && a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
    verifie(
      `${tag} : l'en-tete IDX est au premier ecran`,
      !!r.entete && r.entete.bottom <= bas,
      `${Math.round(r.entete?.bottom)} / ${Math.round(bas)}`,
    );
    verifie(
      `${tag} : la premiere ligne de l'index aussi`,
      !!r.titre && r.titre.top + r.corps * 0.9 <= bas,
      `${Math.round((r.titre?.top ?? 0) + r.corps * 0.9)} / ${Math.round(bas)}`,
    );
    verifie(
      `${tag} : « N PROJETS » est un lien vers #index`,
      !!r.lien && new RegExp(`^${SLUGS.length} PROJETS`).test(r.lienTexte),
      r.lienTexte,
    );
    verifie(
      `${tag} : ... a l'ecran, ni sous AIDE ni sous la console`,
      !!r.lien && r.lien.bottom <= bas && !croise(r.lien, r.aide) && !croise(r.lien, r.console),
      JSON.stringify(r.lien),
    );
    const [barre, milieu, ligne] = r.entree;
    verifie(
      `${tag} : une cellule d'air au moins entre la barre, MIRE et la ligne du bas`,
      !!barre &&
        !!milieu &&
        !!ligne &&
        milieu.top - barre.bottom >= r.cell - 0.5 &&
        ligne.top - milieu.bottom >= r.cell - 0.5,
      JSON.stringify(r.entree.map((b) => b && [Math.round(b.top), Math.round(b.bottom)])),
    );
    verifie(
      `${tag} : aucun bloc ne deborde de son cadre`,
      r.debordes.length === 0,
      r.debordes.join(" | "),
    );
    verifie(
      `${tag} : chaque bloc tient un nombre entier de cellules`,
      r.horsPas.length === 0,
      JSON.stringify(r.horsPas),
    );
    verifie(
      `${tag} : aucun debordement`,
      r.scrollWidth === r.innerWidth,
      `${r.scrollWidth} / ${r.innerWidth}`,
    );
    await page.screenshot({ path: capture(`accueil-premier-ecran-${tag}.png`) });
    verifie(
      `${tag} : console vide`,
      page.erreurs.length === 0,
      page.erreurs.join(" | ").slice(0, 200),
    );
    await ctx.close();
  }
  conclure();
});

test("INDEX mene a la section INDEX, d'un saut sec", async () => {
  for (const [l, h, depart] of [
    [1440, 900, `/projet/${SLUGS[0]}`],
    [393, 852, `/projet/${SLUGS[SLUGS.length - 1]}`],
  ]) {
    const { ctx, page } = await ouvrir(l, h);
    const tag = `${l} px`;
    const index =
      l < 768
        ? page.locator('nav[aria-label="Console de navigation"] a', { hasText: "INDEX" })
        : page.locator("header nav a", { hasText: "INDEX" });
    const mire = page.locator("header nav a", { hasText: "MIRE" });

    // depuis une page projet : la transition joue, puis l'accueil s'ouvre sur l'index
    await page.goto(BASE + depart, { waitUntil: "networkidle" });
    await page.waitForTimeout(2600);
    await index.first().click();
    await page.waitForTimeout(2600);
    let e = await etat(page);
    verifie(`${tag} : depuis ${depart}, l'adresse est /#index`, e.url === "/#index", e.url);
    verifie(`${tag} : la section INDEX est en haut de l'ecran`, Math.abs(e.haut) <= 1, `${e.haut}`);
    verifie(
      `${tag} : INDEX est la page courante, et elle seule de la navigation`,
      e.courants.includes("INDEX") && !e.courants.some((c) => /ATELIER|CONTACT/.test(c)),
      JSON.stringify(e.courants),
    );

    // MIRE reste « / » : le haut de l'entree
    await mire.first().click();
    await page.waitForTimeout(600);
    e = await etat(page);
    verifie(`${tag} : MIRE ramene a / en haut`, e.url === "/" && e.y === 0, `${e.url} ${e.y}`);

    // depuis l'accueil : un saut sec, sans transition
    await espionner(page);
    await index.first().click();
    await page.waitForTimeout(700);
    e = await etat(page);
    const s = await releve(page);
    verifie(
      `${tag} : depuis l'accueil, la section est en haut`,
      Math.abs(e.haut) <= 1,
      `${e.haut}`,
    );
    verifie(
      `${tag} : saut sec, aucune position intermediaire`,
      s.vus.length === 2 && s.vus[0] === 0 && s.vus[1] === e.y,
      JSON.stringify(s.vus),
    );
    verifie(`${tag} : aucune transition pour une ancre`, s.chutes === 0, String(s.chutes));

    // deja sur /#index, remonte en haut : INDEX y ramene encore
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    await index.first().click();
    await page.waitForTimeout(400);
    e = await etat(page);
    verifie(`${tag} : un second clic y ramene aussi`, Math.abs(e.haut) <= 1, `${e.haut}`);

    // la ligne de l'entree
    await mire.first().click();
    await page.waitForTimeout(600);
    await page.locator('[data-mire="ENTREE"] a[href="/#index"]', { hasText: "PROJETS" }).click();
    await page.waitForTimeout(500);
    e = await etat(page);
    verifie(
      `${tag} : la ligne N PROJETS mene a l'index`,
      e.url === "/#index" && Math.abs(e.haut) <= 1,
      `${e.url} ${e.haut}`,
    );
    verifie(
      `${tag} : console vide`,
      page.erreurs.length === 0,
      page.erreurs.join(" | ").slice(0, 200),
    );
    await ctx.close();
  }
  conclure();
});

test("clavier : INDEX donne le focus a l'index, le Tab y continue", async () => {
  const { ctx, page } = await ouvrir(1440, 900);
  const index = page.locator("header nav a", { hasText: "INDEX" }).first();
  const focus = () =>
    page.evaluate(() => {
      const a = document.activeElement;
      const ix = document.getElementById("index");
      return {
        section: a === ix,
        dedans: !!ix && ix !== a && ix.contains(a),
        haut: ix ? Math.round(ix.getBoundingClientRect().top) : null,
      };
    });

  for (const depart of ["/", `/projet/${SLUGS[0]}`]) {
    await page.goto(BASE + depart, { waitUntil: "networkidle" });
    await page.waitForTimeout(2600);
    await index.focus();
    await page.keyboard.press("Enter");
    await page.waitForTimeout(depart === "/" ? 600 : 2600);
    let f = await focus();
    verifie(`depuis ${depart} : la section INDEX a le focus`, f.section, JSON.stringify(f));
    await page.keyboard.press("Tab");
    await page.waitForTimeout(300);
    f = await focus();
    verifie(
      `depuis ${depart} : le Tab suivant est dans l'index, la page ne remonte pas`,
      f.dedans && Math.abs(f.haut) <= 1,
      JSON.stringify(f),
    );
  }

  // deja sur /#index, remonte en haut : la touche Entree y ramene le focus aussi
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  await index.focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(400);
  let f = await focus();
  verifie(
    "un second INDEX rend le focus a la section",
    f.section && Math.abs(f.haut) <= 1,
    JSON.stringify(f),
  );

  // l'historique (navigation du routeur, sans rechargement) et le chargement
  // direct ne deplacent pas le focus
  await page.locator("#index li a").first().click();
  await page.waitForTimeout(2600);
  await page.goBack();
  await page.waitForTimeout(2600);
  f = await focus();
  verifie(
    "retour arriere sur /#index : le focus ne bouge pas",
    (await page.evaluate(() => location.hash)) === "#index" && !f.section,
    JSON.stringify(f),
  );
  verifie(
    "la section n'est focalisable que le temps de l'arrivee",
    (await page.evaluate(() => document.getElementById("index")?.hasAttribute("tabindex"))) ===
      false,
  );
  await page.goto(BASE + "/atelier", { waitUntil: "networkidle" });
  await page.goto(BASE + "/#index", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  f = await focus();
  verifie("chargement direct de /#index : le focus ne bouge pas", !f.section, JSON.stringify(f));
  verifie("console vide", page.erreurs.length === 0, page.erreurs.join(" | ").slice(0, 200));
  await ctx.close();
  conclure();
});

test("tactile : la ligne rouge choisit le projet de l'index", async () => {
  const { ctx, page } = await ouvrir(393, 852);
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.waitForTimeout(2600);
  const actif = () =>
    page.evaluate(() =>
      [...document.querySelectorAll("#index li")].findIndex((li) => li.querySelector("i")),
    );
  const vus = new Set();
  const max = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  for (let y = 0; y <= Math.min(max, 2400); y += 40) {
    await page.evaluate((v) => window.scrollTo(0, v), y);
    await page.waitForTimeout(80);
    vus.add(await actif());
  }
  verifie(
    "chaque ligne de l'index devient active a son tour",
    SLUGS.every((_, i) => vus.has(i)),
    JSON.stringify([...vus]),
  );
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(300);
  verifie("hors de la liste, plus rien n'est actif", (await actif()) === -1);
  verifie("console vide", page.erreurs.length === 0, page.erreurs.join(" | ").slice(0, 200));
  await ctx.close();
  conclure();
});

test("banc d'essai : chaque planche nomme son projet et y mene", async () => {
  const { ctx, page } = await ouvrir(1440, 900);
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.waitForTimeout(2600);
  const banc = await page.evaluate(() => {
    const s = document.querySelector('[data-mire="BANC D\'ESSAI"]');
    return {
      entete: s?.querySelector(".u-mono")?.textContent ?? "",
      planches: [...(s?.querySelectorAll("figure") ?? [])].map((f) => ({
        etiquette: f.querySelector("figcaption span span")?.textContent ?? "",
        lien: f.parentElement?.querySelector("a")?.getAttribute("href") ?? "",
        voir: f.parentElement?.querySelector("a")?.textContent ?? "",
      })),
    };
  });
  verifie(
    "en-tete : TROIS PLANCHES / TROIS LECTURES",
    banc.entete.includes("TROIS PLANCHES / TROIS LECTURES"),
    banc.entete,
  );
  verifie("trois planches", banc.planches.length === 3, String(banc.planches.length));
  for (const p of banc.planches) {
    const m = p.etiquette.match(/^LECTURE (BIN|GRIS|BRUT) — (.+)$/);
    verifie(`« ${p.etiquette} » nomme une lecture et un projet`, !!m, p.etiquette);
    verifie(
      `... suivie de VOIR ${m?.[2]} vers sa page`,
      !!m && p.voir === `VOIR ${m[2]}` && SLUGS.some((s) => p.lien === `/projet/${s}`),
      `${p.voir} -> ${p.lien}`,
    );
  }
  verifie(
    "trois projets differents quand il y en a assez",
    new Set(banc.planches.map((p) => p.lien)).size === Math.min(3, SLUGS.length),
    banc.planches.map((p) => p.lien).join(" "),
  );
  verifie("console vide", page.erreurs.length === 0, page.erreurs.join(" | ").slice(0, 200));
  await ctx.close();
  conclure();
});

test("banc d'essai : cartouches et blocs sur le pas, du 320 au 1440", async () => {
  for (const [l, h] of [
    [320, 640],
    [393, 852],
    [1024, 768],
    [1440, 900],
  ]) {
    const { ctx, page } = await ouvrir(l, h);
    await page.goto(BASE + "/", { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    const r = await page.evaluate(() => {
      const s = document.querySelector('[data-mire="BANC D\'ESSAI"]');
      const cell = parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue("--cell"),
      );
      // premiere ligne du cartouche : etiquette, ENCRE, format ; passee a la ligne,
      // chaque ligne garde deux cellules
      const lignes = [...(s?.querySelectorAll("figcaption > span:first-child") ?? [])].map(
        (x) => x.getBoundingClientRect().height / (cell * 2),
      );
      const blocs = [...(s?.querySelectorAll(".u-bloc") ?? [])].map((b) => ({
        t: b.textContent.trim(),
        h: b.getBoundingClientRect().height / cell,
        deborde: b.scrollHeight > b.clientHeight + 1 || b.scrollWidth > b.clientWidth + 1,
      }));
      return { lignes, blocs };
    });
    const entier = (v) => Math.abs(v - Math.round(v)) < 0.02;
    verifie(
      `${l} px : la ligne d'etiquette des cartouches tient un multiple de deux cellules`,
      r.lignes.length === 3 && r.lignes.every(entier),
      JSON.stringify(r.lignes),
    );
    const faux = r.blocs.filter((b) => b.deborde || !entier(b.h));
    verifie(
      `${l} px : les blocs du banc, sur le pas et sans debord`,
      faux.length === 0,
      JSON.stringify(faux),
    );
    await ctx.close();
  }
  conclure();
});

test("donnees structurees : la liste des projets", async () => {
  const { ctx, page } = await ouvrir(1440, 900);
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  const r = await page.evaluate(() => ({
    ld: [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) =>
      JSON.parse(s.textContent ?? "{}"),
    ),
    url: document.querySelector('meta[property="og:url"]')?.getAttribute("content") ?? "",
  }));
  const liste = r.ld.find((x) => x["@type"] === "ItemList");
  verifie("un ItemList est declare", !!liste, r.ld.map((x) => x["@type"]).join(", "));
  verifie(
    "l'Organization de la racine reste la",
    r.ld.some((x) => x["@type"] === "Organization"),
  );
  const items = liste?.itemListElement ?? [];
  verifie(
    "un element par projet",
    items.length === SLUGS.length,
    `${items.length} / ${SLUGS.length}`,
  );
  const origine = r.url ? new URL(r.url).origin : "";
  SLUGS.forEach((slug, i) => {
    const it = items[i];
    verifie(
      `position ${i + 1} : CreativeWork ${slug}, URL absolue`,
      it?.position === i + 1 &&
        it?.item?.["@type"] === "CreativeWork" &&
        !!it?.item?.name &&
        it?.item?.url === `${origine}/projet/${slug}`,
      JSON.stringify(it),
    );
  });
  await ctx.close();
  conclure();
});
