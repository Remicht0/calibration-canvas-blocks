/* Page de secours servie quand le rendu serveur echoue : la meme mire que la
   page d'erreur du routeur (fond noir, encre blanche, blocs cadres), sans
   aucune dependance. Texte visible en capitales sans accents. */
export function renderErrorPage(): string {
  return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <title>Signal corrompu — MIRE</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#000000" />
    <style>
      html, body { margin: 0; background: #000000; color: #ffffff; }
      body { min-height: 100vh; display: flex; flex-direction: column; justify-content: space-between; padding: 40px 20px; box-sizing: border-box; font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 12.5px; letter-spacing: 0.045em; text-transform: uppercase; line-height: 1.45; }
      .top { display: flex; justify-content: space-between; }
      h1 { font-family: "Anton", "Arial Narrow", sans-serif; font-weight: 400; font-size: 18vw; line-height: 0.82; letter-spacing: -0.02em; margin: 0; }
      p { max-width: 48ch; margin: 40px 0 0; font-size: 14px; line-height: 1.8; letter-spacing: 0.02em; }
      .actions { display: flex; gap: 40px; flex-wrap: wrap; }
      a, button { display: inline-flex; align-items: center; height: 40px; padding: 0 20px; border: 3px solid #ffffff; background: #000000; color: #ffffff; font: inherit; letter-spacing: inherit; text-transform: inherit; text-decoration: none; cursor: pointer; border-radius: 0; }
      a:hover, button:hover, a:focus-visible, button:focus-visible { background: #ffffff; color: #000000; outline: none; }
      .band { height: 20px; border: 3px solid #ffffff; margin-top: 40px; }
    </style>
  </head>
  <body>
    <div class="top"><span>MIRE / DEFAUT DE LECTURE</span><span>ERR</span></div>
    <div>
      <h1>SIGNAL<br />CORROMPU</h1>
      <p>LA PAGE N'A PAS PU ETRE COMPOSEE. RELANCER LA CALIBRATION OU REVENIR A L'INDEX.</p>
      <div class="band"></div>
    </div>
    <div class="actions">
      <button type="button" onclick="location.reload()">RELANCER</button>
      <a href="/">INDEX</a>
    </div>
  </body>
</html>`;
}
