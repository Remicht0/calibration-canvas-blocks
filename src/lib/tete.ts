import { useEffect, useRef, type RefObject } from "react";
import { cellSizeFor, scanLineTop } from "./mire";

/**
 * Tactile : il n'y a pas de survol, la ligne rouge sert de tete de lecture.
 * La ligne de liste qu'elle croise devient active, a defaut la plus proche a
 * moins de trois cellules ; hors de la liste, plus rien n'est actif et le fond
 * retombe au noir. Sur un pointeur qui survole (hover: hover), le hook ne pose
 * aucun ecouteur : le survol et le focus suffisent.
 *
 * `onPick` recoit l'indice de la ligne active, ou null, et seulement quand il change.
 */
export function useTeteTactile(
  items: RefObject<Array<HTMLElement | null>>,
  onPick: (index: number | null) => void,
) {
  const pick = useRef(onPick);
  pick.current = onPick;

  useEffect(() => {
    if (window.matchMedia("(hover: hover)").matches) return;
    let raf = 0;
    let last: number | null | undefined;
    const update = () => {
      raf = 0;
      const cell = cellSizeFor(window.innerWidth);
      // milieu du trait rouge (10 px), dans le repere de la fenetre
      const line =
        scanLineTop(cell, window.scrollY, window.innerHeight, document.body.scrollHeight) + 5;
      const reach = cell * 3;
      let best: number | null = null;
      let bestD = Infinity;
      (items.current ?? []).forEach((el, i) => {
        if (!el) return;
        const r = el.getBoundingClientRect();
        const d = line < r.top ? r.top - line : line > r.bottom ? line - r.bottom : 0;
        if (d <= reach && d < bestD) {
          bestD = d;
          best = i;
        }
      });
      if (best !== last) {
        last = best;
        pick.current(best);
      }
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [items]);
}
