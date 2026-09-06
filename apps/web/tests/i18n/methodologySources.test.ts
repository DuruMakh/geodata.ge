import { describe, expect, it } from "vitest";
import { projectPublicSources } from "../../lib/methodology/publicSources";
import type { ValidatedSourceManifestRow } from "../../lib/methodology/sourceManifest";
import type { EnglishCatalogue } from "../../lib/i18n/types";
import { matchesLabelQuery } from "../../lib/i18n/search";

const row: ValidatedSourceManifestRow = {
  source_id: "doc.1", year: "2025", years: [2025], source_organization: "ფინანსთა სამინისტრო",
  display_title_ka: "წლიური ანგარიში", official_filename: "ანგარიში.xlsx", media_type: "application/vnd.ms-excel", byte_size: 100,
  downloadHref: "/downloads/methodology/expenditure/files/report.xlsx",
  dataset_id: "expenditure", official_url_or_archive_url: "https://example.com/report.xlsx",
  repository_source_path: "data/report.xlsx", public_download_path: "report.xlsx",
  sha256: "a".repeat(64), retrieved_at: "2026-09-05", retrieved_at_basis: "exact",
  license_id: "CC-BY-4.0", attribution_text: "Ministry of Finance",
  redistribution_status: "approved_with_attribution", notes: "",
};
const documents: EnglishCatalogue["documents"] = {
  "doc.1": { title: { text: "Annual report", reviewedAt: "2026-09-05" }, publisher: { text: "Ministry of Finance", reviewedAt: "2026-09-05" }, attribution: null, documentLanguage: null },
};

describe("translated archive descriptions", () => {
  it("joins by document ID, preserves original filenames and URLs, and searches both languages", () => {
    const [en] = projectPublicSources([row], "en", documents);
    const [ka] = projectPublicSources([row], "ka", documents);
    expect(en.title).toBe("Annual report");
    expect(en.publisher).toBe("Ministry of Finance");
    expect(ka.title).toBe(row.display_title_ka);
    expect(en.official_filename).toBe(row.official_filename);
    expect(en.downloadHref).toBe(row.downloadHref);
    expect(en.documentLanguage).toBeNull(); // A Georgian filename does not establish document language.
    for (const query of ["annual", "წლიური", "ministry", "ფინანსთა"]) expect(matchesLabelQuery(query, en.searchLabels)).toBe(true);
    expect(ka.searchLabels).toEqual(en.searchLabels);
  });
  it("rejects a missing reviewed document instead of showing Georgian on the English page", () => {
    expect(() => projectPublicSources([row], "en", {})).toThrow("doc.1");
  });
});
