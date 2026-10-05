/**
 * Page projet : la planche principale au premier ecran, la serie de planches
 * numerotee, les mesures en deux colonnes sur mobile, la SUITE lue par la
 * ligne rouge en tactile, les donnees structurees. Aucun nom de projet en dur :
 * tout se lit dans le DOM, pour 2 a N projets, avec ou sans serie ni video.
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

/** Part de cellules claires du fond de la SUITE (0 : noir plein, aucun projet compose). */
const fondSuite = (page) =>
  page.evaluate(() => {
    const cv = document.querySelector('section[data-mire="SUITE"] canvas');
    if (!cv || !cv.width) return 0;
    const d = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data;
    let clair = 0;
    let n = 0;
    for (let i = 0; i < d.length; i += 4 * 13) {
      n++;
      if (d[i] > 128) clair++;
    }
    return clair / n;
  });

test("structure de la page projet sur 393 et 1440", async () => {
  for (const [l, h, tactile] of [
    [393, 852, true],
    [1440, 900, false],
  ]) {
    for (const slug of SLUGS) {
      const ctx = await navigateur.newContext({
        viewport: { width: l, height: h },
        hasTouch: tactile,
        isMobile: tactile,
      });
      const page = await nouvellePage(ctx);
      await page.goto(`${BASE}/projet/${slug}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(1500);
      const v = await page.evaluate(() => {
        const pistes = [...document.querySelectorAll("main [data-mire]")].map(
          (s) => s.dataset.mire,
        );
        const planche = document.querySelector('section[data-mire="PLANCHE 01"] figure');
        // en mobile, la console couvre le bas de l'ecran : le corps le reserve
        const bas = window.innerHeight - parseFloat(getComputedStyle(document.body).paddingBottom);
        const serie = document.querySelector('section[data-mire="PLANCHES"]');
        // le titre d'onglet est « TITRE — MIRE »
        const titre = document.title.replace(/ — MIRE$/, "");
        const champs = [
          ...document.querySelectorAll('section[data-mire="MESURES"] .grid > div'),
        ].map((d) => Math.round(d.getBoundingClientRect().top));
        // retrait de chaque planche de la serie depuis le bord de la grille, en cellules
        const cellule = parseInt(
          getComputedStyle(document.documentElement).getPropertyValue("--cell"),
        );
        const grille = serie?.querySelector(".grid")?.getBoundingClientRect();
        const retraits = [...(serie?.querySelectorAll('figure > [role="img"] > canvas') ?? [])].map(
          (c) => (grille ? (c.getBoundingClientRect().left - grille.left) / cellule : 0),
        );
        const ld = [...document.querySelectorAll('script[type="application/ld+json"]')]
          .map((s) => JSON.parse(s.textContent || "{}"))
          .find((j) => j["@type"] === "CreativeWork");
        return {
          pistes,
          haut: planche ? Math.round(planche.getBoundingClientRect().top) : null,
          bas: Math.round(bas),
          entete: serie?.querySelector("h2")?.textContent ?? "",
          etiquettes: [...(serie?.querySelectorAll("figure") ?? [])].map(
            (f) => f.querySelector("figcaption span span")?.textContent ?? "",
          ),
          titre,
          champs,
          retraits,
          ld,
          video: !!document.querySelector('section[data-mire="SIGNAL"] figure'),
          debord: document.documentElement.scrollWidth - window.innerWidth,
        };
      });
      const nom = `${l} px /projet/${slug}`;
      verifie(
        `${nom} : la planche 01 suit le titre, avant les mesures`,
        v.pistes[0] === "EN-TETE" &&
          v.pistes[1] === "PLANCHE 01" &&
          v.pistes.indexOf("MESURES") > 1,
        v.pistes.join(" > "),
      );
      verifie(
        `${nom} : la planche 01 commence dans le premier ecran`,
        v.haut !== null && v.haut < v.bas,
        `${v.haut} / ${v.bas}`,
      );
      const n = v.etiquettes.length;
      const attendu = n > 1 ? `PLANCHES 02 — ${String(n + 1).padStart(2, "0")}` : "PLANCHE 02";
      verifie(
        `${nom} : l'en-tete de serie compte les planches`,
        n > 0 && v.entete === attendu,
        `${v.entete} / ${n} planche(s)`,
      );
      verifie(
        `${nom} : chaque planche de la serie porte le titre du projet`,
        v.etiquettes.every((e) => e.startsWith(`${v.titre} — `)),
        v.etiquettes.join(" | "),
      );
      // une planche seule en fin de serie impaire : ses blocs tombent dans les
      // colonnes de la planche de gauche, jamais a une demi-cellule
      const derniere = v.retraits[n - 1] ?? 0;
      verifie(
        `${nom} : la derniere planche d'une serie impaire est calee sur le pas`,
        n % 2 === 0 || Math.abs(derniere - Math.round(derniere)) < 0.01,
        v.retraits.map((r) => r.toFixed(2)).join(" / "),
      );
      if (tactile)
        verifie(
          `${nom} : mesures sur deux colonnes`,
          v.champs.length === 4 && v.champs[0] === v.champs[1] && v.champs[2] === v.champs[3],
          v.champs.join(" / "),
        );
      verifie(
        `${nom} : le projet se rattache au site`,
        v.ld?.isPartOf?.["@type"] === "WebSite" && v.ld?.isPartOf?.url === `${BASE}/`,
        JSON.stringify(v.ld?.isPartOf),
      );
      verifie(
        `${nom} : une video declaree seulement si la page en lit une`,
        v.video
          ? v.ld?.video?.["@type"] === "VideoObject" && /^https?:\/\//.test(v.ld.video.contentUrl)
          : v.ld?.video === undefined,
        JSON.stringify(v.ld?.video ?? null),
      );
      verifie(`${nom} : aucun debordement`, v.debord === 0, String(v.debord));
      verifie(
        `${nom} : console vide`,
        page.erreurs.length === 0,
        page.erreurs.join(" | ").slice(0, 200),
      );
      await ctx.close();
    }
  }
  conclure();
});

test("SUITE : la ligne rouge choisit un projet en tactile, jamais au survol absent", async () => {
  for (const tactile of [true, false]) {
    const ctx = await navigateur.newContext({
      viewport: tactile ? { width: 393, height: 852 } : { width: 1440, height: 900 },
      hasTouch: tactile,
      isMobile: tactile,
    });
    const page = await nouvellePage(ctx);
    await page.goto(`${BASE}/projet/${SLUGS[0]}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1200);
    const { debut, fin } = await page.evaluate(() => {
      const s = document.querySelector('section[data-mire="SUITE"]').getBoundingClientRect();
      return {
        debut: Math.max(0, s.top + window.scrollY - window.innerHeight),
        fin: document.documentElement.scrollHeight,
      };
    });
    let max = 0;
    for (let y = debut; y < fin; y += 40) {
      await page.evaluate((v) => window.scrollTo(0, v), y);
      await page.waitForTimeout(120);
      max = Math.max(max, await fondSuite(page));
      if (tactile && max > 0.02) break;
    }
    const mode = tactile ? "tactile" : "souris";
    verifie(
      `${mode} : ${tactile ? "un projet se compose dans le fond" : "le fond reste noir sans survol"}`,
      tactile ? max > 0.02 : max === 0,
      String(Math.round(max * 1000) / 1000),
    );
    verifie(`${mode} : console vide`, page.erreurs.length === 0, page.erreurs.join(" | "));
    await ctx.close();
  }
  conclure();
});
