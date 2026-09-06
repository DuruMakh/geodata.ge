import sitemap, { serializeSitemapXml } from "../../lib/seo/sitemap";

export const dynamic = "force-static";

export async function GET(): Promise<Response> {
  const xml = serializeSitemapXml(await sitemap());

  return new Response(xml, {
    headers: {
      "Cache-Control": "public, max-age=0, must-revalidate",
      "Content-Type": "application/xml; charset=utf-8",
    },
  });
}
