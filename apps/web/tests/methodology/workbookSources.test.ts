import { describe, expect, it } from "vitest";
import {
  loadWorkbookSources,
  projectWorkbookSources,
  resetWorkbookSourceCacheForTests,
} from "../../lib/methodology/workbookSources";

describe("projectWorkbookSources", () => {
  it("keeps only client-safe public fields", () => {
    const projected = projectWorkbookSources([
      {
        source_id: "source.mof.revenue.2025.form_1",
        dataset_id: "revenue",
        year: "2025",
        years: [2025],
        source_organization: "საქართველოს ფინანსთა სამინისტრო",
        display_title_ka: "2025 წლის კონსოლიდირებული ბიუჯეტის შემოსავლები",
        official_filename: "2025.pdf",
        official_url_or_archive_url: "Repository archive",
        repository_source_path: "docs/Raw Data/Revenue/2025.pdf",
        public_download_path: "downloads/methodology/revenue/files/2025/mof-revenue-form-1.pdf",
        downloadHref: "/downloads/methodology/revenue/files/2025/mof-revenue-form-1.pdf",
        media_type: "application/pdf",
        byte_size: 10,
        sha256: "a".repeat(64),
        retrieved_at: "2026-05-14",
        retrieved_at_basis: "repository_first_commit_proxy",
        license_id: "official-public-document-no-explicit-license",
        attribution_text: "საქართველოს ფინანსთა სამინისტრო",
        redistribution_status: "repository_owner_approved",
        notes: "internal note",
      },
    ]);

    expect(projected).toEqual([
      {
        years: [2025],
        titleKa: "2025 წლის კონსოლიდირებული ბიუჯეტის შემოსავლები",
        organizationKa: "საქართველოს ფინანსთა სამინისტრო",
        downloadHref: "/downloads/methodology/revenue/files/2025/mof-revenue-form-1.pdf",
        retrievedAt: "2026-05-14",
      },
    ]);
    expect(JSON.stringify(projected)).not.toContain("docs/Raw Data");
    expect(JSON.stringify(projected)).not.toContain("source.mof");
  });
});

describe("loadWorkbookSources", () => {
  it.each(["expenditure", "revenue", "municipalities"] as const)(
    "loads validated public sources for %s",
    async (datasetId) => {
      resetWorkbookSourceCacheForTests();
      const sources = await loadWorkbookSources(datasetId);

      expect(sources.length).toBeGreaterThan(0);
      expect(sources.every((source) => source.downloadHref.startsWith(`/downloads/methodology/${datasetId}/files/`))).toBe(true);
      expect(sources.every((source) => !Object.hasOwn(source, "repository_source_path"))).toBe(true);
      expect(JSON.stringify(sources)).not.toContain("repository_source_path");
    },
  );

  it("memoizes the promise per dataset", () => {
    resetWorkbookSourceCacheForTests();
    expect(loadWorkbookSources("revenue")).toBe(loadWorkbookSources("revenue"));
  });
});
