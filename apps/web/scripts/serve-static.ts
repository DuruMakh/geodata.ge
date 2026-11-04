import { createReadStream, readFileSync, statSync } from "node:fs";
import http from "node:http";
import path from "node:path";
// Next.js's own copy of path-to-regexp (v6), the dialect Next used for these rules before the static export and
// the one Vercel's route sources follow; the v8 copy in node_modules reads `:file*` and `(.*)` differently.
import { pathToRegexp } from "next/dist/compiled/path-to-regexp";
import { runAsCli } from "../lib/runAsCli";
import type { VercelConfig } from "./prepare-vercel-config";

// `npm run start`: serves the static export in out/ following the vercel.json rules (close to Vercel, not identical), for the browser tests
// (locally and in CI) and for looking at a build. In order: the trailing-slash redirect, the redirects, the /mcp
// rewrite to its function, the files (clean URLs), then 404.html with status 404. Every matching header rule is
// added to every response that is not a redirect. (`next start` cannot serve a static export.)

type McpHandler = (request: Request) => Promise<Response> | Response;
type Options = { root: string; config: VercelConfig; mcpHandler?: McpHandler };

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".pdf": "application/pdf",
  ".zip": "application/zip",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".xls": "application/vnd.ms-excel",
};

function isFile(candidate: string): boolean {
  try { return statSync(candidate).isFile(); } catch { return false; }
}

/** Query of `requested` appended to `destination`, keeping any query the destination already has. */
function withQuery(destination: string, requested: URLSearchParams): string {
  const target = new URL(destination, "http://local");
  for (const [key, value] of requested) if (!target.searchParams.has(key)) target.searchParams.append(key, value);
  return `${target.pathname}${target.search}`;
}

export function createStaticServer({ root, config, mcpHandler }: Options): http.Server {
  const headerRules = config.headers.map(rule => ({ pattern: pathToRegexp(rule.source), headers: rule.headers }));
  const redirects = new Map(config.redirects.map(rule => [rule.source, rule.destination]));
  const rewrites = new Set(config.rewrites.map(rule => rule.source));
  const rootDir = path.resolve(root);

  async function handleMcp(request: http.IncomingMessage, response: http.ServerResponse, url: URL) {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(chunk as Buffer);
    const headers = new Headers();
    for (const [key, value] of Object.entries(request.headers)) if (typeof value === "string") headers.set(key, value);
    const method = request.method ?? "GET";
    const handler = mcpHandler ?? (await loadMcpHandler(method));
    const answer = await handler(new Request(url, { method, headers, body: chunks.length > 0 && method !== "GET" && method !== "HEAD" ? Buffer.concat(chunks) : undefined }));
    answer.headers.forEach((value, key) => response.setHeader(key, value));
    response.writeHead(answer.status);
    response.end(Buffer.from(await answer.arrayBuffer()));
  }

  return http.createServer((request, response) => {
    let url: URL;
    try {
      url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
    } catch {
      response.writeHead(400);
      return response.end();
    }
    const pathname = url.pathname;

    // One leading slash only: `//host` in a Location header would send the browser to another site.
    const redirect = (location: string) => { response.writeHead(308, { location: location.replace(/^\/{2,}/, "/") }); response.end(); };
    if (pathname.length > 1 && pathname.endsWith("/")) return redirect(`${pathname.replace(/\/+$/, "")}${url.search}`);
    const destination = redirects.get(pathname);
    if (destination !== undefined) return redirect(withQuery(destination, url.searchParams));
    // Vercel applies header rules after its redirects, so a 308 carries none of them.
    for (const rule of headerRules) if (rule.pattern.test(pathname)) for (const { key, value } of rule.headers) response.setHeader(key, value);
    if (rewrites.has(pathname)) {
      handleMcp(request, response, url).catch(() => { if (!response.headersSent) response.writeHead(500); response.end(); });
      return;
    }

    let decoded: string;
    try { decoded = decodeURIComponent(pathname); } catch { decoded = ""; }
    const base = path.resolve(rootDir, `.${decoded}`);
    const inside = decoded !== "" && (base === rootDir || base.startsWith(`${rootDir}${path.sep}`));
    if (inside && decoded.endsWith(".html") && isFile(base)) return redirect(`${pathname.slice(0, -".html".length)}${url.search}`);
    const found = inside ? [base, `${base}.html`, path.join(base, "index.html")].find(isFile) : undefined;
    const file = found ?? path.join(rootDir, "404.html");
    const status = found ? 200 : 404;
    if (status === 200 && request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405, { allow: "GET, HEAD" });
      return response.end();
    }
    if (!response.hasHeader("content-type")) response.setHeader("content-type", CONTENT_TYPES[path.extname(file)] ?? "application/octet-stream");
    response.writeHead(status);
    if (request.method === "HEAD") return response.end();
    createReadStream(file).on("error", () => response.destroy()).pipe(response);
  });
}

/** The real /mcp handlers, loaded on first use so serving pages never pays for the MCP SDK. */
async function loadMcpHandler(method: string): Promise<McpHandler> {
  const handlers: Record<string, McpHandler> = await import("../lib/mcp/handler");
  return handlers[method] ?? (() => new Response(null, { status: 405 }));
}

export async function main(args: readonly string[]) {
  const portFlag = args.indexOf("--port");
  const port = portFlag >= 0 ? Number(args[portFlag + 1]) : 3000;
  const config = JSON.parse(readFileSync(path.join(process.cwd(), "vercel.json"), "utf8")) as VercelConfig;
  const server = createStaticServer({ root: path.join(process.cwd(), config.outputDirectory), config });
  await new Promise<void>(resolve => server.listen(port, resolve));
  process.stdout.write(`serving ${config.outputDirectory}/ on http://localhost:${port}\n`);
}

runAsCli(import.meta.url, main);
