import { createHash } from "node:crypto";
import path from "node:path";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import {
  loadReviewedSourceManifest,
  type ReviewedSourceManifestRow,
  validateSourceManifest,
} from "../../lib/methodology/sourceManifest";

const tempDirectories: string[] = [];
const manifestColumns = [
  "source_id",
  "dataset_id",
  "year",
  "source_organization",
  "display_title_ka",
  "official_filename",
  "official_url_or_archive_url",
  "repository_source_path",
  "public_download_path",
  "media_type",
  "byte_size",
  "sha256",
  "retrieved_at",
  "retrieved_at_basis",
  "license_id",
  "attribution_text",
  "redistribution_status",
  "notes",
] as const;

function sha256(bytes: string | Buffer) {
  return createHash("sha256").update(bytes).digest("hex");
}

function csvCell(value: unknown) {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function serializeRows(rows: readonly ReviewedSourceManifestRow[]) {
  return [
    manifestColumns.join(","),
    ...rows.map((row) => manifestColumns.map((column) => csvCell(row[column])).join(",")),
  ].join("\n");
}

function validRow(overrides: Partial<ReviewedSourceManifestRow> = {}): ReviewedSourceManifestRow {
  const bytes = "source-a";
  return {
    source_id: "source.expenditure.2005.a",
    dataset_id: "expenditure",
    year: "2005",
    source_organization: "Official source",
    display_title_ka: "Source A",
    official_filename: "source-a.pdf",
    official_url_or_archive_url: "https://example.gov/source-a.pdf",
    repository_source_path: "docs/Raw Data/Expenditure/2005/source-a.pdf",
    public_download_path: "downloads/methodology/expenditure/files/2005/source-a.pdf",
    media_type: "application/pdf",
    byte_size: Buffer.byteLength(bytes),
    sha256: sha256(bytes),
    retrieved_at: "2026-08-11",
    retrieved_at_basis: "exact",
    license_id: "official-public-document-no-explicit-license",
    attribution_text: "Official source",
    redistribution_status: "repository_owner_approved",
    notes: "",
    ...overrides,
  };
}

async function createRepository() {
  const repositoryRoot = await mkdtemp(path.join(tmpdir(), "methodology-manifest-"));
  tempDirectories.push(repositoryRoot);
  const sourcePath = path.join(repositoryRoot, "docs/Raw Data/Expenditure/2005/source-a.pdf");
  await mkdir(path.dirname(sourcePath), { recursive: true });
  await writeFile(sourcePath, "source-a");
  return repositoryRoot;
}

afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("reviewed source manifest", () => {
  it("loads the two reviewed Regional GDP originals from their existing repository locations", async () => {
    const repositoryRoot = path.resolve(process.cwd(), "../..");
    const rows = await loadReviewedSourceManifest(repositoryRoot, "regional-economies" as never);
    expect(rows.map((row) => [row.source_id, row.byte_size, row.sha256])).toEqual([
      ["source.geostat_regional_gdp", 13_871, "dd2042dff5e2c44b98b4bb140163b5736cf5a71f4683b9e6a359373907d59c35"],
      ["source.geostat_regional_gdp_by_activity", 99_089, "88e337bd82a5232ea5260f011b11cb2d82c2cec5115fddbe92d14d1ff3945337"],
    ]);
    expect(rows.every((row) => row.years[0] === 2010 && row.years.at(-1) === 2024)).toBe(true);
  });

  it("parses, normalizes, expands years, derives download hrefs, and sorts newest first", async () => {
    const repositoryRoot = await createRepository();
    const secondSourcePath = path.join(repositoryRoot, "docs/Raw Data/Expenditure/2020/source-b.xlsx");
    await mkdir(path.dirname(secondSourcePath), { recursive: true });
    await writeFile(secondSourcePath, "source-b");
    const rows = [
      validRow({ year: "2005-2006", sha256: validRow().sha256.toUpperCase() }),
      validRow({
        source_id: "source.expenditure.2020.b",
        year: "2020",
        official_filename: "source-b.xlsx",
        repository_source_path: "docs/Raw Data/Expenditure/2020/source-b.xlsx",
        public_download_path: "downloads/methodology/expenditure/files/2020/source-b.xlsx",
        media_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        byte_size: Buffer.byteLength("source-b"),
        sha256: sha256("source-b"),
      }),
    ];
    const manifestPath = path.join(repositoryRoot, "data/methodology/source-archives/expenditure.csv");
    await mkdir(path.dirname(manifestPath), { recursive: true });
    await writeFile(manifestPath, serializeRows(rows));

    const result = await loadReviewedSourceManifest(repositoryRoot, "expenditure");

    expect(result.map((row) => row.source_id)).toEqual([
      "source.expenditure.2020.b",
      "source.expenditure.2005.a",
    ]);
    expect(result[1]).toMatchObject({
      years: [2005, 2006],
      sha256: validRow().sha256,
      downloadHref: "/downloads/methodology/expenditure/files/2005/source-a.pdf",
    });
    expect(result[1].downloadHref).not.toContain("docs/Raw Data");
  });

  it.each([
    { name: "parent traversal", mutate: (row: ReviewedSourceManifestRow) => ({ ...row, repository_source_path: "docs/Raw Data/Expenditure/../outside.pdf" }), message: /traversal/i },
    { name: "absolute paths", mutate: (row: ReviewedSourceManifestRow, root: string) => ({ ...row, repository_source_path: path.join(root, "source.pdf") }), message: /relative path/i },
    { name: "missing files", mutate: (row: ReviewedSourceManifestRow) => ({ ...row, repository_source_path: "docs/Raw Data/Expenditure/2005/missing.pdf" }), message: /does not exist/i },
    { name: "invalid dataset IDs", mutate: (row: ReviewedSourceManifestRow) => ({ ...row, dataset_id: "inflation" as never }), message: /dataset/i },
    { name: "mismatched byte sizes", mutate: (row: ReviewedSourceManifestRow) => ({ ...row, byte_size: row.byte_size + 1 }), message: /byte size/i },
    { name: "mismatched hashes", mutate: (row: ReviewedSourceManifestRow) => ({ ...row, sha256: "0".repeat(64) }), message: /sha-256/i },
    { name: "blank attribution", mutate: (row: ReviewedSourceManifestRow) => ({ ...row, attribution_text: "   " }), message: /attribution/i },
    { name: "disallowed redistribution", mutate: (row: ReviewedSourceManifestRow) => ({ ...row, redistribution_status: "unknown" as never }), message: /redistribution/i },
    { name: "missing proxy basis", mutate: (row: ReviewedSourceManifestRow) => ({ ...row, retrieved_at_basis: "" as never }), message: /retrieved.*basis/i },
    { name: "public paths outside the dataset files root", mutate: (row: ReviewedSourceManifestRow) => ({ ...row, public_download_path: "downloads/methodology/revenue/files/2005/source-a.pdf" }), message: /public download path/i },
    { name: "uppercase public path characters", mutate: (row: ReviewedSourceManifestRow) => ({ ...row, public_download_path: "downloads/methodology/expenditure/files/2005/Source-a.pdf" }), message: /lowercase ascii/i },
    { name: "non-ASCII public path characters", mutate: (row: ReviewedSourceManifestRow) => ({ ...row, public_download_path: "downloads/methodology/expenditure/files/2005/source-ა.pdf" }), message: /lowercase ascii/i },
    { name: "spaces in public paths", mutate: (row: ReviewedSourceManifestRow) => ({ ...row, public_download_path: "downloads/methodology/expenditure/files/2005/source a.pdf" }), message: /lowercase ascii/i },
    { name: "URL-special public path characters", mutate: (row: ReviewedSourceManifestRow) => ({ ...row, public_download_path: "downloads/methodology/expenditure/files/2005/source%2fa.pdf" }), message: /lowercase ascii/i },
  ])("rejects $name", async ({ mutate, message }) => {
    const repositoryRoot = await createRepository();
    await expect(validateSourceManifest(repositoryRoot, "expenditure", [mutate(validRow(), repositoryRoot)])).rejects.toThrow(message);
  });

  it("rejects symlinks and out-of-root resolution", async () => {
    const repositoryRoot = await createRepository();
    const outsideRoot = await mkdtemp(path.join(tmpdir(), "methodology-manifest-outside-"));
    tempDirectories.push(outsideRoot);
    await writeFile(path.join(outsideRoot, "outside.pdf"), "source-a");
    const linkPath = path.join(repositoryRoot, "docs/Raw Data/Expenditure/linked");
    await symlink(outsideRoot, linkPath, process.platform === "win32" ? "junction" : "dir");

    await expect(validateSourceManifest(repositoryRoot, "expenditure", [validRow({
      repository_source_path: "docs/Raw Data/Expenditure/linked/outside.pdf",
    })])).rejects.toThrow(/symlink|outside repository/i);
  });

  it("rejects duplicate source IDs and duplicate public paths", async () => {
    const repositoryRoot = await createRepository();
    const sourceB = path.join(repositoryRoot, "docs/Raw Data/Expenditure/2006/source-b.pdf");
    await mkdir(path.dirname(sourceB), { recursive: true });
    await writeFile(sourceB, "source-b");
    const second = validRow({
      source_id: "source.expenditure.2006.b",
      year: "2006",
      official_filename: "source-b.pdf",
      repository_source_path: "docs/Raw Data/Expenditure/2006/source-b.pdf",
      public_download_path: "downloads/methodology/expenditure/files/2006/source-b.pdf",
      byte_size: Buffer.byteLength("source-b"),
      sha256: sha256("source-b"),
    });

    await expect(validateSourceManifest(repositoryRoot, "expenditure", [validRow(), { ...second, source_id: validRow().source_id }])).rejects.toThrow(/duplicate source id/i);
    await expect(validateSourceManifest(repositoryRoot, "expenditure", [validRow(), { ...second, public_download_path: validRow().public_download_path }])).rejects.toThrow(/duplicate public path/i);
  });

  it.each([
    { date: "2026-02-30", name: "an impossible day" },
    { date: "2025-02-29", name: "a non-leap-year February 29" },
  ])("rejects $name instead of normalizing $date", async ({ date }) => {
    const repositoryRoot = await createRepository();

    await expect(
      validateSourceManifest(repositoryRoot, "expenditure", [validRow({ retrieved_at: date })]),
    ).rejects.toThrow(/valid date/i);
  });

  it("accepts February 29 in a leap year", async () => {
    const repositoryRoot = await createRepository();

    const [row] = await validateSourceManifest(repositoryRoot, "expenditure", [
      validRow({ retrieved_at: "2024-02-29" }),
    ]);

    expect(row.retrieved_at).toBe("2024-02-29");
  });
});
