import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const assets = [
  ["public/brand/fiscal-logo-horizontal.svg", "219236e7dc8f2c6f3c1fdbdda0ba53aba97305987ace07f2c1573f4c9697a3e5"],
  ["public/brand/fiscal-logo-compact.svg", "a2bda77adb7339299908a5340b5dbd7cbe265520e23d0ffe165b78a3a63086e1"],
  ["public/brand/fiscal-logo-mark-reversed.svg", "14556ca9f06ddd62f9c217d2b9287458eedc8fae2f20278e460aefc82a0968d7"],
  ["public/fiscal-ge-logo.svg", "f1456b9be13675cfb0d101c741d73d06fd1cec10c579a05afbe3a5fd0c67d587"],
  ["app/favicon.ico", "c460ed1578aba6e7c518f9936ee00c29460ad45c0a3d9900a0fbf373143dad0f"],
  ["app/icon.svg", "f1456b9be13675cfb0d101c741d73d06fd1cec10c579a05afbe3a5fd0c67d587"],
  ["app/apple-icon.png", "6e7a0d8f37ee0d23721b72fb52f49b6f49ce01a4dd660c3209ab01b05ac84096"],
] as const;

describe("Fiscal.ge Brand Kit v2.0 runtime assets", () => {
  it.each(assets)("keeps the reviewed bytes for %s", async (relativePath, expectedHash) => {
    const bytes = await readFile(join(process.cwd(), relativePath));
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(expectedHash);
  });
});
