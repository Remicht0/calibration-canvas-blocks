# MIRE — Système de design & protocole de production

Document de référence du site MIRE. Toute contribution (humaine ou IA) doit
s'y conformer. En cas de doute : **le site ne décore pas, il calibre.**

---

## 1. Principe directeur

Le site entier est une **mire de calibration** : une image de test.
Noir pur, blanc pur, une grille de blocs grossiers, **une seule ligne rouge**.
La force vient du contraste et du vide, jamais de l'accumulation.

---

## 2. Design system

### Couleurs (aucune autre n'est autorisée)

| Rôle | Valeur |
| --- | --- |
| Encre | `#000000` |
| Papier | `#FFFFFF` |
| Repère de lecture (unique) | `#FF0000` |

- Aucun gris CSS, aucun dégradé, aucune ombre, aucune opacité décorative.
- Les seuls "gris" tolérés sont **quantifiés en paliers dans le canvas**
  (mode `gris` du noyau bitmap), jamais en CSS.
- Le rouge n'apparaît qu'une fois à l'écran : la `ScanLine`.

### Grille

- Pas de grille : `--cell` = **16 px** (mobile) / **20 px** (≥ 768 px).
- Utilitaires d'espacement dérivés : `cell`, `cell2`, `cell3`, `cell4`,
  `cell6`, `cell8` (`px-cell`, `py-cell4`, `gap-cell`…).
- Tout s'aligne sur ce pas : marges, interlignage mono, blocs canvas, filets.
- Filets de séparation : `border-[10px]` (macro) ou `border-[3px]` (cadres).
- `--radius-*` = `0px` partout. Aucun coin arrondi, jamais.

### Typographie

- **Display** : `Anton` (`.u-display`), capitales, tracking `-0.02em`,
  line-height ≤ 0.95. Tailles en `vw`, elles peuvent sortir du cadre.
- **Mono** : `JetBrains Mono` (`.u-mono`), 12 px (12,5 px >= 768 px),
  capitales, tracking `0.045em`, line-height 1.45. Reserve aux **etiquettes**
  (en-tetes, chiffres, navigation).
- **Copie** : `.u-copy`, 13 px (14 px >= 768 px), line-height 1.75 / 1.8,
  tracking `0.02em`, mesure <= 46 caracteres. Reserve aux **paragraphes** :
  un texte courant ne doit jamais rester en `.u-mono`.
- **Fonte bitmap 3x5** (`src/lib/glyphs.ts`) : la seule table de glyphes du
  site (chiffres, capitales, ponctuation), dessinee bloc par bloc par
  `drawText`. Deux corps seulement : **etiquette**, `bitUnit(cell)` =
  `round(cell / 5)` (4 px bureau, 3 px mobile : un glyphe = une cellule de
  haut), et **display**, un bloc = une cellule. `BitReadout` prend l'etiquette
  par defaut et la suit au redimensionnement ; `BitmapClock` expose
  `size="etiquette" | "display"`. Aucun autre corps, aucune table dupliquee.
- Deux fontes maximum, une seule graisse par fonte. Texte en **français, en
  capitales, sans accents** dans l'interface (contrainte de mire).
- Les deux fontes sont **auto-hébergées** (`public/fonts/*.woff2`, sous-ensemble
  latin, SIL OFL, licences dans `LICENCES.txt`) et préchargées : aucune requête
  vers un tiers, aucun transfert d'adresse IP (RGPD), aucun saut de mise en page.

### Accents et diacritiques (décision)

Anton et JetBrains Mono possèdent les capitales accentuées : le choix est donc
délibéré, pas une limite technique.

