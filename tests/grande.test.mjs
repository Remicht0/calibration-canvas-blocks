/**
 * Photo demesuree : 8000 x 6000, 48 Mpx. Elle doit entrer dans la grille sans
 * jamais geler le fil principal plus qu'une poignee d'images.
 */
import { test } from "node:test";
import { chromium } from "playwright-core";
import {
  CHROMIUM,
  allerAuMiroir,
  capture,
  conclure,
  miroir,
  nouvellePage,
  verifie,
} from "./outils.mjs";

test("photo de 48 Mpx deposee dans le miroir", async () => {
  const navigateur = await chromium.launch({ executablePath: CHROMIUM, args: ["--no-sandbox"] });
  const ctx = await navigateur.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await nouvellePage(ctx);
  await allerAuMiroir(page);

  /* La photo est fabriquee dans la page puis deposee, et une sonde de 16 ms
     mesure le plus grand trou du fil principal : un seul drawImage 114:1
     couterait ~900 ms et gelerait la chute de blocs et la ScanLine. */
  const res = await page.evaluate(async () => {
    const gros = document.createElement("canvas");
    gros.width = 8000;
    gros.height = 6000;
    const g = gros.getContext("2d");
    for (let y = 0; y < 6000; y += 250)
      for (let x = 0; x < 8000; x += 250) {
        g.fillStyle = (x / 250 + y / 250) & 1 ? "#101010" : "#f0f0f0";
        g.fillRect(x, y, 250, 250);
      }
    const blob = await new Promise((r) => gros.toBlob(r, "image/jpeg", 0.9));
    const f = new File([blob], "enorme.jpg", { type: "image/jpeg" });
    gros.width = gros.height = 1;

    let dernier = performance.now();
    let trou = 0;
    const sonde = setInterval(() => {
      const t = performance.now();
      trou = Math.max(trou, t - dernier);
      dernier = t;
    }, 16);

    const dt = new DataTransfer();
    dt.items.add(f);
    const cible = document.querySelector('section[data-mire="MIROIR"] > div > div');
    cible.dispatchEvent(
      new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: dt }),
    );
    cible.dispatchEvent(
      new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt }),
    );
    await new Promise((r) => setTimeout(r, 4000));
    clearInterval(sonde);
    return { octets: blob.size, trou: Math.round(trou) };
  });

  await page.waitForTimeout(800);
  const txt = await miroir(page).innerText();
  verifie("la planche est montee", (await miroir(page).locator("canvas").count()) > 0);
  verifie(
    "etiquette MIROIR / ENORME",
    txt.includes("MIROIR / ENORME"),
    txt.split("\n").find((l) => l.includes("MIROIR")) ?? "",
  );
  verifie(
    "le fil principal n'est jamais gele plus de 350 ms",
    res.trou < 350,
    `trou=${res.trou} ms, source=${Math.round(res.octets / 1024)} Ko`,
  );
  const peint = await page.evaluate(() => {
    const cv = document.querySelector('section[data-mire="MIROIR"] canvas');
    const d = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data;
    let noir = 0;
    let blanc = 0;
    for (let i = 0; i < cv.width * cv.height; i += 11) {
      const r = d[i * 4];
      if (r < 40) noir++;
      else if (r > 215) blanc++;
    }
    return { noir, blanc };
  });
  verifie("le damier ressort net", peint.noir > 500 && peint.blanc > 500, JSON.stringify(peint));
  await miroir(page).screenshot({ path: capture("grande-image-1440.png") });
  verifie("aucune erreur", page.erreurs.length === 0, page.erreurs.join(" | ").slice(0, 200));

  await navigateur.close();
  conclure();
});
