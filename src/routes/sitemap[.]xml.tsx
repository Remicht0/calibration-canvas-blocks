import { createFileRoute } from "@tanstack/react-router";
import { projects } from "@/lib/projects";
import { originOf } from "@/lib/site";

/* Plan du site : les quatre pages fixes et une entree par projet. */
export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: ({ request }) => {
        const o = originOf(request);
        const urls = ["/", "/atelier", "/contact", ...projects.map((p) => `/projet/${p.slug}`)];
        const body = [
          '<?xml version="1.0" encoding="UTF-8"?>',
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
          ...urls.map((u) => `  <url><loc>${o}${u}</loc></url>`),
          "</urlset>",
          "",
        ].join("\n");
        return new Response(body, {
          headers: {
            "content-type": "application/xml; charset=utf-8",
            "cache-control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
