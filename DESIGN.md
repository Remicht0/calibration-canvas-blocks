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
- **Mono** : `JetBrains Mono` (`.u-mono`), 11 px, capitales, tracking `0.06em`,
  line-height = `var(--cell)`.
- Deux fontes maximum, une seule graisse par fonte. Texte en **français, en
  capitales, sans accents** dans l'interface (contrainte de mire).

### Mouvement

Un seul mouvement : la **chute de blocs** (`fallOrder` + `progress`).
Densité décroissante vers le bas, bruit par colonne, cellules isolées qui
tiennent plus longtemps. Sert au chargement, au scroll, au survol, aux
transitions. Le ticker (translation linéaire) est la seule exception, et il
est désactivé sous `prefers-reduced-motion`.

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
3. Rien d'autre : l'index, le survol en négatif, la page projet et le bloc
   « SUITE » se génèrent depuis ce fichier.

### Une photo ou une vidéo personnelle

- **Toujours** via `<HybridMedia />`. Jamais de `<img>` ni de `<video>` brut.
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

## 6. À FAIRE d'ici la version finale

- [ ] Remplacer les 4 images de démonstration par les vrais projets.
- [ ] Page `/contact` (fiche de calibration : mail, téléphone, adresse,
      mentions) avec `head()` dédié.
- [ ] Transition de page en chute de blocs (masque plein écran entre routes).
- [ ] Vidéo réelle sur au moins une page projet, testée en `gris` et `brut`.
- [ ] `og:image` par projet : export PNG 1-bit généré depuis la planche.
- [ ] Version imprimée : feuille `@media print` en noir seul, sans repère.
- [ ] Audit accessibilité : focus visible en bloc, `prefers-reduced-motion`
      couvrant chute de blocs et boot, textes alternatifs réels.
- [ ] Budget performance : 60 fps sur les pages projet, canvas en pause hors
      viewport (`IntersectionObserver` déjà en place — vérifier la vidéo).
- [ ] Passer le contenu FR en accents typographiques corrects si la fonte
      mono le permet, sinon documenter le choix.

---

## 7. Contrôles avant livraison

1. Une seule ligne rouge visible à l'écran, alignée sur le pas de grille.
2. Zoom 400 % : aucun bloc coupé, aucun demi-pixel.
3. Mobile 393 px : les blocs restent gros, la grille ne devient jamais fine.
4. Touche `N` (négatif) : tout s'inverse, le repère rouge reste rouge.
5. Console vide, build sans erreur, aucun `border-radius` dans le rendu.
