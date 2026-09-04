import { createFileRoute } from "@tanstack/react-router";
import { originOf } from "@/lib/site";

/* robots.txt : tout est indexable, le plan du site est declare en URL absolue. */
export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: ({ request }) =>
        new Response(`User-agent: *\nAllow: /\n\nSitemap: ${originOf(request)}/sitemap.xml\n`, {
          headers: {
            "content-type": "text/plain; charset=utf-8",
            "cache-control": "public, max-age=3600",
          },
        }),
    },
  },
});
