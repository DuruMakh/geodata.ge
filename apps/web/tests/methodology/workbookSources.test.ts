import { describe, expect, it } from "vitest";
import path from "node:path";
import {
  loadGdpWorkbookSources,
  loadWorkbookSources,
  projectGdpWorkbookSources,
  projectWorkbookSources,
  resetWorkbookSourceCacheForTests,
  scopeMunicipalWorkbookSources,
} from "../../lib/methodology/workbookSources";
import { loadReviewedSourceManifest } from "../../lib/methodology/sourceManifest";

const gdpRows = [
  {
    accounting_standard: "sna_1993",
    retrieved_file_url: "https://www.geostat.ge/media/27798/GDP-at-current-prices.xlsx",
    retrieved_at: "2026-08-13",
    selected_year_min: "1996",
    selected_year_max: "2009",
  },
  {
    accounting_standard: "sna_2008",
    retrieved_file_url: "https://www.geostat.ge/media/81052/03_GDP-at-Current-Prices.xlsx",
    retrieved_at: "2026-08-13",
    selected_year_min: "2010",
    selected_year_max: "2025",
  },
];

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

  it("deduplicates validated originals by content hash with a deterministic preference", () => {
    const base = {
      dataset_id: "expenditure" as const,
      year: "2025",
      years: [2025],
      source_organization: "საქართველოს ფინანსთა სამინისტრო",
      official_filename: "2025-fact.xlsx",
      official_url_or_archive_url: "Repository archive",
      repository_source_path: "docs/Raw Data/Expenditure/2025-fact.xlsx",
      media_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      byte_size: 10,
      sha256: "b".repeat(64),
      retrieved_at: "2026-05-14",
      retrieved_at_basis: "repository_first_commit_proxy" as const,
      license_id: "official-public-document-no-explicit-license",
      attribution_text: "საქართველოს ფინანსთა სამინისტრო",
      redistribution_status: "repository_owner_approved" as const,
      notes: "",
    };
    const finalFact = {
      ...base,
      source_id: "source.mof.expenditure.2025.mof_final_fact",
      display_title_ka: "Final fact",
      public_download_path: "downloads/methodology/expenditure/files/2025/mof-final-fact.xlsx",
      downloadHref: "/downloads/methodology/expenditure/files/2025/mof-final-fact.xlsx" as const,
    };
    const excelFact = {
      ...base,
      source_id: "source.mof.expenditure.2025.mof_excel_fact",
      display_title_ka: "Excel fact",
      public_download_path: "downloads/methodology/expenditure/files/2025/mof-excel-fact.xlsx",
      downloadHref: "/downloads/methodology/expenditure/files/2025/mof-excel-fact.xlsx" as const,
    };

    expect(projectWorkbookSources([finalFact, excelFact])).toEqual([
      expect.objectContaining({ downloadHref: excelFact.downloadHref, titleKa: "Excel fact" }),
    ]);

    expect(projectWorkbookSources([
      { ...finalFact, source_id: "source.z" },
      { ...finalFact, source_id: "source.a", display_title_ka: "Lexically first" },
    ])).toEqual([expect.objectContaining({ titleKa: "Lexically first" })]);
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

  it("returns role-scoped national and municipal source sets", async () => {
    resetWorkbookSourceCacheForTests();
    const revenue = await loadWorkbookSources("revenue", "revenue");
    const fields = await loadWorkbookSources("expenditure", "expenditure-fields");
    const ministries = await loadWorkbookSources("expenditure", "expenditure-ministries");
    const functional = await loadWorkbookSources("municipalities", "municipal-functional");
    const totals = await loadWorkbookSources("municipalities", "municipal-total");

    expect(revenue).toHaveLength(22);
    expect(fields.some((source) => source.downloadHref.includes("2013/mof-final-fact.pdf"))).toBe(true);
    expect(fields.some((source) => source.downloadHref.includes("2012/mof-final-fact"))).toBe(false);
    expect(ministries.some((source) => source.downloadHref.includes("2004/mof-annual-execution-annex"))).toBe(true);
    expect(ministries.some((source) => source.downloadHref.includes("2014/mof-excel-fact"))).toBe(false);
    expect(ministries.some((source) => source.downloadHref.includes("2015/mof-excel-fact"))).toBe(true);
    expect(ministries.some((source) => source.downloadHref.includes("2010/mof-annual-execution"))).toBe(true);
    expect(functional.every((source) => !source.downloadHref.includes("budget-history"))).toBe(true);
    expect(totals.some((source) => source.downloadHref.includes("budget-history-04"))).toBe(true);
  });

  it("covers every explicit national lineage year and real duplicate manifest content", async () => {
    resetWorkbookSourceCacheForTests();
    const fields = await loadWorkbookSources("expenditure", "expenditure-fields");
    const ministries = await loadWorkbookSources("expenditure", "expenditure-ministries");
    for (let year = 2004; year <= 2025; year += 1) {
      expect(fields.some((source) => source.years.includes(year))).toBe(true);
      expect(ministries.some((source) => source.years.includes(year))).toBe(true);
    }
    const rows = await loadReviewedSourceManifest(path.resolve(process.cwd(), "../.."), "expenditure");
    const duplicateHashRows = rows.filter((row) => row.sha256 === "b0039981526ea083f59704fe27bd670784b3b67512b07cc3307366d09f71c8f4");
    expect(duplicateHashRows.map((row) => row.source_id)).toEqual([
      "source.mof.expenditure.2005.mof_excel_fact",
      "source.mof.expenditure.2005.mof_final_fact",
    ]);
    expect(projectWorkbookSources(duplicateHashRows)).toEqual([
      expect.objectContaining({ downloadHref: "/downloads/methodology/expenditure/files/2005/mof-excel-fact.xlsx" }),
    ]);
    expect(ministries.filter((source) => source.downloadHref.includes("2005/mof-")).map((source) => source.downloadHref)).toEqual([
      "/downloads/methodology/expenditure/files/2005/mof-annual-execution.pdf",
      "/downloads/methodology/expenditure/files/2005/mof-excel-fact.xlsx",
    ]);
  });
});

