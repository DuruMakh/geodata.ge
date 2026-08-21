import { describe, expect, it } from "vitest";
import {
  loadGdpWorkbookSources,
  loadWorkbookSources,
  projectGdpWorkbookSources,
  projectWorkbookSources,
  resetWorkbookSourceCacheForTests,
  scopeMunicipalWorkbookSources,
} from "../../lib/methodology/workbookSources";

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

    expect(scoped).toEqual([shared, history("04"), history("06")]);
    expect(scopeMunicipalWorkbookSources(
      [shared, adjaraRepublic, history("06")],
      { municipalityCodes: ["06"], includeAdjaraRepublic: true },
    )).toEqual([shared, adjaraRepublic, history("06")]);
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
