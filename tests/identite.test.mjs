/**
 * L'identite de MIRE n'a qu'une source, src/lib/identite.ts, et le site dit
 * partout la meme chose : coordonnees, role, delai de reponse, mentions
 * legales. La fiche de contact donne l'heure de la ville, pas celle du visiteur.
 *
 * Aucune valeur n'est recopiee ici : elles sont lues dans la source. Changer
 * d'adresse ne casse pas la suite ; recopier une coordonnee en dur, si.
 */
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { chromium } from "playwright-core";
import { BASE, CHROMIUM, RACINE, conclure, nouvellePage, verifie } from "./outils.mjs";

const FICHIER = path.join(RACINE, "src", "lib", "identite.ts");
const SOURCE = fs.readFileSync(FICHIER, "utf8");
const champ = (k) => SOURCE.match(new RegExp(`\\b${k}:\\s*"([^"]*)"`))?.[1];
const ID = Object.fromEntries(
  [
    "name",
    "legalName",
    "role",
    "email",
    "phone",
    "street",
    "postalCode",
    "city",
    "founded",
    "timeZone",
    "delaiReponse",
    "siret",
    // nom de l'hebergeur (STUDIO.hebergeur.nom)
    "nom",
  ].map((k) => [k, champ(k)]),
);

/** La regle de mireText (src/lib/glyphs.ts) : capitales, sans accents. */
const mire = (t) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").toUpperCase();
const adresse = `${ID.street}, ${[ID.postalCode, ID.city].filter(Boolean).join(" ")}`;
const chiffres = (t) => t.replace(/[^\d+]/g, "");
const metier = ID.role.charAt(0).toLocaleLowerCase("fr") + ID.role.slice(1);

/** Heure HH:MM dans un fuseau, et ecart en minutes entre deux heures (minuit compris). */
const heure = (tz) =>
  new Intl.DateTimeFormat("fr-FR", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date());
const ecart = (a, b) => {
  const m = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  const d = Math.abs(m(a) - m(b));
  return Math.min(d, 1440 - d);
};

/**
 * Ce qu'aucune page ne doit plus affirmer de MIRE : ni studio, ni atelier. Les
 * domaines et la ville ne sont pas interdits ici (un projet peut etre de la
 * signaletique, ou se passer a Paris) : ils sont verifies en positif, depuis la source.
 */
const PERIME = /STUDIO DE DESIGN|STUDIO GRAPHIQUE|ATELIER FONDE/;

test("la source est complete et personne ne la recopie", () => {
  for (const k of [
    "name",
    "legalName",
    "role",
    "email",
    "phone",
    "street",
    "city",
    "timeZone",
    "delaiReponse",
  ])
    verifie(`identite.ts renseigne ${k}`, Boolean(ID[k]), ID[k] ?? "absent");

  // tout le code du site et des scripts, sauf la source elle-meme
  const fichiers = [];
  const parcourir = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) parcourir(p);
      else if (/\.(ts|tsx)$/.test(e.name) && p !== FICHIER && !p.endsWith("routeTree.gen.ts"))
        fichiers.push(p);
    }
  };
  parcourir(path.join(RACINE, "src"));
  parcourir(path.join(RACINE, "scripts"));

  const valeurs = [
    ID.email,
    ID.phone,
    chiffres(ID.phone),
    ID.street,
    ID.legalName,
    ID.postalCode,
  ].filter(Boolean);
  for (const v of valeurs) {
    const formes = [...new Set([v, mire(v)])];
    const fautifs = fichiers.filter((f) => {
      const t = fs.readFileSync(f, "utf8");
      return formes.some((x) => t.toLowerCase().includes(x.toLowerCase()));
    });
    verifie(
      `« ${v} » n'est ecrit qu'une fois, dans identite.ts`,
      fautifs.length === 0,
      fautifs.map((f) => path.relative(RACINE, f)).join(", "),
    );
  }

  const manifeste = JSON.parse(
    fs.readFileSync(path.join(RACINE, "public", "manifest.webmanifest"), "utf8"),
  );
  verifie(
    "manifeste : son nom suit l'identite",
    manifeste.name === `${ID.name} — ${ID.role}`,
    manifeste.name,
  );
  verifie(
    "manifeste : sa description dit le role et la ville",
    manifeste.description.startsWith(`${ID.role} à ${ID.city}`),
    manifeste.description,
  );
  conclure();
});

