import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

/** Test-only HTTP boundary for real SDK clients, with finite bodies and teardown. */
export async function httpBridge(fetch: (request: Request) => Promise<Response>) {
  const server = createServer(async (incoming, outgoing) => {
    try {
      const chunks: Buffer[] = [];
      let bytes = 0;
      for await (const chunk of incoming) {
        bytes += chunk.length;
        if (bytes > 32 * 1024) { outgoing.writeHead(413).end(); return; }
        chunks.push(chunk);
      }
      const headers = new Headers();
      for (const [name, value] of Object.entries(incoming.headers)) {
        if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(", ") : value);
      }
      // Match the production host guard while the clients connect over localhost.
      headers.set("host", "fiscal.ge");
      const response = await fetch(new Request(`https://fiscal.ge${incoming.url}`, {
        method: incoming.method,
        headers,
        ...(incoming.method === "POST" ? { body: Buffer.concat(chunks) } : {}),
      }));
      const payload = new Uint8Array(await response.arrayBuffer());
      if (payload.byteLength > 1024 * 1024) throw new Error("Test bridge response exceeded its bound");
      outgoing.writeHead(response.status, Object.fromEntries(response.headers));
      outgoing.end(payload);
    } catch { outgoing.writeHead(500).end(); }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    url: new URL(`http://127.0.0.1:${(server.address() as AddressInfo).port}/mcp`),
    close: async () => {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    },
  };
}
