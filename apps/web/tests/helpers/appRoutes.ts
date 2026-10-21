import { readdirSync } from "node:fs";
import path from "node:path";

/** Every app route file, as the URL pattern it serves: `app/(en)/en/explorer/wages/regions/[id]/page.tsx` → `/en/explorer/wages/regions/[id]`. */
export function appRoutes() {
  const app = path.resolve(__dirname, "../../app");
  return readdirSync(app, { recursive: true, encoding: "utf8" })
    .filter((file) => path.basename(file) === "page.tsx")
    .map((file) => ({
      file: path.join(app, file),
      segments: path.dirname(file).split(path.sep).filter((segment) => segment !== "." && !/^\(.+\)$/.test(segment)),
    }));
}

/** The route file serving a pathname and its dynamic params; a static segment beats a dynamic one (`georgia` over `[slug]`). */
export function routeFor(routes: ReturnType<typeof appRoutes>, pathname: string) {
  const parts = pathname.split("/").filter(Boolean);
  const matches = routes.flatMap((route) => {
    if (route.segments.length !== parts.length) return [];
    const params: Record<string, string> = {};
    for (const [index, segment] of route.segments.entries()) {
      const dynamic = /^\[(.+)\]$/.exec(segment);
      if (dynamic) params[dynamic[1]] = parts[index];
      else if (segment !== parts[index]) return [];
    }
    return [{ file: route.file, params, staticSegments: route.segments.length - Object.keys(params).length }];
  });
  const route = matches.sort((a, b) => b.staticSegments - a.staticSegments)[0];
  if (!route) throw new Error(`No app route serves ${pathname}`);
  return route;
}
