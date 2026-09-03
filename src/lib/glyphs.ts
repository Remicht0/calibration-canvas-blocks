// MIRE — fonte bitmap 3x5. Un glyphe = une matrice de blocs, jamais un contour.

export const GLYPH3x5: Record<string, string[]> = {
  "0": ["111", "101", "101", "101", "111"],
  "1": ["010", "110", "010", "010", "111"],
  "2": ["111", "001", "111", "100", "111"],
  "3": ["111", "001", "111", "001", "111"],
  "4": ["101", "101", "111", "001", "001"],
  "5": ["111", "100", "111", "001", "111"],
  "6": ["111", "100", "111", "101", "111"],
  "7": ["111", "001", "010", "010", "010"],
  "8": ["111", "101", "111", "101", "111"],
  "9": ["111", "101", "111", "001", "111"],
  ":": ["000", "010", "000", "010", "000"],
  ".": ["000", "000", "000", "000", "010"],
  "%": ["101", "001", "010", "100", "101"],
  "/": ["001", "001", "010", "100", "100"],
  "-": ["000", "000", "111", "000", "000"],
  " ": ["000", "000", "000", "000", "000"],
};

/** Largeur en cellules d'une chaine rendue en 3x5 (1 cellule de chasse). */
export const textCols = (text: string) => Math.max(0, text.length * 4 - 1);

/** Dessine une chaine en blocs pleins. Aucun anti-aliasing, aucun demi-bloc. */
export function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  unit: number,
  ox = 0,
  oy = 0,
) {
  [...text].forEach((ch, i) => {
    const g = GLYPH3x5[ch] ?? GLYPH3x5["-"]!;
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 3; x++) {
        if (g[y]![x] === "1") {
          ctx.fillRect(ox + (i * 4 + x) * unit, oy + y * unit, unit, unit);
        }
      }
    }
  });
}