describe("scopeMunicipalWorkbookSources", () => {
  it("keeps shared sources and only histories for the requested municipality codes", () => {
    const shared = {
      years: [2020],
      titleKa: "2020 წლის მუნიციპალური ბიუჯეტების ფუნქციური კლასიფიკაცია",
      organizationKa: "საქართველოს ფინანსთა სამინისტრო",
      downloadHref: "/downloads/methodology/municipalities/files/2020/mof-functional-classification.xlsx" as const,
      retrievedAt: "2026-07-26",
    };
    const history = (code: string) => ({
      ...shared,
      titleKa: `${code} მუნიციპალიტეტის ისტორია`,
      downloadHref: `/downloads/methodology/municipalities/files/2016-2025/mof-municipality-budget-history-${code}.xlsx` as const,
    });
    const adjaraRepublic = {
      ...shared,
      titleKa: "აჭარის ა.რ. რესპუბლიკური ბიუჯეტის ფაქტობრივი გადასახდელები",
      downloadHref: "/downloads/methodology/municipalities/files/2016-2025/adjara-republic-actual-payments.xlsx" as const,
    };

    const scoped = scopeMunicipalWorkbookSources(
      [shared, adjaraRepublic, history("04"), history("05"), history("06")],
      { municipalityCodes: ["04", "06"], includeAdjaraRepublic: false },
    );

    expect(scoped).toEqual([history("04"), history("06")]);
    expect(scopeMunicipalWorkbookSources(
      [shared, adjaraRepublic, history("06")],
      { municipalityCodes: ["06"], includeAdjaraRepublic: true },
    )).toEqual([adjaraRepublic, history("06")]);
  });

  it("keeps 2015 portal totals and the Khulo 2024 functional fallback only for code 11", async () => {
    resetWorkbookSourceCacheForTests();
    const totals = await loadWorkbookSources("municipalities", "municipal-total");
    const khulo = scopeMunicipalWorkbookSources(totals, { municipalityCodes: ["11"], includeAdjaraRepublic: false });
    const tbilisi = scopeMunicipalWorkbookSources(totals, { municipalityCodes: ["04"], includeAdjaraRepublic: false });
    expect(khulo.some((source) => source.downloadHref.includes("2015-2019/municipalities-portal-functionals"))).toBe(true);
    expect(khulo.some((source) => source.downloadHref.includes("2024/mof-functional-classification"))).toBe(true);
    expect(tbilisi.some((source) => source.downloadHref.includes("2024/mof-functional-classification"))).toBe(false);
  });
});

describe("projectGdpWorkbookSources", () => {
  it("projects the reviewed SNA workbook ranges with public Georgian metadata only", () => {
    const projected = projectGdpWorkbookSources(gdpRows);

    expect(projected).toEqual([
      {
        years: [1996, 1997, 1998, 1999, 2000, 2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009],
        titleKa: "მშპ მიმდინარე ფასებში — SNA 1993",
        organizationKa: "საქართველოს სტატისტიკის ეროვნული სამსახური (საქსტატი)",
        downloadHref: "https://www.geostat.ge/media/27798/GDP-at-current-prices.xlsx",
        retrievedAt: "2026-08-13",
      },
      {
        years: [2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025],
        titleKa: "მშპ მიმდინარე ფასებში — SNA 2008",
        organizationKa: "საქართველოს სტატისტიკის ეროვნული სამსახური (საქსტატი)",
        downloadHref: "https://www.geostat.ge/media/81052/03_GDP-at-Current-Prices.xlsx",
        retrievedAt: "2026-08-13",
      },
    ]);
    const json = JSON.stringify(projected);
    expect(json).not.toMatch(/docs\/Raw Data|local_file|source_id|sha256|notes/);
  });

  it("rejects non-HTTPS workbook URLs", () => {
    expect(() => projectGdpWorkbookSources([{ ...gdpRows[0], retrieved_file_url: "http://www.geostat.ge/gdp.xlsx" }])).toThrow();
  });

  it("rejects descending selected year ranges", () => {
    expect(() => projectGdpWorkbookSources([{ ...gdpRows[0], selected_year_min: "2010", selected_year_max: "2009" }])).toThrow();
  });
});

describe("loadGdpWorkbookSources", () => {
  it("memoizes its promise and resets it for tests", () => {
    resetWorkbookSourceCacheForTests();
    const first = loadGdpWorkbookSources();
    expect(loadGdpWorkbookSources()).toBe(first);
    resetWorkbookSourceCacheForTests();
    expect(loadGdpWorkbookSources()).not.toBe(first);
  });
});
