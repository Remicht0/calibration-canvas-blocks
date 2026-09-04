import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import { BootSequence, GridCursor, NegativeSwitch, RouteWipe } from "@/components/boot";
import { MireConsole, ScrollRail } from "@/components/console";
import { ScanLine } from "@/components/mire";
import { ogPath, siteOrigin, STUDIO } from "@/lib/site";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <main
      id="contenu"
      tabIndex={-1}
      className="flex min-h-screen flex-col justify-between bg-white px-cell py-cell2 text-black"
    >
      <div className="u-mono flex justify-between">
        <span>MIRE / SIGNAL ABSENT</span>
        <span>404</span>
      </div>
      <div>
        <h1 className="u-display text-[26vw] leading-[0.82] md:text-[16vw]">
          PAS DE
          <br />
          SIGNAL
        </h1>
        <p className="u-copy mt-cell2 max-w-[48ch]">
          CETTE ADRESSE NE RENVOIE AUCUNE MIRE. LA PAGE A ETE DEPLACEE OU N&apos;A JAMAIS ETE
          CALIBREE.
        </p>
      </div>
      <div className="u-mono flex flex-wrap gap-cell2">
        <Link to="/" className="border-[3px] border-black px-cell py-[3px]">
          INDEX
        </Link>
        <Link to="/atelier" className="border-[3px] border-black px-cell py-[3px]">
          ATELIER
        </Link>
      </div>
    </main>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <main
      id="contenu"
      tabIndex={-1}
      className="flex min-h-screen flex-col justify-between bg-black px-cell py-cell2 text-white"
    >
      <div className="u-mono flex justify-between">
        <span>MIRE / DEFAUT DE LECTURE</span>
        <span>ERR</span>
      </div>
      <div>
        <h1 className="u-display text-[22vw] leading-[0.82] md:text-[13vw]">
          SIGNAL
          <br />
          CORROMPU
        </h1>
        <p className="u-copy mt-cell2 max-w-[48ch]">
          LA PAGE N&apos;A PAS PU ETRE COMPOSEE. RELANCER LA CALIBRATION OU REVENIR A L&apos;INDEX.
        </p>
      </div>
      <div className="u-mono flex flex-wrap gap-cell2">
        <button
          type="button"
          onClick={() => {
            router.invalidate();
            reset();
          }}
          className="border-[3px] border-white px-cell py-[3px]"
        >
          RELANCER
        </button>
        <a href="/" className="border-[3px] border-white px-cell py-[3px]">
          INDEX
        </a>
      </div>
    </main>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  // origine absolue du site : les cartes de partage et le canonical l'exigent
  loader: () => ({ origin: siteOrigin() }),
  head: ({ loaderData, matches }) => {
    const origin = loaderData?.origin ?? "";
    const path = matches[matches.length - 1]?.pathname ?? "/";
    return {
      meta: [
        { charSet: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        { title: "MIRE — Studio de design graphique" },
        {
          name: "description",
          content:
            "MIRE, studio de design graphique. Un site construit comme une image de calibration.",
        },
        { name: "author", content: "MIRE" },
        { name: "theme-color", content: "#000000" },
        { property: "og:site_name", content: "MIRE" },
        { property: "og:locale", content: "fr_FR" },
        { property: "og:title", content: "MIRE — Studio de design graphique" },
        {
          property: "og:description",
          content: "Identité, édition, signalétique. Rendu 1-bit par blocs.",
        },
        { property: "og:type", content: "website" },
        { property: "og:url", content: `${origin}${path}` },
        { property: "og:image", content: `${origin}${ogPath()}` },
        { property: "og:image:width", content: "1200" },
        { property: "og:image:height", content: "630" },
        { property: "og:image:type", content: "image/png" },
        {
          property: "og:image:alt",
          content: "MIRE en lettres de blocs sous une bande de calibration, noir sur blanc.",
        },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:image", content: `${origin}${ogPath()}` },
        {
          "script:ld+json": {
            "@context": "https://schema.org",
            "@type": "Organization",
            name: STUDIO.name,
            legalName: STUDIO.legalName,
            url: origin || undefined,
            logo: origin ? `${origin}/icons/icon-512.png` : undefined,
            email: STUDIO.email,
            telephone: STUDIO.phone,
            foundingDate: STUDIO.founded,
            address: {
              "@type": "PostalAddress",
              streetAddress: STUDIO.street,
              postalCode: STUDIO.postalCode,
              addressLocality: STUDIO.city,
              addressCountry: STUDIO.country,
            },
          },
        },
      ],
      links: [
        { rel: "stylesheet", href: appCss },
        {
          rel: "preload",
          href: "/fonts/anton-latin.woff2",
          as: "font",
          type: "font/woff2",
          crossOrigin: "anonymous",
        },
        {
          rel: "preload",
          href: "/fonts/jetbrains-mono-latin.woff2",
          as: "font",
          type: "font/woff2",
          crossOrigin: "anonymous",
        },
        { rel: "canonical", href: `${origin}${path}` },
        { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
        { rel: "icon", href: "/favicon.ico", sizes: "32x32" },
        { rel: "apple-touch-icon", href: "/icons/apple-touch-icon.png" },
        { rel: "manifest", href: "/manifest.webmanifest" },
      ],
    };
  },
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      {/* lien d'evitement : invisible jusqu'au focus clavier, puis un bloc noir */}
      <a
        href="#contenu"
        className="u-mono sr-only focus:not-sr-only focus:fixed focus:left-0 focus:top-0 focus:z-[300] focus:bg-black focus:px-cell focus:py-cell focus:text-white"
      >
        ALLER AU CONTENU
      </a>
      <ScanLine />
      <GridCursor />
      <NegativeSwitch />
      <BootSequence />
      <RouteWipe />
      <ScrollRail />
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      <MireConsole />
    </QueryClientProvider>
  );
}
