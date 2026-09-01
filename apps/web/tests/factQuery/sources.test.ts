// apps/web/tests/factQuery/sources.test.ts
import { describe, expect, it } from "vitest";
import { buildFactQuerySnapshot } from "../../lib/factQuery/buildSnapshot";
import { selectSources } from "../../lib/factQuery/sources";

const OPTIONS = { releaseCommit: "test-commit", generatedAt: "2026-08-28T00:00:00.000Z" };

describe("public source resolution", () => {
  it("never emits an internal repository path as a public url", async () => {
    const snapshot = await buildFactQuerySnapshot(OPTIONS);
    expect(snapshot.sources.length).toBeGreaterThan(0);

    for (const source of snapshot.sources) {
      for (const document of source.documents) {
        for (const url of [document.officialUrl, document.archiveUrl]) {
          if (url === null) continue;
          expect(url).toMatch(/^https:\/\//);
          expect(url).not.toContain("docs/Raw Data");
        }
      }
    }
  });

  // The test above only checks for the "docs/Raw Data" substring — it would
  // not catch a URL with prose trailing after it (e.g. a real
  // "https://mof.ge/5039" followed by " Repository archive: ..."), which is
  // exactly the shape data/methodology/source-archives/*.csv's
  // official_url_or_archive_url column holds in 99 of 180 rows today (just
  // never yet combined with an https:// prefix). This asserts the stronger,
  // general property over every resolved document in the snapshot: a
  // non-null officialUrl/archiveUrl round-trips unchanged through the URL
  // parser (nothing left for it to silently percent-encode away) and never
  // contains whitespace or either prose fragment. A future manifest row
  // combining a real URL with trailing notes fails here instead of shipping.
  it("every resolved officialUrl and archiveUrl is a clean, single https:// URL with no embedded prose", async () => {
    const snapshot = await buildFactQuerySnapshot(OPTIONS);
    let checked = 0;

    for (const source of snapshot.sources) {
      for (const document of source.documents) {
        for (const url of [document.officialUrl, document.archiveUrl]) {
          if (url === null) continue;
          checked += 1;

          expect(url).toMatch(/^https:\/\//);
          expect(url).not.toMatch(/\s/);
          expect(url).not.toContain("Raw Data");
          expect(url).not.toContain("Repository archive");
          expect(url).toBe(new URL(url).href);
        }
      }
    }

    expect(checked).toBeGreaterThan(0);
  });

  it("never emits a sentinel source id", async () => {
    const snapshot = await buildFactQuerySnapshot(OPTIONS);
    for (const source of snapshot.sources) {
      expect(source.sourceId).not.toMatch(/^mixed:/);
      expect(source.sourceId.length).toBeGreaterThan(0);
    }
  });

  it("resolves every source id referenced by a served national fact", async () => {
    const snapshot = await buildFactQuerySnapshot(OPTIONS);
    const known = new Set(snapshot.sources.map((s) => s.sourceId));
    const referenced = new Set(snapshot.national.facts.flatMap((f) => f.sourceId.split(";").map((s) => s.trim())));

    expect([...referenced].filter((id) => !known.has(id))).toEqual([]);
  });

  it("returns only the requested sources, deduplicated and ordered", async () => {
    const snapshot = await buildFactQuerySnapshot(OPTIONS);
    const target = snapshot.sources[0]!.sourceId;

    const selected = selectSources(snapshot, [target, target, "source.does_not_exist"]);
    expect(selected.map((s) => s.sourceId)).toEqual([target]);
  });

  // Golden mappings: resolvePublicSources' path-join, its " + " multi-file
  // split, and its directory-prefix fallback are all mechanisms the brief
  // never specified — nothing above pins what a source's documents actually
  // are, so every test up to this point would still pass if the join
  // attached the wrong document, or none at all. These pin exact,
  // independently-verified documentId sets (and, for the third case, exact
  // officialUrl/archiveUrl values) against data/sources/source-documents.csv
  // and the reviewed manifests as they exist today, so a future change that
  // breaks the join fails here instead of only showing up as a silently
  // wrong or missing citation.
  describe("golden document mappings", () => {
    it("a straightforward single-path source resolves to exactly its one archived document", async () => {
      const snapshot = await buildFactQuerySnapshot(OPTIONS);
      const source = snapshot.sources.find((s) => s.sourceId === "source.mof_2017_revenue_form1_pdf");

      expect(source?.documents).toMatchObject([
        {
          documentId: "source.mof.revenue.2017.form_1",
          title: "2017 წლის კონსოლიდირებული ბიუჯეტის შემოსავლები",
          officialUrl: null,
          archiveUrl: "https://fiscal.ge/downloads/methodology/revenue/files/2017/mof-revenue-form-1.pdf",
        },
      ]);
    });

    it("a ' + '-joined multi-file source resolves to both archived documents", async () => {
      const snapshot = await buildFactQuerySnapshot(OPTIONS);
      const source = snapshot.sources.find(
        (s) => s.sourceId === "source.mof_2017_expenditure_pdf_e11_plus_tavi6_supplement_actual",
      );

      expect(source?.documents).toMatchObject([
        {
          documentId: "source.mof.expenditure.2017.mof_excel_fact",
          title: "2017 წლის სახელმწიფო ბიუჯეტის შესრულების სამუშაო წიგნი",
          officialUrl: null,
          archiveUrl: "https://fiscal.ge/downloads/methodology/expenditure/files/2017/mof-excel-fact.xlsx",
        },
        {
          documentId: "source.mof.expenditure.2017.treasury_e11",
          title: "2017 წლის სახელმწიფო ბიუჯეტის ფუნქციური შესრულება",
          officialUrl: null,
          archiveUrl: "https://fiscal.ge/downloads/methodology/expenditure/files/2017/treasury-e11.pdf",
        },
      ]);
    });

    // Also covers the "gains a real officialUrl" case: source_url_or_file
    // names the adjara-republic-budget-2015-2025 directory (no single file
    // matches it exactly), so this only resolves via the directory-prefix
    // fallback — and the 2015 file's manifest row happens to carry a real
    // matsne.gov.ge URL in official_url_or_archive_url, while the 2016-2025
    // file's row holds only descriptive text ("user-supplied official
    // workbook"), so the two documents exercise both branches of the
    // officialUrl guard side by side.
    it("a directory-prefix-fallback source resolves to every file under it, with a real officialUrl where the manifest records one", async () => {
      const snapshot = await buildFactQuerySnapshot(OPTIONS);
      const source = snapshot.sources.find((s) => s.sourceId === "source.adjara_republic_budget_actual");

      expect(source?.documents).toMatchObject([
        {
          documentId: "source.adjara.republic.2015.actual_payments",
          title: "აჭარის ა.რ. რესპუბლიკური ბიუჯეტი — 2015 წლის ფაქტობრივი გადასახდელები",
          officialUrl: "https://matsne.gov.ge/ka/document/download/3515842/2/ge/pdf",
          archiveUrl: "https://fiscal.ge/downloads/methodology/municipalities/files/2015/adjara-republic-actual-payments.pdf",
        },
        {
          documentId: "source.adjara.republic.2016_2025.actual_payments",
          title: "აჭარის ა.რ. რესპუბლიკური ბიუჯეტის ფაქტობრივი გადასახდელები 2016–2025",
          officialUrl: null,
          archiveUrl: "https://fiscal.ge/downloads/methodology/municipalities/files/2016-2025/adjara-republic-actual-payments.xlsx",
        },
      ]);
    });
  });

  // Spec section 8.1. These three sources back 3,389 fact rows and resolved to
  // nothing before this: two because the join missed (an extracted file, and a
  // manifest that was never read), one because it is a derived calculation
  // with no document of its own. Each failure mode is distinct, so each gets
  // its own test rather than one "everything resolves" assertion.
  describe("every source resolves to a document or a stated derivation", () => {
    it("leaves no source unresolved", async () => {
      const snapshot = await buildFactQuerySnapshot(OPTIONS);
      const unresolved = snapshot.sources
        .filter((source) => source.documents.length === 0 && source.derivation === null)
        .map((source) => source.sourceId);

      expect(unresolved).toEqual([]);
      expect(snapshot.sources.length).toBe(104);
    });

    it("resolves an extracted file to the archived original it came from", async () => {
      const snapshot = await buildFactQuerySnapshot(OPTIONS);
      const source = snapshot.sources.find((s) => s.sourceId === "source.municipal_portal_archive");

      // source_url_or_file names functionals/functionals.csv; the ZIP it was
      // extracted from is what the manifest publishes.
      expect(source?.documents.map((d) => d.documentId)).toEqual([
        "source.mof.municipalities.2015_2019.portal_functionals",
      ]);
      expect(source?.documents[0]?.officialUrl).toBe(
        "https://web.archive.org/web/20220628234046id_/https://municipalities.mof.ge/api/OpenData?fileName=functionals.zip",
      );
      expect(source?.derivation).toBeNull();
    });

    it("resolves the Geostat population package manifest", async () => {
      const snapshot = await buildFactQuerySnapshot(OPTIONS);
      const source = snapshot.sources.find((s) => s.sourceId === "source.geostat_municipal_population");

      expect(source?.documents[0]?.officialUrl).toBe(
        "https://www.geostat.ge/media/78356/01-population-by-self-governed-unit.xlsx",
      );
      expect(source?.documents[0]?.sha256).toBe(
        "8bd7a1b56e756e8d6bc92192095795b204b23fd18274aaff39b78c0b0a487a57",
      );
    });

    it("states the derivation of the consolidated Adjara calculation and cites its upstream originals", async () => {
      const snapshot = await buildFactQuerySnapshot(OPTIONS);
      const source = snapshot.sources.find((s) => s.sourceId === "source.adjara_consolidated_budget");

      expect(source?.derivation).toBe(source?.name);
      expect((source?.derivation ?? "").length).toBeGreaterThan(0);
      // Upstream originals, not a document of the derived figures - there is none.
      expect(source?.documents.map((d) => d.documentId)).toEqual([
        "source.adjara.republic.2015.actual_payments",
        "source.adjara.republic.2016_2025.actual_payments",
      ]);
    });

    it("leaves every ordinary source's derivation null", async () => {
      const snapshot = await buildFactQuerySnapshot(OPTIONS);
      const derived = snapshot.sources.filter((s) => s.derivation !== null).map((s) => s.sourceId);

      // The field is for genuinely derived sources, not a dumping ground.
      expect(derived).toEqual(["source.adjara_consolidated_budget"]);
    });

    it("carries provenance metadata on every document", async () => {
      const snapshot = await buildFactQuerySnapshot(OPTIONS);

      for (const source of snapshot.sources) {
        for (const document of source.documents) {
          expect(document.sha256).toMatch(/^[0-9a-f]{64}$/);
          expect(document.byteSize).toBeGreaterThan(0);
          expect(document.publisher.length).toBeGreaterThan(0);
          expect(document.retrievedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
          expect(document.years.length).toBeGreaterThan(0);
        }
      }
    });

    it("does not alias a path that was never an extracted file", async () => {
      const snapshot = await buildFactQuerySnapshot(OPTIONS);
      const source = snapshot.sources.find((s) => s.sourceId === "source.mof_2017_revenue_form1_pdf");

      // The alias map is exact, not a "strip a segment and retry" heuristic:
      // an ordinary source must still resolve only to its own document.
      expect(source?.documents.map((d) => d.documentId)).toEqual(["source.mof.revenue.2017.form_1"]);
    });
  });
});
