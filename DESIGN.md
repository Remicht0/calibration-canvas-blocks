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
- **Fonte bitmap 3x5** (`src/lib/glyphs.ts`) : chiffres et `%` dessines bloc
  par bloc. Utilisee par `BitReadout`, l'horloge et les compteurs.
- Deux fontes maximum, une seule graisse par fonte. Texte en **français, en
  capitales, sans accents** dans l'interface (contrainte de mire).

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

### Transition de page (`RouteWipe`)

1500 ms, trois temps, jamais de fondu :

| Temps | Part | Rendu |
| --- | --- | --- |
| Recouvrement | 0 → 0,40 | les blocs noirs tombent du haut, `easeOutCubic`, bruit par colonne |
| Palier | 0,40 → 0,56 | ecran noir plein, un seul repere rouge balaye la surface |
| Chute | 0,56 → 1 | les blocs se vident du bas vers le haut, `easeInOutCubic`, 6 % de cellules resistent |

Un compteur `000 → 100` en display et la mention `MIRE / RECALIBRAGE`
accompagnent la sequence. Aucun `mix-blend-mode` sur ce calque : il ferait
apparaitre une couleur parasite au croisement du repere rouge.

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
                       année, nature, client, image, lignes)
  components/
    mire.tsx           BlockImage, BlockType, BlockBackdrop, ScanLine
    media.tsx          HybridMedia — photo/vidéo échantillonnée dans la grille
    bars.tsx           CalibrationBand, Ticker
    boot.tsx           BootSequence, GridCursor, NegativeSwitch
    bitmap-extras.tsx  BitmapClock, BitmapBoard (automate 23/3), NoiseField
  routes/
    __root.tsx         chrome global : ScanLine, GridCursor, NegativeSwitch,
                       BootSequence, fontes, métadonnées de base
    index.tsx          entrée + index + banc d'essai + procédé + atelier
                       (manifeste) + Colophon (exporté et réutilisé)
    projet.$slug.tsx   page projet
    atelier.tsx        instruments manipulables
    contact.tsx        fiche de calibration (coordonnees, horaires, mentions)
```

### Modes de lecture d'un média (`BitMode`)

| Mode | Rendu | Usage |
| --- | --- | --- |
| `bin` | seuil dur 1-bit | identité du site, planches de détail |
| `gris` | N paliers quantifiés (défaut 5) | **photos perso** : contraste doux, intégration propre |
| `brut` | mosaïque couleur, 1 bloc = 1 pixel | matière assumée, vidéo |

Loupe : au survol, un disque de cellules passe en `brut`, avec un anneau en
`gris`. C'est le seul moyen de voir la matière réelle.

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
- [x] `/atelier` : automate 23/3, planche de bruit, horloge en blocs.
- [x] `/contact` : fiche de calibration + `head()` dedie.
- [x] 404 et page d'erreur redessinees en mire (aucun style shadcn residuel).
- [x] Passe responsive 393 / 820 / 1440 px, aucun debordement horizontal.
- [x] Transition de page en trois temps (`RouteWipe`, 1500 ms, masque plein
      ecran, desactivee sous `prefers-reduced-motion`).
- [x] Feuille `@media print` : noir seul, repere rouge et chrome retires.
- [x] Focus visible en bloc (contour rouge de 3 px, aucun halo).
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

Reste a faire :
- [ ] Remplacer les 4 images de demonstration par les vrais projets.
- [ ] Video reelle sur au moins une page projet, testee en `gris` et `brut`.
- [ ] `og:image` par projet : export PNG 1-bit genere depuis la planche.


## 8. Contrôles avant livraison

1. Une seule ligne rouge visible à l'écran, alignée sur le pas de grille.
2. Zoom 400 % : aucun bloc coupé, aucun demi-pixel.
3. Mobile 393 px : les blocs restent gros, la grille ne devient jamais fine.
4. Touche `N` (négatif) : tout s'inverse, le repère rouge reste rouge.
5. Console vide, build sans erreur, aucun `border-radius` dans le rendu.
6. 393 / 820 / 1440 px : `document.documentElement.scrollWidth === innerWidth`.