test("la fiche de contact, les mentions et l'heure de la ville", async () => {
  const navigateur = await chromium.launch({ executablePath: CHROMIUM, args: ["--no-sandbox"] });
  // un visiteur a Montreal : six heures d'ecart avec Bordeaux
  const ctx = await navigateur.newContext({
    viewport: { width: 1440, height: 900 },
    timezoneId: "America/Montreal",
    reducedMotion: "reduce",
  });
  const page = await nouvellePage(ctx);
  await page.goto(BASE + "/contact", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);

  const vue = await page.evaluate(() => {
    const releve = (sel) =>
      Object.fromEntries(
        [...document.querySelectorAll(`${sel} dl > div`)].map((d) => [
          d.querySelector("dt")?.textContent?.trim(),
          d.querySelector("dd")?.textContent?.trim(),
        ]),
      );
    const ld = JSON.parse(
      document.querySelector('script[type="application/ld+json"]')?.textContent ?? "{}",
    );
    return {
      titre: document.title,
      fiche: releve('[data-mire="COORDONNEES"]'),
      mentions: releve("#mentions"),
      mailto: document.querySelector('a[href^="mailto:"]')?.getAttribute("href"),
      tel: document.querySelector('a[href^="tel:"]')?.getAttribute("href"),
      intro: document.querySelector('[data-mire="EN-TETE"] p')?.textContent ?? "",
      bandeau: [...document.querySelectorAll("ul.sr-only li")].map((l) => l.textContent),
      ld,
      texte: document.body.innerText,
      heures: Object.fromEntries(
        [...document.querySelectorAll("span.shrink-0")].map((s) => [
          s.textContent,
          s.parentElement?.querySelector(".sr-only")?.textContent ?? null,
        ]),
      ),
    };
  });

  verifie(
    "titre : le role, pas un studio",
    vue.titre === `Contact — ${ID.name}, ${metier}`,
    vue.titre,
  );

  // fiche
  verifie("fiche : courriel", vue.fiche["COURRIEL"] === mire(ID.email), vue.fiche["COURRIEL"]);
  verifie("fiche : telephone", vue.fiche["TELEPHONE"] === mire(ID.phone), vue.fiche["TELEPHONE"]);
  verifie("fiche : adresse", vue.fiche["ADRESSE"] === mire(adresse), vue.fiche["ADRESSE"]);
  verifie(
    "fiche : delai",
    vue.fiche["DELAI DE REPONSE"] === mire(ID.delaiReponse),
    vue.fiche["DELAI DE REPONSE"],
  );
  verifie(
    "fiche : la ligne SIRET suit la source",
    ID.siret ? vue.fiche["SIRET"] === mire(ID.siret) : !("SIRET" in vue.fiche),
    vue.fiche["SIRET"] ?? "absente",
  );
  verifie("lien d'ecriture", vue.mailto === `mailto:${ID.email}`, vue.mailto);
  verifie(
    "lien d'appel : le numero sans espaces",
    vue.tel === `tel:${chiffres(ID.phone)}`,
    vue.tel,
  );

  // une seule promesse de delai, partout la meme
  verifie(
    "intro : la meme promesse que la fiche",
    vue.intro.includes(`REPONSE SOUS ${mire(ID.delaiReponse)}.`),
    vue.intro.slice(-60),
  );
  verifie(
    "bandeau : la meme promesse que la fiche",
    vue.bandeau.includes(`REPONSE ${mire(ID.delaiReponse)}`),
    vue.bandeau.join(" | "),
  );

  // mentions legales
  verifie(
    "mentions : l'editeur est nomme",
    (vue.mentions["EDITEUR"] ?? "").startsWith(mire(ID.legalName)),
    vue.mentions["EDITEUR"],
  );
  verifie(
    "mentions : directeur de la publication",
    vue.mentions["DIRECTEUR DE LA PUBLICATION"] === mire(ID.legalName),
    vue.mentions["DIRECTEUR DE LA PUBLICATION"],
  );
  verifie("mentions : adresse", vue.mentions["ADRESSE"] === mire(adresse), vue.mentions["ADRESSE"]);
  verifie(
    "mentions : la ligne HEBERGEUR suit la source",
    ID.nom
      ? (vue.mentions["HEBERGEUR"] ?? "").startsWith(mire(ID.nom))
      : !("HEBERGEUR" in vue.mentions),
    vue.mentions["HEBERGEUR"] ?? "absente",
  );

  // donnees structurees
  verifie("JSON-LD : courriel", vue.ld.email === ID.email, vue.ld.email);
  verifie("JSON-LD : telephone", vue.ld.telephone === ID.phone, vue.ld.telephone);
  verifie(
    "JSON-LD : rue",
    vue.ld.address?.streetAddress === ID.street,
    vue.ld.address?.streetAddress,
  );
  verifie(
    "JSON-LD : ville",
    vue.ld.address?.addressLocality === ID.city,
    vue.ld.address?.addressLocality,
  );
  verifie(
    "JSON-LD : code postal tel que fourni, jamais invente",
    vue.ld.address?.postalCode === ID.postalCode,
    String(vue.ld.address?.postalCode),
  );
  verifie(
    "JSON-LD : le fondateur et son metier",
    vue.ld.founder?.name === ID.legalName && vue.ld.founder?.jobTitle === ID.role,
    JSON.stringify(vue.ld.founder),
  );

  // deux horloges, deux heures, deux etiquettes qui le disent
  const libelleVille = `HEURE ${mire(ID.city)}`;
  const hVille = vue.heures[libelleVille];
  const hLocale = vue.heures["HEURE LOCALE"];
  verifie(
    `horloge « ${libelleVille} » presente`,
    Boolean(hVille),
    Object.keys(vue.heures).join(", "),
  );
  verifie(
    `elle donne l'heure de ${ID.timeZone}, pas celle du visiteur`,
    Boolean(hVille) && ecart(hVille, heure(ID.timeZone)) <= 1,
    `${hVille} / attendu ${heure(ID.timeZone)}`,
  );
  verifie(
    "l'horloge du colophon dit HEURE LOCALE et donne celle du visiteur",
    Boolean(hLocale) && ecart(hLocale, heure("America/Montreal")) <= 1,
    `${hLocale} / attendu ${heure("America/Montreal")}`,
  );

  const perime = vue.texte.match(PERIME);
  verifie("aucune affirmation perimee a l'ecran", !perime, perime?.[0] ?? "");
  verifie("aucune erreur", page.erreurs.length === 0, page.erreurs.join(" | ").slice(0, 200));

  await navigateur.close();
  conclure();
});

