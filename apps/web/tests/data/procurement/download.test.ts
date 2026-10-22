import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { expect, test } from "vitest";
import { downloadSources } from "../../../lib/data/procurement/download";
import { sourceFiles } from "../../../lib/data/procurement/paths";

const tempDir = () => fs.mkdtempSync(path.join(os.tmpdir(), "procurement-download-"));
const zipBytes = (url: string) => Buffer.from(`zip of ${url}`);
const okFetch = (calls: string[]) =>
  (async (input: string | URL | Request) => {
    const url = String(input);
    calls.push(url);
    return new Response(zipBytes(url), { status: 200 });
  }) as typeof fetch;
const fakeUnzip = async (zip: string, outDir: string) => {
  fs.writeFileSync(path.join(outDir, "inside.xlsx"), `xlsx of ${path.basename(zip)}`);
};

test("the sources are tenders 2016-2026 and direct purchases 2016-2025", () => {
  const files = sourceFiles();
  expect(files).toHaveLength(21);
  expect(files[0]).toMatchObject({ kind: "tenders", year: 2016, url: "https://tendermonitor.ge/uploads/archives/main_2016.zip", zipPath: "originals/main_2016.zip", xlsxPath: "originals/main_2016.xlsx" });
  expect(files.at(-1)).toMatchObject({ kind: "purchases", year: 2025, url: "https://tendermonitor.ge/uploads/archives/simpified_2025.zip" });
  expect(files.some(f => f.url.endsWith("simpified_2026.zip"))).toBe(false);
});

test("download saves each zip and its workbook and records their SHA-256 in the manifest", async () => {
  const dir = tempDir();
  const calls: string[] = [];
  const rows = await downloadSources(dir, okFetch(calls), fakeUnzip);
  expect(calls).toHaveLength(21);
  expect(fs.readFileSync(path.join(dir, "originals/main_2016.xlsx"), "utf8")).toBe("xlsx of main_2016.zip");
  const manifest = parse(fs.readFileSync(path.join(dir, "MANIFEST.csv")), { columns: true, bom: true }) as Record<string, string>[];
  expect(manifest).toHaveLength(42);
  const zipRow = manifest.find(r => r.path === "originals/main_2016.zip")!;
  const bytes = zipBytes("https://tendermonitor.ge/uploads/archives/main_2016.zip");
  expect(zipRow).toMatchObject({ bytes: String(bytes.length), sha256: createHash("sha256").update(bytes).digest("hex"), source_url: "https://tendermonitor.ge/uploads/archives/main_2016.zip" });
  expect(rows).toHaveLength(42);
});

test("a second download does not fetch files it already has", async () => {
  const dir = tempDir();
  await downloadSources(dir, okFetch([]), fakeUnzip);
  const calls: string[] = [];
  await downloadSources(dir, okFetch(calls), fakeUnzip);
  expect(calls).toEqual([]);
});

test("a missing file stops the download with its address", async () => {
  const notFound = (async () => new Response("", { status: 404 })) as typeof fetch;
  await expect(downloadSources(tempDir(), notFound, fakeUnzip)).rejects.toThrow("main_2016.zip");
});
