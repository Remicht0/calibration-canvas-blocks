import { createFileRoute } from "@tanstack/react-router";
import { imagesOf, projects } from "@/lib/projects";
import { originOf } from "@/lib/site";

/* Plan du site : les pages fixes et une entree par projet, avec ses images
   (sitemap d'images : Google Images ne voit pas ce qui est dessine en canvas). */
export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: ({ request }) => {
        const o = originOf(request);
        const xml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
        const abs = (s: string) => (/^https?:\/\//.test(s) ? s : `${o}${s}`);
        const urls: { u: string; imgs: string[] }[] = [
          ...["/", "/atelier", "/a-propos", "/contact"].map((u) => ({ u, imgs: [] })),
          ...projects.map((p) => ({ u: `/projet/${p.slug}`, imgs: imagesOf(p) })),
        ];
        const body = [
          '<?xml version="1.0" encoding="UTF-8"?>',
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
          ...urls.map(
            ({ u, imgs }) =>
              `  <url><loc>${xml(o + u)}</loc>${imgs.map((s) => `<image:image><image:loc>${xml(abs(s))}</image:loc></image:image>`).join("")}</url>`,
          ),
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
