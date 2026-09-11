import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { Component, useEffect, type ReactNode } from "react";

import { CalibrationBand } from "@/components/bars";
import { Bloc } from "@/components/bloc";
import { BootSequence, GridCursor, NegativeSwitch, RouteWipe } from "@/components/boot";
import { TopBar } from "@/components/chrome";
import { MireConsole, ScrollRail } from "@/components/console";
import { KeyHelp } from "@/components/help";
import { BlockType, ScanLine } from "@/components/mire";
import { ogPath, siteOrigin, STUDIO } from "@/lib/site";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <main id="contenu" tabIndex={-1} className="min-h-screen bg-white text-black">
      <TopBar className="px-cell py-cell2" right="404" />

      <section data-mire="SIGNAL ABSENT" className="px-cell pb-cell4">
        <BlockType text="PAS DE SIGNAL" loop />
      </section>

      <CalibrationBand height={5} still className="border-y-[10px] border-black" />

      <section className="px-cell py-cell4">
        <p className="u-copy max-w-[48ch]">
          CETTE ADRESSE NE RENVOIE AUCUNE MIRE. LA PAGE A ETE DEPLACEE OU N&apos;A JAMAIS ETE
          CALIBREE.
        </p>
        <div className="mt-cell2 flex flex-wrap gap-cell2">
          <Bloc as={Link} to="/">
            INDEX
          </Bloc>
          <Bloc as={Link} to="/atelier">
            ATELIER
          </Bloc>
          <Bloc as={Link} to="/contact">
            CONTACT
          </Bloc>
        </div>
      </section>
    </main>
  );
}

/** Si le canvas du titre leve a son tour, un h1 HTML en display prend sa place. */
class TitleFallback extends Component<{ text: string; children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override render() {
    if (this.state.failed)
      return (
        <h1 className="u-display text-[22vw] leading-[0.82] md:text-[13vw]">{this.props.text}</h1>
      );
    return this.props.children;
  }
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <main id="contenu" tabIndex={-1} className="on-black min-h-screen bg-black text-white">
      <TopBar className="px-cell py-cell2" right="ERR" />

      <section data-mire="DEFAUT DE LECTURE" className="px-cell pb-cell4">
        <TitleFallback text="SIGNAL CORROMPU">
          <BlockType text="SIGNAL CORROMPU" loop={false} negative />
        </TitleFallback>
      </section>

      <CalibrationBand height={5} still negative className="border-y-[10px] border-white" />

      <section className="px-cell py-cell4">
        <p className="u-copy max-w-[48ch]">
          LA PAGE N&apos;A PAS PU ETRE COMPOSEE. RELANCER LA CALIBRATION OU REVENIR A L&apos;INDEX.
        </p>
        <div className="mt-cell2 flex flex-wrap gap-cell2">
          <Bloc
            onClick={() => {
              router.invalidate();
              reset();
            }}
          >
            RELANCER
          </Bloc>
          {/* ancre brute : le rechargement complet est voulu apres une erreur */}
          <Bloc as="a" href="/">
            INDEX
          </Bloc>
        </div>
      </section>
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
        className="u-mono mire-chrome sr-only focus:not-sr-only focus:fixed focus:left-0 focus:top-0 focus:z-[300] focus:bg-black focus:px-cell focus:py-cell focus:text-white"
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
      <KeyHelp />
    </QueryClientProvider>
  );
}
