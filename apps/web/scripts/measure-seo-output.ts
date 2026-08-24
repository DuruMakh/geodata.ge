import { readFileSync, statSync } from "node:fs";
import path from "node:path";

export const AUDITED_ROUTES = [
  "/explorer/expenditure",
  "/explorer/municipalities",
  "/explorer/analysis",
] as const;

export type SeoOutputMeasurement = {
  route: string;
  htmlBytes: number;
  rscBytes: number;
  fontPreloadCount: number;
  fontPreloadBytes: number;
};

function routeFile(root: string, route: string, extension: string) {
  const routePath = route.replace(/^\/+/, "");
  return path.join(root, ".next", "server", "app", `${routePath}.${extension}`);
}

function fontPreloadHrefs(html: string) {
  const hrefs = new Set<string>();

  for (const tag of html.matchAll(/<link\b[^>]*>/gi)) {
    const element = tag[0];
    const rel = element.match(/\brel=["']?([^\s"'>]+)/i)?.[1];
    const as = element.match(/\bas=["']?([^\s"'>]+)/i)?.[1];
    const href = element.match(/\bhref=["']?([^\s"'>]+\.woff2(?:[?#][^\s"'>]*)?)["']?/i)?.[1];

    if (rel?.toLowerCase() === "preload" && as?.toLowerCase() === "font" && href) {
      hrefs.add(href);
    }
  }

  return hrefs;
}

export function measureSeoOutput(
  root: string,
  routes: readonly string[] = AUDITED_ROUTES,
): SeoOutputMeasurement[] {
  return routes.map((route) => {
    const htmlPath = routeFile(root, route, "html");
    const rscPath = routeFile(root, route, "rsc");
    const html = readFileSync(htmlPath, "utf8");
    const hrefs = fontPreloadHrefs(html);
    const fontPreloadBytes = [...hrefs].reduce((total, href) => {
      const filename = path.basename(new URL(href, "https://fiscal.ge").pathname);
      return total + statSync(path.join(root, ".next", "static", "media", filename)).size;
    }, 0);

    return {
      route,
      htmlBytes: Buffer.byteLength(html),
      rscBytes: statSync(rscPath).size,
      fontPreloadCount: hrefs.size,
      fontPreloadBytes,
    };
  });
}

if (process.argv[1]?.endsWith("measure-seo-output.ts")) {
  console.log(JSON.stringify(measureSeoOutput(process.cwd()), null, 2));
}
