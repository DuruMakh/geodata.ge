import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createStaticServer } from "../../scripts/serve-static";
import { buildVercelConfig } from "../../scripts/prepare-vercel-config";

// scripts/serve-static.ts stands in for Vercel locally and in CI: it must apply vercel.json the way Vercel does,
// or the browser suite would pass against behaviour production does not have.
const root = mkdtempSync(path.join(tmpdir(), "serve-static-"));
function file(relative: string, body: string) {
  mkdirSync(path.dirname(path.join(root, relative)), { recursive: true });
  writeFileSync(path.join(root, relative), body);
}
file("index.html", "home");
file("en.html", "english home");
file("404.html", "not found page");
file("explorer/trade.html", "trade page");
file("explorer/trade.txt", "trade rsc");
file("explorer/__next._tree.txt", "tree rsc");
file("explorer/labour.html", "labour page");
file("page-data/x.json", "{}");
file("opengraph-image", "png bytes");

const mcpCalls: Request[] = [];
const server = createStaticServer({
  root,
  config: buildVercelConfig(),
  mcpHandler: async (request) => { mcpCalls.push(request); return new Response("mcp answer", { status: 200 }); },
});
let base = "";

beforeAll(async () => {
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>(resolve => server.close(() => resolve())));

const get = (pathAndQuery: string, init: RequestInit = {}) => fetch(`${base}${pathAndQuery}`, { redirect: "manual", ...init });

describe("serve-static", () => {
  it("drops a trailing slash with a 308 and keeps the query", async () => {
    const response = await get("/explorer/trade/?x=1");
    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe("/explorer/trade?x=1");
  });

  it("forwards an old hub to its group page, merging the old link's query into the destination's", async () => {
    const plain = await get("/explorer/wages");
    expect(plain.status).toBe(308);
    expect(plain.headers.get("location")).toBe("/explorer/labour?topic=wages");

    const withQuery = await get("/en/explorer/wages?utm_source=x");
    expect(withQuery.status).toBe(308);
    expect(withQuery.headers.get("location")).toBe("/en/explorer/labour?topic=wages&utm_source=x");
  });

  it("keeps the query on a plain redirect", async () => {
    const response = await get("/explorer/municipalities/06?year=2020");
    expect(response.headers.get("location")).toBe("/explorer/municipalities/batumi?year=2020");
  });

  it("answers an unknown address with the not-found page and status 404", async () => {
    for (const address of ["/en/nope", "/explorer/municipalities/05"]) {
      const response = await get(address);
      expect(response.status).toBe(404);
      expect(await response.text()).toBe("not found page");
    }
  });

  it("serves RSC prefetch files whatever their query", async () => {
    expect(await (await get("/explorer/trade.txt?_rsc=abc")).text()).toBe("trade rsc");
    expect((await get("/explorer/__next._tree.txt?_rsc=abc")).status).toBe(200);
  });

  it("serves clean URLs: /, /en and a page without .html", async () => {
    expect(await (await get("/")).text()).toBe("home");
    expect(await (await get("/en")).text()).toBe("english home");
    const page = await get("/explorer/labour");
    expect(page.status).toBe(200);
    expect(page.headers.get("content-type")).toContain("text/html");
  });

  it("redirects a .html address to its clean URL", async () => {
    const response = await get("/explorer/trade.html");
    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe("/explorer/trade");
  });

  it("leaves the header rules off redirects, as Vercel's route order does", async () => {
    const response = await get("/explorer/wages");

    expect(response.status).toBe(308);
    expect(response.headers.get("x-frame-options")).toBeNull();
  });

  it("adds the site-wide security headers to a page and to a 404", async () => {
    for (const address of ["/explorer/labour", "/nope"]) {
      const response = await get(address);
      expect(response.headers.get("x-frame-options")).toBe("DENY");
      expect(response.headers.get("content-security-policy-report-only")).toContain("default-src 'self'");
    }
  });

  it("marks page data as immutable and noindex, and the og-image as a PNG", async () => {
    const data = await get("/page-data/x.json");
    expect(data.headers.get("x-robots-tag")).toBe("noindex");
    expect(data.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
    expect((await get("/opengraph-image")).headers.get("content-type")).toBe("image/png");
  });

  // A raw request, because fetch would normalise these targets before sending them.
  async function raw(target: string, host = "localhost"): Promise<{ status: number; location?: string }> {
    const http = await import("node:http");
    return new Promise((resolve, reject) => {
      const request = http.request({ host: "127.0.0.1", port: new URL(base).port, path: target, headers: { host } }, (response) => {
        response.resume();
        resolve({ status: response.statusCode ?? 0, location: response.headers.location });
      });
      request.on("error", reject);
      request.end();
    });
  }

  it("never redirects to another site", async () => {
    const response = await raw("/.//evil.com/");
    expect(response.status).toBe(308);
    expect(response.location).toBe("/evil.com");
  });

  it("answers a request target it cannot parse with 400 and keeps serving", async () => {
    expect((await raw("//", "bad host")).status).toBe(400);
    expect((await get("/")).status).toBe(200);
  });

  it("never serves a file outside its folder", async () => {
    expect((await get("/..%2f..%2fetc%2fpasswd")).status).toBe(404);
  });

  it("hands POST /mcp to the MCP handler with the method, headers and body", async () => {
    const response = await get("/mcp", { method: "POST", headers: { "content-type": "application/json" }, body: "{\"a\":1}" });
    expect(await response.text()).toBe("mcp answer");
    expect(mcpCalls.at(-1)!.method).toBe("POST");
    expect(new URL(mcpCalls.at(-1)!.url).pathname).toBe("/mcp");
    expect(await mcpCalls.at(-1)!.text()).toBe("{\"a\":1}");
  });
});
