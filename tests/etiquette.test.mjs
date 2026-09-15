/**
 * L'etiquette du cartouche est tiree du nom de fichier : elle doit rentrer
 * dans l'alphabet de la mire, sans accent, sans debordement.
 */
import fs from "node:fs";
import { test } from "node:test";
import { chromium } from "playwright-core";
import { CHROMIUM, allerAuMiroir, conclure, nouvellePage, photo, verifie } from "./outils.mjs";

const CAS = [
  ["Été à Nîmes — cœur.jpg", "MIROIR / ETE A NIMES - COEUR"],
  ["写真.jpg", "MIROIR / IMAGE"],
  [".jpg", "MIROIR / IMAGE"],
  ["un_nom_de_fichier_vraiment_tres_long.jpg", null],
];

test("etiquette tiree du nom de fichier", async () => {
  const navigateur = await chromium.launch({ executablePath: CHROMIUM, args: ["--no-sandbox"] });
  const ctx = await navigateur.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await nouvellePage(ctx);
  await allerAuMiroir(page);

  const jpg = fs.readFileSync(photo("p1.jpg"));
  for (const [nom, attendu] of CAS) {
    await page.locator('section[data-mire="MIROIR"] input[type=file]').setInputFiles({
      name: nom,
      mimeType: "image/jpeg",
      buffer: jpg,
    });
    await page.waitForTimeout(1600);
    const vue = await page.evaluate(() => {
      const l = document.querySelector('section[data-mire="MIROIR"] figcaption span span');
      return l ? l.textContent : "";
    });
    if (attendu)
      verifie(
        `« ${nom} »`,
        "MIROIR / " + vue.replace("MIROIR / ", "") === attendu || vue === attendu,
        vue,
      );
    else verifie(`« ${nom} » : etiquette tronquee`, vue.length <= 9 + 22, `${vue} (${vue.length})`);
    verifie(
      `« ${nom} » : alphabet de la mire seulement`,
      /^[A-Z0-9 .,:;!?()[\]/%+\-'"]*$/.test(vue),
      vue,
    );
    await page.getByRole("button", { name: /fermer l'image/i }).click();
    await page.waitForTimeout(400);
  }
  verifie("aucune erreur", page.erreurs.length === 0, page.erreurs.join(" | ").slice(0, 200));

  await navigateur.close();
  conclure();
});
