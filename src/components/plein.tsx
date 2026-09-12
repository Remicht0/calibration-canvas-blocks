import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { useRouterState } from "@tanstack/react-router";
import { Bloc } from "@/components/bloc";
import { HybridMedia, MODAL_EVENT } from "@/components/media";
import { lockPage, unlockPage } from "@/lib/modal";
import type { BitMode } from "@/lib/bitmap";

/* ------------------------------------------------------------------ */
/* Plein cadre : la meme source re-echantillonnee a la taille de       */
/* l'ecran. Masque noir plein, aucune transparence. La cellule reste   */
/* 16 / 20 px : l'image gagne des colonnes, pas des pixels. Fermeture  */
/* par ESC, le bloc FERMER ou le geste retour : les blocs tombent      */
/* (600 ms, meme ordre) puis le masque disparait.                      */
/* ------------------------------------------------------------------ */

const FOCUSABLE = 'button:not([disabled]), [tabindex="0"]';

export function PleinCadre({
  src,
  alt,
  label,
  mode,
  threshold,
  levels,
  gamma,
  lensRadius,
  onClose,
}: {
  src: string;
  alt: string;
  label?: string | undefined;
  mode: BitMode;
  threshold: number;
  levels: number;
  gamma: number;
  lensRadius?: number | undefined;
  onClose: () => void;
}) {
  const [phase, setPhase] = useState<"in" | "out">("in");
  const dialog = useRef<HTMLDivElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const closing = useRef(false);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  // notre entree d'historique, pour le geste retour ; retiree si on ferme autrement
  const pushed = useRef(false);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const origin = useRef(path);

  // fermeture demandee : les blocs tombent, puis onDissolved retire le masque
  const request = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    setPhase("out");
  }, []);

  // changement de route : le masque de transition prend la page, le plein cadre s'efface aussitot
  useEffect(() => {
    if (path !== origin.current) closeRef.current();
  }, [path]);

  useEffect(() => {
    lockPage();
    window.dispatchEvent(new CustomEvent(MODAL_EVENT, { detail: true }));

    // plein ecran systeme quand il existe (pas sur iOS : le masque fixe est le rendu)
    let entered = false;
    try {
      void document.documentElement.requestFullscreen?.()?.catch(() => {});
    } catch {
      /* refuse : le masque fixe suffit */
    }
    const onFullscreen = () => {
      if (document.fullscreenElement === document.documentElement) entered = true;
      else if (entered) request();
    };
    document.addEventListener("fullscreenchange", onFullscreen);

    // geste retour (mobile) : une entree d'historique a nous, retiree a la fermeture
    history.pushState({ ...history.state, plein: 1 }, "");
    pushed.current = true;
    const onPop = () => {
      pushed.current = false;
      request();
    };
    window.addEventListener("popstate", onPop);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") request();
    };
    window.addEventListener("keydown", onKey);

    const raf = requestAnimationFrame(() => closeBtn.current?.focus());

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("popstate", onPop);
      document.removeEventListener("fullscreenchange", onFullscreen);
      if (document.fullscreenElement) void document.exitFullscreen?.()?.catch(() => {});
      if (pushed.current && history.state?.plein === 1) {
        pushed.current = false;
        history.back();
      }
      window.dispatchEvent(new CustomEvent(MODAL_EVENT, { detail: false }));
      unlockPage();
    };
  }, [request]);

  // focus captif : Tab boucle entre les commandes du cartouche et FERMER
  const trap = (e: ReactKeyboardEvent) => {
    if (e.key !== "Tab" || !dialog.current) return;
    const items = Array.from(dialog.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (!items.length) return;
    e.preventDefault();
    const i = items.indexOf(document.activeElement as HTMLElement);
    const n = items.length;
    const next = i < 0 ? 0 : (i + (e.shiftKey ? -1 : 1) + n) % n;
    items[next]?.focus();
  };

  return createPortal(
    <div
      ref={dialog}
      role="dialog"
      aria-modal="true"
      aria-label="Plein cadre"
      onKeyDown={trap}
      className="on-black fixed inset-0 z-[240] flex flex-col overflow-hidden bg-black text-white"
    >
      <div className="u-mono flex shrink-0 items-center justify-between gap-cell px-cell py-cell">
        <span className="min-w-0 truncate">MIRE / PLEIN CADRE</span>
        <Bloc ref={closeBtn} onClick={request} className="shrink-0">
          FERMER [ESC]
        </Bloc>
      </div>
      <div className="min-h-0 flex-1 px-cell pb-cell">
        <HybridMedia
          src={src}
          alt={alt}
          label={label}
          mode={mode}
          threshold={threshold}
          levels={levels}
          gamma={gamma}
          lensRadius={lensRadius}
          fit="viewport"
          drive="time"
          phase={phase}
          onDissolved={() => closeRef.current()}
        />
      </div>
    </div>,
    document.body,
  );
}
