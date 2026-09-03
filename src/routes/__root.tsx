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

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <main className="flex min-h-screen flex-col justify-between bg-white px-cell py-cell2 text-black">
      <div className="u-mono flex justify-between">
        <span>MIRE / SIGNAL ABSENT</span>
        <span>404</span>
      </div>
      <div>
        <div className="u-display text-[26vw] leading-[0.82] md:text-[16vw]">
          PAS DE
          <br />
          SIGNAL
        </div>
        <p className="u-mono mt-cell2 max-w-[48ch]">
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
    <main className="flex min-h-screen flex-col justify-between bg-black px-cell py-cell2 text-white">
      <div className="u-mono flex justify-between">
        <span>MIRE / DEFAUT DE LECTURE</span>
        <span>ERR</span>
      </div>
      <div>
        <div className="u-display text-[22vw] leading-[0.82] md:text-[13vw]">
          SIGNAL
          <br />
          CORROMPU
        </div>
        <p className="u-mono mt-cell2 max-w-[48ch]">
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
  head: () => ({
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
      { property: "og:title", content: "MIRE — Studio de design graphique" },
      {
        property: "og:description",
        content: "Identite, edition, signaletique. Rendu 1-bit par blocs.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Anton&family=JetBrains+Mono:wght@400&display=swap",
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
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
