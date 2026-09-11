import { Link } from "@tanstack/react-router";
import type { ComponentProps, ComponentPropsWithoutRef, ElementType, ReactNode } from "react";

/* ------------------------------------------------------------------ */
/* Bloc : tout bouton ou lien cadre de la mire (classe .u-bloc).       */
/* Etats par inversion seche : survol, aria-pressed, aria-current,     */
/* focus. Polymorphe : bouton (defaut), ancre ou Link du routeur.      */
/* ------------------------------------------------------------------ */

type Base = {
  pressed?: boolean;
  current?: boolean;
  className?: string;
  children?: ReactNode;
};

type ButtonBloc = Base & { as?: "button" } & ComponentPropsWithoutRef<"button">;
type AnchorBloc = Base & { as: "a" } & ComponentPropsWithoutRef<"a">;
type LinkBloc = Base & { as: typeof Link } & ComponentProps<typeof Link>;

export type BlocProps = ButtonBloc | AnchorBloc | LinkBloc;

export function Bloc({ as, pressed, current, className = "", ...rest }: BlocProps) {
  const Tag: ElementType = as ?? "button";
  return (
    <Tag
      {...(Tag === "button" ? { type: "button" } : {})}
      {...rest}
      aria-pressed={pressed}
      aria-current={current ? "page" : undefined}
      className={`u-mono u-bloc ${className}`}
    />
  );
}
