import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

/**
 * Page data: the part of a page's own data that its browser code fetches after load instead of carrying it inline in
 * every prerendered HTML file. Written under `public/page-data/` by the prebuild step that owns the data and checked
 * after the build, like the publications under `public/downloads/data/` (scripts/prepare-fact-query-publications.ts).
 * It is not one of those publications: no manifest, llms.txt, sitemap or methodology link names it, and /mcp never
 * reads it. The name carries a hash of the content, so a file never changes once published and next.config.ts lets
 * browsers keep it for a year; Georgian and English pages share it.
 */
export type PageDataFile = { fileName: string; url: string; content: string };

export const PAGE_DATA_PATH = "/page-data";
const pageDataDir = () => path.join(/* turbopackIgnore: true */ process.cwd(), "public", PAGE_DATA_PATH.slice(1));

export function pageDataFile(name: string, data: unknown): PageDataFile {
  const content = JSON.stringify(data);
  const hash = createHash("sha256").update(content).digest("hex").slice(0, 16);
  const fileName = `${name}.${hash}.json`;
  return { fileName, url: `${PAGE_DATA_PATH}/${fileName}`, content };
}

/** The files under `prefix` on disk: removes earlier versions and writes `files`. */
export async function writePageDataFiles(prefix: string, files: readonly PageDataFile[]): Promise<void> {
  const dir = pageDataDir();
  await fs.mkdir(dir, { recursive: true });
  for (const entry of await fs.readdir(dir)) {
    if (entry.startsWith(prefix)) await fs.rm(path.join(dir, entry));
  }
  for (const file of files) await fs.writeFile(path.join(dir, file.fileName), file.content);
}

/** Fails unless the files under `prefix` on disk are exactly `files`, byte for byte. */
export async function checkPageDataFiles(prefix: string, files: readonly PageDataFile[]): Promise<void> {
  const dir = pageDataDir();
  const onDisk = (await fs.readdir(dir).catch(() => [] as string[])).filter((entry) => entry.startsWith(prefix)).sort();
  const expected = files.map((file) => file.fileName).sort();
  if (onDisk.join("\n") !== expected.join("\n")) {
    throw new Error(`Page data under ${PAGE_DATA_PATH}/${prefix}* is stale: found [${onDisk.join(", ")}], expected [${expected.join(", ")}]`);
  }
  for (const file of files) {
    if ((await fs.readFile(path.join(dir, file.fileName), "utf8")) !== file.content) {
      throw new Error(`Page data ${PAGE_DATA_PATH}/${file.fileName} does not match its content`);
    }
  }
}