test("l'accueil se presente juste et mene aux mentions", async () => {
  const navigateur = await chromium.launch({ executablePath: CHROMIUM, args: ["--no-sandbox"] });
  const ctx = await navigateur.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await nouvellePage(ctx);
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.waitForTimeout(2600);

  const vue = await page.evaluate(() => ({
    titre: document.title,
    entete: document.querySelector('[data-mire="ENTREE"] header')?.textContent ?? "",
    entree: document.querySelector('[data-mire="ENTREE"]')?.textContent ?? "",
    manifeste: document.querySelector('[data-mire="MANIFESTE"]')?.textContent ?? "",
    colophon: document.querySelector("footer")?.textContent ?? "",
    texte: document.body.innerText,
  }));
  verifie("titre : la signature", vue.titre === `${ID.name} — ${ID.role}`, vue.titre);
  verifie("en-tete : le role", vue.entete.includes(mire(ID.role)), vue.entete.trim());
  verifie("entree : la ville de la source", vue.entree.includes(mire(ID.city)), mire(ID.city));
  verifie(
    "manifeste : le role et l'annee de debut",
    vue.manifeste.includes(`${mire(ID.role)} DEPUIS ${ID.founded}`),
    vue.manifeste.replace(/\s+/g, " ").slice(0, 120),
  );
  verifie("colophon : la signature", vue.colophon.includes(`${ID.name} — ${mire(ID.role)}`), "");
  verifie(
    "colophon : courriel et telephone",
    vue.colophon.includes(mire(ID.email)) && vue.colophon.includes(mire(ID.phone)),
    "",
  );
  const perime = vue.texte.match(PERIME);
  verifie("aucune affirmation perimee a l'ecran", !perime, perime?.[0] ?? "");

  // le colophon mene aux mentions, transition comprise
  await page.locator("footer").last().scrollIntoViewIfNeeded();
  await page.getByRole("link", { name: "MENTIONS LEGALES" }).click();
  await page.waitForTimeout(2200);
  const arrivee = await page.evaluate(() => {
    const m = document.getElementById("mentions")?.getBoundingClientRect();
    return {
      url: location.pathname + location.hash,
      visible: !!m && m.top < innerHeight && m.bottom > 0,
    };
  });
  verifie(
    "le lien MENTIONS LEGALES mene a /contact#mentions",
    arrivee.url === "/contact#mentions",
    arrivee.url,
  );
  verifie("les mentions sont a l'ecran a l'arrivee", arrivee.visible, "");
  verifie("aucune erreur", page.erreurs.length === 0, page.erreurs.join(" | ").slice(0, 200));

  await navigateur.close();
  conclure();
});