- **Dans la mire (tout ce qui est rendu à l'écran)** : capitales **sans
  accents**, sans cédille, sans ligature (`OEUVRE`, `CA`, `A PARTIR`). Un
  accent sur une capitale est un trait de 1 à 2 px à 12 px de corps : plus fin
  que le bloc, il n'a pas sa place sur une mire. En display, il dépasserait la
  hauteur de capitale sur laquelle l'interligne (0,82) est calé. Les
  apostrophes et les tirets restent (`D'ANTENNE`, `2022 — 2024`).
- **Hors mire (ce qui n'est jamais rendu dans la grille)** : français
  courant, **accentué, en bas de casse** : `<title>`, `meta description`,
  `og:*`, textes alternatifs (`alt`, `aria-label`), contenus `sr-only`. Les
  lecteurs d'écran prononcent correctement un mot accentué et risquent
  d'épeler un mot en capitales ; les moteurs de recherche et les cartes de
  partage sont lus hors calibration.
- **Dans les données** (`src/lib/projects.ts`) : les champs visibles (`title`,
  `nature`, `client`, `lines`) suivent la règle de la mire ; les champs hors
  mire (`resume`, `alt`) sont écrits en français accentué.
- **Dans la fonte bitmap 3x5** (`glyphs.ts`) : aucun glyphe accentué, par
  construction. L'export `og:image` en hérite.
- `<html lang="fr">` reste : la langue du site est le français, même sans
  accents.

### Mouvement

Un seul mouvement : la **chute de blocs** (`fallOrder` + `progress`).
Densité décroissante vers le bas, bruit par colonne, cellules isolées qui
tiennent plus longtemps. Sert au chargement, au scroll, au survol, aux
transitions. Le ticker (translation linéaire) est la seule exception, et il
est désactivé sous `prefers-reduced-motion`.

Deux pilotages pour une planche (`HybridMedia`, prop `drive`) :
`time` (défaut) compose la planche en une seconde à son entrée en écran ;
`scroll` lie `progress` au défilement — 0 quand le haut de la planche entre
par le bas, 1 quand il atteint 45 % de la hauteur d'écran, et à rebours en
remontant. Le banc d'essai et les planches 02 sont pilotés au scroll.

Les titres en blocs (`BlockType`) ont deux pilotages de plus :
- `drive="scan"` : **la ligne rouge lit le titre**. Les rangées que la
  ScanLine a dépassées de plus de 6 cellules tombent ; celles encore sous la
  ligne tiennent ; dans la bande de 6 cellules, `fallOrder` décide bloc par
  bloc, colonne par colonne — jamais un front rectiligne. En remontant, la
  ligne relit et le titre se recompose. Le seul élément coloré du site est
  ainsi une vraie tête de lecture : ce qu'elle a lu disparaît. `drawBits`
  accepte pour cela un `progress` par rangée ; `scanLineTop()` (`mire.ts`) est
  la position de la ligne, partagée avec `ScanLine`. Titres des pages projet,
  atelier, contact et index (après sa séquence d'entrée).
- `erodible` (défaut) : **le curseur use les blocs**. Sur un pointeur fin, les
  cellules d'un carré de 5 x 5 autour du curseur tombent une à une (usure par
  temps de présence, les plus basses d'abord) ; quand il quitte le titre, les
  blocs manquants se recomposent par ordre de chute en 700 ms. Voisinage
  carré (Tchebychev), jamais un disque. Désactivé sous `pointer: coarse` et
  `prefers-reduced-motion`. Un seul `requestAnimationFrame` par titre porte
  la séquence, la lecture et l'usure ; il s'arrête quand l'onglet est caché.

### Chrome commun

- `TopBar` (`chrome.tsx`) sur chaque page : `MIRE` puis `INDEX / ATELIER /
  CONTACT` à partir de 768 px, page courante marquée d'un bloc `■`, et un
  emplacement à droite propre à la page (studio, numéro / année, horloge,
  fiche). Sous 768 px, la console en bas d'écran porte la navigation.
- Gouttières bureau : la réglette occupe la marge gauche (2 cellules),
  l'inverseur `NEGATIF [N]` la marge droite (3 cellules). Aucun contenu ne
  passe sous l'un ou l'autre.
- Curseur bloc : une cellule blanche en différence ; sur un lien elle se
  creuse en cadre. Jamais de rouge sur le curseur (le repère est unique, et
  un rouge en différence sur fond blanc donnerait du cyan).
- Page projet : le bloc `SUITE` liste les autres projets avec le survol en
  négatif de l'index, `PRECEDENT` / `SUIVANT` étiquetés, et les flèches du
  clavier feuillettent les projets.
- Réglette et console : blocs pleins sur le pas `u = bitUnit(cell)` (rang
  vide u x u, posé 3u x u, repère de piste 4u x u, tête 5u x 2u ; cran de
  jauge vide = socle plein de u px). Le compteur de la réglette empile ses
  glyphes, un par rang. Plus aucun contour translucide nulle part. Un seul
  des deux instruments est monté à la fois (`useIsMobile`, 768 px).

### Blocs et etats d'interaction (1 bit)

- Tokens `--ink` / `--paper` (encre, papier). La classe `.on-black`, posee sur
  tout conteneur a fond noir, les inverse : un composant ne connait jamais sa
  couleur, il lit le token.
- `.u-bloc` (composant `Bloc`, `bloc.tsx`) : tout bouton ou lien cadre. Cadre
  3 px encre, hauteur 2 cellules, padding 1 cellule, mono. Survol
  (`hover: hover`), `aria-pressed="true"`, `aria-current="page"` et focus =
  inversion seche encre / papier. Aucune transition. Ne s'applique pas aux
  lignes de l'INDEX ni de la SUITE (mix-blend-mode difference), ni aux onglets
  de la console (grille pleine largeur, inversion par etat en place).
- Focus visible : contour 3 px encre a 3 px du bord, sur tout element
  focalisable. Jamais de rouge : le repere est unique, et un rouge sous
  `invert(1)` donnerait du cyan.
- Marqueur de page courante (TopBar, index) : un bloc de 10 px, jamais un
  glyphe.
- Fiche de commande ouverte : `#contenu`, la console et l'inverseur sont
  `inert`, le focus est captif sur FERMER, la classe `mire-modal` sur `html`
  suspend les raccourcis des autres composants (N, fleches, reglages).
  Fermeture : ESC, `?`, changement de route. Le verrou est `lockPage` /
  `unlockPage` (`modal.ts`), partage avec le plein cadre et imbricable.
- Plein cadre (`plein.tsx`, `PleinCadre`) : le bloc `PLEIN [F]` du cartouche
  (ou la touche `F` sur la planche survolee / focalisee) ouvre un masque noir
  plein ecran ou la meme source est re-echantillonnee a la taille de l'ecran :
  la cellule reste 16 / 20 px, l'image gagne des colonnes, pas des pixels
  (`HybridMedia fit="viewport"`). Elle se compose par chute en une seconde ;
  BIN / GRIS / BRUT, la loupe et les reglages restent actifs. En-tete
  `MIRE / PLEIN CADRE`, bloc `FERMER [ESC]`. Fermeture par ESC, FERMER, le
  geste retour (entree d'historique propre, retiree a la fermeture) ou un
  changement de route : les blocs tombent (`phase="out"`, progress 1 -> 0 en
  600 ms, meme ordre) puis le masque disparait. Plein ecran systeme quand
  l'API existe (jamais sur iOS : le masque fixe est le rendu). L'evenement
  `mire:modal` arrete les planches de la page sous le masque. Le focus
  revient au bloc PLEIN a la fermeture.
- Tete de lecture clavier sur l'index : `HAUT` / `BAS` (et `HOME` / `END`)
  deplacent un curseur sur les projets. La ligne prend le bloc plein (le
  marqueur de 10 px), son image se compose en negatif dans le fond
  (`BlockBackdrop`), le lien est focalise et amene au centre de l'ecran d'un
  saut sec (`scrollIntoView` `instant`, jamais `smooth`). `ENTREE` ouvre
  (lien natif), `ESC` relache. Les fleches ne sont prises que si la section
  INDEX est a l'ecran ou porte le focus ; ailleurs la page defile
  normalement. Un chiffre `1` a `N` saute directement au projet N, depuis
  l'index comme depuis une page projet. Tous ces raccourcis sont suspendus
  sous `mire-modal`.
- Inversion du signal (`N`) : le filtre `invert(1)` porte sur `main` et sur
  le chrome fixe (`.mire-chrome` : inverseur, console, bouton AIDE, lien
  d'evitement), jamais sur `body` — un filtre sur `body` en ferait le bloc
  conteneur des elements fixes, qui defileraient avec la page. Le repere
  rouge, le curseur et la reglette (en difference) et les masques noirs ne
  sont pas filtres. Le repere est en z 130, au-dessus de la reglette ; le
  curseur s'efface quand sa cellule croise la ligne rouge (un blanc en
  difference sur du rouge donnerait du cyan).
- `CalibrationBand` : `negative` (fond noir, colonnes blanches) pour un
  conteneur noir ; `still` (une rangee de blocs, aucune animation) pour une
  ligne sans signal. `BlockType` accepte `negative`.
- 404 et erreur sont des mires : TopBar, titre en blocs (`PAS DE SIGNAL` en
  boucle : le signal qui ne tient pas ; `SIGNAL CORROMPU` une fois), bande
  `still`, copie, actions en `Bloc`. La page d'erreur est en `.on-black`.

### Transition de page (`RouteWipe`)

1500 ms, trois temps, jamais de fondu :

| Temps | Part | Rendu |
| --- | --- | --- |
| Recouvrement | 0 → 0,40 | les blocs noirs tombent du haut, `easeOutCubic`, bruit par colonne |
| Palier | 0,40 → 0,56 | ecran noir plein, un seul repere rouge balaye la surface |
| Chute | 0,56 → 1 | les blocs se vident du bas vers le haut, `easeInOutCubic`, 6 % de cellules resistent |

Tout est dessine dans le canvas du masque, jamais en HTML : le compteur
`000 → 100` (fonte 3x5, un bloc = une cellule, en bas a droite) et la mention
`MIRE / RECALIBRAGE` (une cellule de haut, en haut a gauche) sont peints en
XOR par cellule — blanc sur une cellule noire, noir sur une cellule vide, rien
sur la rangee rouge — et restent lisibles pendant les trois temps. **Le titre
de la page de destination traverse la transition** (MIRE, ATELIER, CONTACT ou
le titre du projet) : compose en blocs Anton pleine largeur, centre, avec son
propre `fallOrder` (graine 13), il se compose avec le recouvrement, tient au
palier et tombe avec le masque, en blanc uniquement sur les cellules noires.
S'il depasse `rows - 6`, il est compose sur moins de colonnes plutot que
coupe. Aucun `mix-blend-mode` ni opacite sur ce calque. Plan z : curseur 250
> fiche de commande 240 > boot 200 > masque de transition 195 > bouton AIDE
180 > inverseur 160 > ScanLine 50.

---

## 3. Architecture technique

Stack : **TanStack Start (React 19) + Vite + Tailwind v4**. Tout le rendu
d'image est fait **en canvas 2D avec un vrai algorithme** — jamais de filtre
CSS ni de filtre SVG.

```
src/
  lib/
    mire.ts            noyau 1-bit : blockifyImage, blockifyText,
                       textBlockHeight, fallOrder, drawBits, cellSizeFor
    bitmap.ts          noyau hybride : sample(), paintBlocks(), BitMode,
                       quantification en paliers, loupe, support vidéo
    projects.ts        source de vérité des projets (slug, num, titre,
                       année, nature, client, image, lignes, resume, alt)
    glyphs.ts          fonte bitmap 3x5 (capitales, chiffres, ponctuation),
                       mireText() : capitales sans accents
    site.ts            origine absolue du site (og:image, canonical, sitemap),
                       chemin des cartes, identite du studio (STUDIO)
    modal.ts           lockPage / unlockPage : verrou de page partage par les
                       masques (inert, mire-modal, overflow), imbricable
  components/
    mire.tsx           BlockImage, BlockType, BlockBackdrop, ScanLine
    media.tsx          HybridMedia — photo/vidéo échantillonnée dans la grille
    plein.tsx          PleinCadre — une planche a la taille de l'ecran (portail)
    instruments.tsx    Histogramme (20 tranches x 8 rangs, plein / cadre),
                       InstrumentSeuil (planche BIN pilotee par l'histogramme)
    miroir.tsx         Miroir — la camera ou une image du visiteur, en local
    bloc.tsx           Bloc — bouton / lien cadre 1 bit (.u-bloc)
    chrome.tsx         TopBar — barre haute commune
    help.tsx           KeyHelp — fiche de commande (raccourcis)
    bars.tsx           CalibrationBand, Ticker
    boot.tsx           BootSequence, GridCursor, NegativeSwitch
    bitmap-extras.tsx  BitmapClock, BitmapBoard (automate 23/3), NoiseField
  hooks/
    use-mobile.tsx     useIsMobile() — reste du gabarit, mais `__root.tsx`
                       s'en sert pour choisir la reglette (bureau) ou la
                       console (mobile) : ne pas le retirer sans le remplacer
  routes/
    __root.tsx         chrome global : ScanLine, GridCursor, NegativeSwitch,
                       BootSequence, fontes, métadonnées de base
    index.tsx          entrée + index + banc d'essai + procédé + atelier
                       (manifeste) + Colophon (exporté et réutilisé)
    projet.$slug.tsx   page projet
    atelier.tsx        instruments manipulables
    contact.tsx        fiche de calibration (coordonnees, horaires, mentions)
    sitemap[.]xml.tsx  route serveur : plan du site en URL absolues
    robots[.]txt.tsx   route serveur : robots.txt qui declare le sitemap
scripts/
  og.ts                export 1-bit : cartes de partage, icones, favicon
public/og/             cartes generees (mire.png + une par slug), versionnees
public/icons/          icones PWA / iOS generees (M en 5 x 5 blocs, 1 bit)
public/fonts/          Anton et JetBrains Mono auto-hebergees (woff2)
```

### Visibilite (SEO, partage, installation)

- `<link rel="canonical">` et `og:url` sur chaque page, en URL absolue.
- `og:site_name`, `og:locale`, `theme-color`, `manifest.webmanifest`
  (installation sur ecran d'accueil : tuile noire, M blanc en blocs).
- Donnees structurees JSON-LD : `Organization` (racine, depuis `STUDIO`) et
  `CreativeWork` par projet (titre, annee, nature, client, carte 1 bit).
- `/sitemap.xml` et `/robots.txt` sont des routes serveur : l'origine vient de
  la requete (ou de `VITE_SITE_URL`), rien n'est code en dur.
- Favicon : `favicon.svg` (rectangles pleins, `crispEdges`) et `favicon.ico`
  de secours (PNG 1 bit dans un conteneur ICO). Tout est produit par
  `bun run og`.

### Cartes de partage (`og:image`)

`bun run og` genere `public/og/<slug>.png` pour chaque projet et
`public/og/mire.png` pour le studio : des **PNG a 1 bit par pixel**, 1200 x 630,
moins de 1 Ko chacun. Aucun navigateur : le JPEG est decode en pur JS, reduit
par moyenne de bloc avec le meme recadrage `cover` que le site (`coverCrop`),
seuille par `bitsFromRGBA` avec un seuil d'Otsu borne a 0,30–0,60
(`otsuThreshold`, pour qu'une photo sombre ne devienne pas un aplat), puis
ecrit bloc par bloc. Composition : planche 34 x 42 cellules de 15 px a gauche
(la densite du site en bureau), fiche a droite en fonte 3x5 (`MIRE`, numero,
annee, titre, nature). Pas de rouge : un PNG 1 bit n'a que deux valeurs, et la
carte s'affiche a cote d'autres interfaces.

Les routes declarent `og:image`, `og:image:width/height/type/alt` et
`twitter:image` avec une URL absolue : `VITE_SITE_URL` si elle est definie,
sinon l'origine de la requete (`siteOrigin`, `src/lib/site.ts`). Relancer
`bun run og` a chaque ajout ou changement d'image de projet, et commiter les
PNG : ils sont servis tels quels depuis `public/`.

### Modes de lecture d'un média (`BitMode`)

| Mode | Rendu | Usage |
| --- | --- | --- |
| `bin` | seuil dur 1-bit | identité du site, planches de détail |
| `gris` | N paliers quantifiés (défaut 5) | **photos perso** : contraste doux, intégration propre |
| `brut` | mosaïque couleur, 1 bloc = 1 pixel | matière assumée, vidéo |

Loupe : au survol (souris, stylet) ou a l'appui long (tactile : 220 ms sans
bouger de plus de 6 px, puis le carre suit le doigt et se pose au-dessus de
lui, la page ne defile plus tant qu'il est tenu), un **carre** de cellules
(distance de Tchebychev, jamais un disque : aucune courbe) passe en `brut`,
avec un anneau d'une cellule en `gris`. C'est le seul moyen de voir la matiere
reelle. La loupe est dessinee des que `progress > 0`, en un seul rendu par
image.

---

## 4. Ajouter du contenu

### Un projet

1. Poser l'image dans `src/assets/` (JPG, ≥ 1600 px de large, contraste franc).
2. Ajouter l'entrée dans `src/lib/projects.ts` (`num` incrémenté, `slug` en
   kebab-case, textes en capitales sans accents pour les métadonnées).
   Deux champs **hors mire** sont obligatoires, en français accentué :
   `resume` (description de la page et des cartes de partage) et `alt`
   (une phrase qui décrit réellement l'image, jamais le titre du projet).
3. Rien d'autre : l'index, le survol en négatif, la page projet et le bloc
   « SUITE » se génèrent depuis ce fichier.

### Une photo ou une vidéo personnelle

- **Toujours** via `<HybridMedia />`. Jamais de `<img>` ni de `<video>` brut.
- `alt` décrit l'image pour les lecteurs d'écran (français accentué) ;
  `label` est l'étiquette visible sous la planche (capitales sans accents).
  Ne jamais mettre l'un à la place de l'autre.
- Sous chaque planche, `ENCRE nn%` est mesuré sur la trame réelle
  (`inkRatio`, `bitmap.ts`) dans le mode courant : part des cellules encrées
  en BIN, noirceur moyenne des paliers en GRIS, de la matière en BRUT. C'est
  une mesure, pas une décoration : elle change avec le mode et avec la vidéo.
- Chaque planche se regle sous son cartouche : `SEUIL` (mode BIN, crans de
  0,05 entre 0,20 et 0,70, `AUTO` = seuil d'Otsu borne) ou `PALIERS` (mode
  GRIS, entiers de 2 a 8) avec `-` / `+`. Les raccourcis `-`, `+` (ou `=`) et
  `A` agissent sur la planche survolee ou focalisee. Un reglage redessine la
  trame en place : les blocs poses ne retombent jamais, `ENCRE` est remesure.
  Le seuil et les paliers vivent dans un ref lu par `draw()`, hors des
  dependances de l'effet.
- `onSample` recoit la trame echantillonnee (`Sampled`) a chaque composition
  et, pour une video, au plus toutes les 600 ms ; `histogram()` (`bitmap.ts`)
  en tire 20 tranches de luminance normalisees pour un instrument externe.
- Le format de la planche en cellules (`70 X 37`) est affiche apres `ENCRE`,
  en fonte bitmap : c'est une mesure, elle change avec la largeur disponible
  et en plein cadre. Un changement de mode redessine la trame en place, comme
  un reglage : les blocs poses ne retombent jamais.
- Une source **vivante** passe par la prop `stream` (un `MediaStream`) au lieu
  de `src` : `HybridMedia` pose `srcObject`, attend `loadedmetadata` et
  echantillonne chaque image. Il ne possede jamais le flux : il ne coupe aucune
  piste, c'est l'appelant qui ouvre et qui ferme. Le cartouche lit `DIRECT`, et
  `FIGER` / `REPRENDRE` remplace `PAUSE` / `LECTURE`. Sous
  `prefers-reduced-motion`, la planche se fige des la premiere trame obtenue.
- Le seuil peut etre pilote de l'exterieur : la prop `threshold` est
  resynchronisee dans le ref de reglage a chaque changement. L'instrument 04
  de l'atelier (`InstrumentSeuil`) relie ainsi une planche en BIN
  (`controls={false}`, `onSample`) a un histogramme de luminance en 20
  colonnes x 8 rangs de blocs : les colonnes a gauche de la coupure sont
  pleines (encre), celles a droite sont des cadres vides (papier) — la
  coupure se lit par plein / cadre, jamais par un repere colore. Elle se
  deplace au clic ou au glisser, aux fleches quand l'histogramme est focalise
  (`role="slider"`, `aria-valuetext` avec seuil et encrage), avec `-` / `+`,
  ou par AUTO (seuil d'Otsu borne ; l'etiquette lit OTSU tant que la valeur
  n'est pas reprise a la main).
- Photo douce / portrait / paysage → `mode="gris"`, `gamma` 0.7–0.85.
- Image très graphique → `mode="bin"`, `threshold` 0.40–0.48.
- Vidéo `.mp4` / `.webm` → détection automatique, lecture en boucle muette
  dans la grille ; préférer `mode="gris"` ou `brut`.
- Régler `ratio` sur un multiple du pas de grille visuel, pas au pixel près.

---

## 5. À NE PAS FAIRE

- Aucun grain, texture, bruit décoratif, artefact de scan, effet grunge.
- Aucun dégradé, aucune ombre, aucun flou, aucun `border-radius`.
- Aucune deuxième couleur, aucune seconde ligne rouge à l'écran.
- Aucun dithering fin en points : **du bloc**, toujours.
- Aucune diagonale, aucune courbe, aucun anti-aliasing sur les formes.
- Aucun filtre CSS/SVG pour simuler le 1-bit (le canvas fait le travail).
- Aucune transition `fade` / `ease` décorative : la dissolution ou rien.
- Aucun composant shadcn stylé "produit SaaS" (cartes molles, badges, tabs).
- Pas de `<img>` brute pour un média de projet.
- Pas de couleur en dur hors du canvas : passer par les tokens.

---

## 6. Responsive

- Pas de grille : 16 px < 768 px, 20 px au-dela. Les blocs restent gros : on ne
  reduit jamais la cellule pour faire tenir plus de contenu, on reduit le
  nombre de colonnes.
- Tout canvas se dimensionne en `floor(largeurDisponible / cell)` colonnes, en
  retirant les bordures (`- 6` pour un cadre `border-[3px]`). Jamais de
  `scrollWidth` superieur a `innerWidth` : verifie en 393 / 820 / 1440 px.
- Lignes mixtes (texte + widget) : `grid-cols-[minmax(0,1fr)_auto]` en mobile,
  `flex` a partir de `sm:`, `min-w-0` sur les conteneurs de texte,
  `shrink-0` sur les blocs de taille fixe.
- Index des projets : annee et nature sont empilees sous le titre en mobile,
  en colonnes a partir de `md:`.
- `GridCursor` et `cursor: none` sont desactives sur `pointer: coarse`.
- `HybridMedia` : barre de controle repliable, boutons alignes a droite en
  pleine largeur sous 640 px.

## 7. Etat d'avancement

Fait :
- [x] Noyau 1-bit (`mire.ts`) : seuillage, chute de blocs, texte en blocs.
- [x] Noyau hybride (`bitmap.ts`) : modes BIN / GRIS / BRUT, loupe, video.
- [x] Chrome global : boot, curseur bloc, inversion `N`, ligne rouge.
- [x] Accueil : entree, index en negatif au survol, banc d'essai, procede,
      manifeste, colophon.
- [x] Pages projet avec planches hybrides et bloc « SUITE ».
- [x] `/atelier` : automate 23/3, planche de bruit, horloge en blocs,
      histogramme et seuil (instrument 04), miroir (instrument 05).
- [x] `/contact` : fiche de calibration + `head()` dedie.
- [x] 404 et page d'erreur redessinees en mire (aucun style shadcn residuel).
- [x] Passe responsive 393 / 820 / 1440 px, aucun debordement horizontal.
- [x] Transition de page en trois temps (`RouteWipe`, 1500 ms, masque plein
      ecran, desactivee sous `prefers-reduced-motion`).
- [x] Feuille `@media print` : noir seul, repere rouge et chrome retires.
- [x] Focus visible : contour encre 3 px (jamais rouge), blocs `.u-bloc`
      inverses au survol / presse / courant / focus, tokens `--ink` /
      `--paper` + `.on-black`.
- [x] `prefers-reduced-motion` : la sequence de boot est sautee (comme la
      transition de page et le ticker).
- [x] Instruments de defilement redessines : reglette bureau (compteur
      bitmap, reperes de piste, tete de lecture) et console mobile (piste
      courante, compteur bitmap, jauge a 20 crans dont 1 sur 5 pleine hauteur).
      Les pistes sont declarees par `data-mire="NOM"` sur chaque `<section>`.
- [x] Echelle typographique revue pour la lisibilite (`.u-mono` / `.u-copy`).
- [x] Budget performance : `HybridMedia` met son canvas et sa video en pause
      des que la planche sort du viewport, et reprend a l'entree.
- [x] Accents : capitales sans accents dans la mire, francais accentue hors
      mire (metadonnees, `alt`, `sr-only`). Decision documentee en §2.
      Les paragraphes courants passent tous en `.u-copy`.
- [x] Accessibilite : `alt` reel sur chaque planche (champ `alt` du projet,
      distinct de l'etiquette visible), lien d'evitement « ALLER AU CONTENU »,
      un `h1` et des `h2` par page, `aria-pressed` / `aria-current` sur les
      commandes, bouton lecture / pause sur les videos, bandeau lu une seule
      fois. `prefers-reduced-motion` couvre desormais aussi les planches,
      les bandes de calibration et le fond de l'index (pose immediate).
      Reste : la touche `N` est un raccourci a une seule lettre (WCAG 2.1.4),
      tolere car le site n'a aucun champ de saisie ; les alt des vraies
      planches restent a ecrire avec les vrais projets.
- [x] `og:image` par projet : PNG 1 bit genere depuis la planche par
      `bun run og` (`scripts/og.ts`), fonte 3x5 etendue aux capitales,
      metadonnees `og:image` / `twitter:image` en URL absolue.
- [x] Fontes auto-hebergees et prechargees (plus aucune requete Google Fonts).
- [x] Visibilite : canonical, `og:url`, JSON-LD, manifest, icones et favicon
      1 bit generes, `sitemap.xml` et `robots.txt` en routes serveur.
- [x] Chrome commun (`TopBar`), gouttiere droite pour l'inverseur, curseur
      sans rouge ; page projet : SUITE en negatif au survol, PRECEDENT /
      SUIVANT, fleches du clavier.
- [x] Planches : taux d'encrage mesure (`ENCRE nn%`) et chute liee au
      defilement (`drive="scroll"`) sur le banc d'essai et les planches 02.
- [x] Fiche de commande (`help.tsx`, `KeyHelp`) : masque noir plein liste des
      raccourcis (N, ?, fleches, tab, loupe), ouverture par `?` ou par le
      bouton `AIDE [?]` en bas a droite (bureau), fermeture par `ESC`.
      Captive : `inert` sur la page, focus piege sur FERMER, `mire-modal`.
- [x] 404 et erreur en mires (`still`, `negative`, titre en blocs).
- [x] Titres en blocs : la ligne rouge lit les titres (`drive="scan"`), le
      curseur use les blocs (`erodible`), un seul rAF par titre.
- [x] Planches : seuil / paliers reglables sous chaque cartouche (- + AUTO,
      raccourcis - + A), loupe carree, loupe a l'appui long sur tactile, prop
      `onSample` et `histogram()`.
- [x] Compteurs bitmap : une fonte, deux corps, plus aucun gris (reglette et
      jauge en blocs pleins) ; compteur et titre de destination dessines dans
      le canvas de la transition (XOR par cellule).
- [x] Plein cadre (`PLEIN [F]`, `plein.tsx`), verrou de page partage
      (`modal.ts`), format de la planche en cellules dans le cartouche.
- [x] Tete de lecture clavier sur l'index (HAUT / BAS, HOME / END, ESC) et
      saut par chiffre 1 - N.
- [x] Instrument 05 — MIROIR : camera ou image locale du visiteur, en direct
      dans la grille, tout en local, avec enregistrement de la trame en PNG.
      Relu par quatre relecteurs adversariaux (vie privee, regles, code,
      accessibilite) ; 23 constats corriges, 85 tests de navigateur.
- [x] Negatif : filtre sur `main` et le chrome fixe, plus sur `body` (les
      elements fixes defilaient avec la page) ; repere au-dessus de la
      reglette ; curseur efface sur la ligne rouge.
- [x] Revue adversariale (26 constats confirmes, corriges) : curseur
      redessine au defilement et masque pendant le balayage rouge de la
      transition ; horloge a deux corps seulement ; boot qui dessine ses
      blocs ; index sans piege de fleches ; verrou de page complet ; page
      de secours serveur en mire ; boucles rAF a l'ecran seulement (bandes,
      bruit, titres) ; canvas de travail partage pour l'echantillonnage ;
      region aria-live ecrite par le visiteur seulement ; figure nommee ;
      CSS sans le kit shadcn ni tw-animate-css (78 Ko -> 20 Ko) ;
      react-query retire.
- [x] Kit shadcn du gabarit supprime du depot : `src/components/ui/`
      (46 fichiers, 145 Ko de source), `src/lib/utils.ts` (`cn()`, devenu
      orphelin) et `components.json` retires, avec les 42 dependances qui
      n'existaient que pour lui (26 `@radix-ui/*`, `lucide-react`, `recharts`,
      `react-hook-form`, `zod`, `date-fns`, `cmdk`, `vaul`, `sonner`, `clsx`,
      `tailwind-merge`, etc.) : 50 dependances d'execution, il en reste 8. Le
      garde-fou `@source not "../src/components/ui"` de `styles.css` est tombe
      avec le dossier. JS client inchange a l'octet pres (419 153 o) : le kit
      n'etait deja plus compile. Lint a zero erreur et zero avertissement.
- [x] Jetons shadcn retires de `styles.css` avec le kit : les 33 mappages
      `--color-*` du `@theme inline`, les 32 valeurs `oklch` de `:root`, le
      bloc `.dark` entier et la variante `dark` sur mesure. Aucun `dark:` ni
      aucune de ces classes (`bg-card`, `text-muted-foreground`, `bg-chart-1`,
      `bg-sidebar`...) n'existait dans le site : le navigateur recevait 64
      valeurs `oklch` mortes, dont des teintes hors palette (`--chart-*`
      orange et jaune, `--sidebar-*` bleutes, `--destructive` rouge-orange)
      contraires a la section 2. Seule regle qui s'en servait : le
      `* { border-color }` de base, repointe sur `var(--ink)`. CSS client
      20 564 o -> 18 148 o ; rendu inchange (bordures, rayons et contours
      identiques sur 390 elements, 7 pages x 393/1440 px).

### Le miroir (instrument 05)

Le site cesse de calibrer des images de demonstration : il calibre le visiteur.
Sa camera, ou une image qu'il depose, choisit ou colle, est echantillonnee en
direct dans la grille, avec le meme noyau que toute autre planche — les trois
lectures, le seuil et Otsu, la loupe, l'encrage, le plein cadre. Il peut
enregistrer la trame obtenue en PNG.

Regles propres a cet instrument, non negociables :

- **Rien ne sort de l'appareil.** Aucune requete, aucun stockage (ni
  `localStorage`, ni `sessionStorage`, ni `IndexedDB`), aucune copie qui
  survive a la fermeture. La phrase ecrite au visiteur est un engagement :
  « RIEN N'EST ENVOYE. LA MIRE EST CALCULEE DANS VOTRE NAVIGATEUR, LA SOURCE NE
  QUITTE JAMAIS VOTRE APPAREIL. »
- **Aucun chemin ne laisse la camera allumee.** Les pistes sont arretees au
  demontage, au changement de route, quand la section sort de l'ecran, quand
  l'onglet est cache, sur `pagehide`, au retour de `bfcache`, a FERMER, au
  remplacement de source — et meme quand la demande d'acces est encore en vol :
  une autorisation qui arrive apres la sortie est coupee a l'arrivee. L'etat
  affiche correspond toujours a l'etat reel du flux.
- **Aucun message brut du navigateur.** Un refus, une camera absente, occupee ou
  perdue s'ecrivent dans l'alphabet de la mire (`SIGNAL REFUSE`, `AUCUNE
  CAMERA`, `CAMERA OCCUPEE`, `SIGNAL PERDU`), et le depot d'image reste
  toujours propose.
- **Le creux reserve la place exacte** de la planche a venir, cartouche compris :
  ouvrir ou fermer une source ne fait jamais sauter la page.
- **Le clavier ne perd jamais le fil** : aucune commande ne disparait sous le
  focus, il est explicitement rendu a la commande equivalente a chaque
  changement d'etat.
- Sur pointeur grossier, aucun geste impossible n'est propose (ni glisser-deposer
  ni raccourci) ; `CAMERA SUIVANTE` n'apparait que s'il y a vraiment plusieurs
  capteurs.

### Budget de rendu (regle)

- Aucune boucle `requestAnimationFrame` ne tourne hors ecran, sous un masque
  (`mire:modal`) ou dans un onglet cache : `IntersectionObserver` +
  `visibilitychange`, comme `HybridMedia`, `CalibrationBand`, `BlockType`.
- Ce qui ne change qu'avec le defilement se redessine au defilement
  (`NoiseField`, `drive="scroll"`), jamais a chaque image.
- Un canvas de travail hors DOM est reutilise (`sample()`), jamais alloue par
  image ; un masque invisible libere son bitmap (`RouteWipe`).

Reste a faire :
- [ ] Remplacer les 4 images de demonstration par les vrais projets.
- [ ] Video reelle sur au moins une page projet, testee en `gris` et `brut`.


## 8. Contrôles avant livraison

1. Une seule ligne rouge visible à l'écran, alignée sur le pas de grille.
2. Zoom 400 % : aucun bloc coupé, aucun demi-pixel.
3. Mobile 393 px : les blocs restent gros, la grille ne devient jamais fine.
4. Touche `N` (négatif) : tout s'inverse, le repère rouge reste rouge.
5. Console vide, build sans erreur, aucun `border-radius` dans le rendu.
6. 393 / 820 / 1440 px : `document.documentElement.scrollWidth === innerWidth`.
