# MIRE Calibration Studio

Portfolio d'un studio de design graphique nommé MIRE.

Une seule idée directrice, exécutée sans compromis : le site 

entier est une mire de calibration — une image de test.

LE PRINCIPE

"Mire" = image de calibration, celle qu'on affiche pour régler 

un écran ou une presse. Tout le site obéit à cette logique : 

noir et blanc pur, grille de blocs grossiers, une seule ligne 

rouge de repère. Le site ne décore pas, il calibre.

LA GRILLE — le cœur du système

Toute la page est construite sur une grille de blocs carrés 

visibles et volontairement grossiers (16 à 24 px selon le 

viewport). RIEN n'échappe à cette grille : images, titres, 

blocs de texte, marges, tout s'aligne sur le pas de la grille 

et s'y découpe. Aucune diagonale, aucune courbe, aucun coin 

arrondi, aucun anti-aliasing. Uniquement des formes 

orthogonales à angles droits.

LE TRAITEMENT D'IMAGE

Chaque image est réduite en 1-bit sur cette grille de blocs, 

en canvas, en temps réel. PAS de dithering fin en points — du 

BLOC. Un seuil binaire dur : chaque cellule de la grille est 

soit noire pleine, soit blanche pleine. Le résultat doit être 

massif et lisible de loin, jamais texturé ou grisâtre.

LA DISSOLUTION — le seul mouvement du site

Les images et les blocs n'apparaissent ni ne disparaissent en 

fondu. Ils se dissolvent par CHUTE DE BLOCS : les cellules 

tombent une par une, de façon pseudo-aléatoire, en densité 

décroissante vers le bas — exactement comme une image qui se 

désagrège par le bas en laissant des colonnes isolées qui 

tiennent plus longtemps que les autres. Ce mouvement est le 

seul du site. Il sert au chargement, au scroll, au survol, aux 

transitions de page. Rien d'autre ne bouge.

LA COULEUR

Noir #000000 et blanc #FFFFFF. Purs, sans nuance, sans gris.

Une seule ligne rouge #FF0000, horizontale, épaisse (8 à 12 px), 

alignée sur la grille. Elle traverse la page de bord à bord et 

marque la position de lecture — elle se déplace au scroll comme 

une tête de lecture. Elle apparaît une seule fois à l'écran. 

C'est le seul élément coloré du site entier.

LA TYPOGRAPHIE

Une grotesque condensée très large, en capitales, pour les 

titres — posée en display énorme, tracking serré, alignée au 

bloc, quitte à sortir du cadre.

Un monospace petit pour tout le reste — index, légendes, 

métadonnées. Interligne calé sur le pas de la grille.

Deux fontes maximum. Aucune graisse intermédiaire.

LA STRUCTURE

- Entrée : MIRE en display plein écran, rendu en blocs, qui se 

  dissout et se recompose au chargement. Une ligne monospace en 

  dessous. La ligne rouge. Rien d'autre.

- Index des projets : liste typographique dense en monospace 

  (numéro / titre / année / nature), alignée au bloc. Au survol 

  d'une ligne, l'image du projet se compose en blocs en fond de 

  page, derrière le texte, en négatif.

- Pages projet : verticales, blocs pleine largeur alternant 

  noir et blanc, images en 1-bit massif, texte en monospace en 

  colonne étroite.

- Pied de page : un colophon technique, en monospace, comme une 

  fiche de calibration — contact, année, mention du procédé.

CONTRAINTES

HTML/CSS/JS vanilla, un seul fichier. Le rendu 1-bit et la 

dissolution en canvas, avec un vrai algorithme, pas des filtres 

CSS ni des SVG filters. Performance fluide à 60fps. Responsive : 

sur mobile la grille garde des blocs larges, elle ne devient 

jamais fine.

À NE PAS FAIRE

Aucun grain, aucune texture, aucun bruit, aucun artefact de 

scan, aucun effet grunge, aucun curseur custom, aucune ombre, 

aucun dégradé, aucune deuxième couleur. Le site est propre, 

dur et vide. La force vient du contraste et du vide, pas de 

l'accumulation.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/8d8f352d-4e8e-4314-8eb0-dda1c8b892c8).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
