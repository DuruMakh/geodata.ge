import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { copyFile, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

const assets = [
  ["public/brand/fiscal-logo-horizontal.svg", "219236e7dc8f2c6f3c1fdbdda0ba53aba97305987ace07f2c1573f4c9697a3e5"],
  ["public/brand/fiscal-logo-compact.svg", "a2bda77adb7339299908a5340b5dbd7cbe265520e23d0ffe165b78a3a63086e1"],
  ["public/brand/fiscal-logo-mark-reversed.svg", "14556ca9f06ddd62f9c217d2b9287458eedc8fae2f20278e460aefc82a0968d7"],
  ["public/fiscal-ge-logo.svg", "f1456b9be13675cfb0d101c741d73d06fd1cec10c579a05afbe3a5fd0c67d587"],
  ["app/favicon.ico", "c460ed1578aba6e7c518f9936ee00c29460ad45c0a3d9900a0fbf373143dad0f"],
  ["app/icon.svg", "f1456b9be13675cfb0d101c741d73d06fd1cec10c579a05afbe3a5fd0c67d587"],
  ["app/apple-icon.png", "6e7a0d8f37ee0d23721b72fb52f49b6f49ce01a4dd660c3209ab01b05ac84096"],
] as const;

const exactHashedSvgAssets = assets
  .filter(([relativePath]) => relativePath.endsWith(".svg"))
  .map(([relativePath, expectedHash]) => [`apps/web/${relativePath}`, expectedHash] as const);

async function runGit(cwd: string, ...args: string[]) {
  return execFileAsync("git", args, { cwd });
}

describe("Fiscal.ge Brand Kit v2.0 runtime assets", () => {
  it.each(assets)("keeps the reviewed bytes for %s", async (relativePath, expectedHash) => {
    const bytes = await readFile(join(process.cwd(), relativePath));
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(expectedHash);
  });

  it("preserves every exact-hashed SVG in a core.autocrlf=true checkout", async () => {
    const repositoryRoot = join(process.cwd(), "../..");
    const evidenceRoot = await mkdtemp(join(tmpdir(), "fiscal-brand-assets-"));
    const sourcePath = join(evidenceRoot, "source");
    const checkoutPath = join(evidenceRoot, "checkout");

    try {
      await mkdir(sourcePath);
      for (const [relativePath] of exactHashedSvgAssets) {
        const fixturePath = join(sourcePath, relativePath);
        await mkdir(dirname(fixturePath), { recursive: true });
        await copyFile(join(repositoryRoot, relativePath), fixturePath);
      }
      const attributesPath = join(repositoryRoot, ".gitattributes");
      if (existsSync(attributesPath)) await copyFile(attributesPath, join(sourcePath, ".gitattributes"));

      await runGit(sourcePath, "init", "--quiet");
      await runGit(sourcePath, "config", "core.autocrlf", "false");
      await runGit(sourcePath, "config", "commit.gpgsign", "false");
      await runGit(sourcePath, "config", "user.name", "Fiscal.ge tests");
      await runGit(sourcePath, "config", "user.email", "tests@fiscal.ge");
      await runGit(sourcePath, "add", ".");
      await runGit(sourcePath, "commit", "--quiet", "-m", "brand asset fixture");

      await runGit(evidenceRoot, "clone", "--no-checkout", "--quiet", sourcePath, checkoutPath);
      await runGit(checkoutPath, "config", "core.autocrlf", "true");
      await runGit(checkoutPath, "checkout", "--force", "--quiet", "HEAD");

      for (const [relativePath, expectedHash] of exactHashedSvgAssets) {
        const bytes = await readFile(join(checkoutPath, relativePath));
        expect(
          createHash("sha256").update(bytes).digest("hex"),
          `${relativePath} changed bytes after checkout`,
        ).toBe(expectedHash);
        const { stdout } = await runGit(checkoutPath, "check-attr", "text", "eol", "--", relativePath);
        expect(stdout).toContain(`${relativePath}: text: set`);
        expect(stdout).toContain(`${relativePath}: eol: lf`);
      }
    } finally {
      await rm(evidenceRoot, { recursive: true, force: true });
    }
  });
});
