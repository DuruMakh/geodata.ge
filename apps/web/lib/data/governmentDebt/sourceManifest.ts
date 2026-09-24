import { createHash } from "node:crypto";
import path from "node:path";
import {
  GOVERNMENT_DEBT_SOURCE_IDS,
  type GovernmentDebtSourceId,
  type SourceManifestRow,
} from "./types";
import { readPackageFile } from "../sourcePackage";

type CsvRow = Record<string, string>;

export const SOURCE_MANIFEST_HEADERS = [
  "source_id",
  "dataset_title",
  "publisher",
  "roles",
  "document_date",
  "source_page_url",
  "retrieved_file_url",
  "retrieved_at",
  "local_file",
  "sha256",
  "bytes",
  "source_period_min",
  "source_period_max",
  "used_period_min",
  "used_period_max",
  "notes",
] as const;

type SourceContract = Pick<
  SourceManifestRow,
  | "dataset_title"
  | "roles"
  | "document_date"
  | "source_page_url"
  | "retrieved_file_url"
  | "local_file"
  | "sha256"
  | "bytes"
  | "source_period_min"
  | "source_period_max"
  | "used_period_min"
  | "used_period_max"
  | "notes"
>;

const BULLETIN_PAGE =
  "https://mof.ge/en/fl/sakartvelos_sakhelmtsifo_valis_statistikuri_biuleteni";
const STRATEGY_PAGE =
  "https://mof.ge/en/fl/mtavrobis_valis_martvis_strategia";
const MONTHLY_PAGE =
  "https://mof.ge/en/fl/investorebtan_urtiertoba__mtavrobis_valis_koveltviuri_angarishi";
const CONTROL_PAGE =
  "https://www.mof.ge/en/fl/sakhelmtsifo_finansebis_statistika__tsentraluri_khelisuflebis_valebi";

const SOURCE_CONTRACTS: Record<GovernmentDebtSourceId, SourceContract> = {
  mof_public_debt_bulletin_n7: {
    dataset_title: "Public Debt of Georgia Statistical Bulletin N7",
    roles: "canonical_actual_service",
    document_date: "2016-12-31",
    source_page_url: BULLETIN_PAGE,
    retrieved_file_url:
      "https://mof.ge/files/download/PublicSectorDebtN7ENGMay2017.pdf/d8812ef3-d563-4447-b35e-8a0a0b812056",
    local_file: "official/public-debt-bulletin-n7.pdf",
    sha256: "0FC59178E8910028A7773EE03E55EAE97AF4AC1E425F928544D87B0522CC66DA",
    bytes: "1925033",
    source_period_min: "2013",
    source_period_max: "2016",
    used_period_min: "2013",
    used_period_max: "2016",
    notes:
      "External Government Debt service is canonical and Public Domestic Debt service is an overlap control for 2013-2016.",
  },
  mof_public_debt_bulletin_n13: {
    dataset_title: "Public Debt of Georgia Statistical Bulletin N13",
    roles: "canonical_stock|canonical_actual_service",
    document_date: "2019-12-31",
    source_page_url: BULLETIN_PAGE,
    retrieved_file_url:
      "https://mof.ge/files/download/N13ENG.pdf/78e85ff9-d592-4359-936a-b4874d3ebd1a",
    local_file: "official/public-debt-bulletin-n13.pdf",
    sha256: "BB27879C4EDD5D24D8246E2EC05F1E1DBE7F8374FE09BC673397184060E19CC2",
    bytes: "4726509",
    source_period_min: "2013",
    source_period_max: "2019",
    used_period_min: "2013",
    used_period_max: "2019",
    notes:
      "Government Debt stock is canonical for 2013-2014; external service is canonical and domestic service is an overlap control for 2017-2019.",
  },
  mof_public_debt_bulletin_n19: {
    dataset_title: "Public Debt of Georgia Statistical Bulletin N19",
    roles: "canonical_actual_service",
    document_date: "2022-12-31",
    source_page_url: BULLETIN_PAGE,
    retrieved_file_url:
      "https://mof.ge/files/download/N19ENG.pdf/87b685f6-5e38-41ec-b777-b9e499ab6eca",
    local_file: "official/public-debt-bulletin-n19.pdf",
    sha256: "07BF09C8B3CFEC8FEBD9FDE89CC8BD40E7F2876B836A2B8459692CABC4A9D8BF",
    bytes: "3256246",
    source_period_min: "2014",
    source_period_max: "2022",
    used_period_min: "2015",
    used_period_max: "2022",
    notes:
      "External Government Debt service is canonical for 2020-2022; Government Debt stock is an overlap control for 2015-2022 and domestic service is an overlap control for 2020-2022.",
  },
  mof_public_debt_bulletin_n25: {
    dataset_title: "Public Debt of Georgia Statistical Bulletin N25",
    roles: "canonical_stock|canonical_actual_service|canonical_forecast",
    document_date: "2025-12-31",
    source_page_url: BULLETIN_PAGE,
    retrieved_file_url:
      "https://mof.ge/files/download/N25ENGUpdate.pdf/a8e288fa-cb9e-4028-9ae1-32f2dde1ace2",
    local_file: "official/public-debt-bulletin-n25.pdf",
    sha256: "F4C3B267C0A351A09D723037CF666C949694FCF1764E0C3366B2EBC393AF35F0",
    bytes: "2294087",
    source_period_min: "2013",
    source_period_max: "2053",
    used_period_min: "2013",
    used_period_max: "2030",
    notes:
      "Government Debt stock for 2015-2025, domestic service history for 2013-2025, external service for 2023-2025, domestic service overlap controls for 2023-2025, and the 2025-12-31 forecast snapshot.",
  },
  mof_monthly_debt_report_2026_07: {
    dataset_title: "Monthly Debt Report July 2026",
    roles: "canonical_interest_rate",
    document_date: "2026-07",
    source_page_url: MONTHLY_PAGE,
    retrieved_file_url:
      "https://mof.ge/files/download/Monthly%20Debt%20Report%20%20July.pdf/91fdb650-1e68-46a5-899f-a752f9811742",
    local_file: "official/monthly-debt-report-2026-07.pdf",
    sha256: "EF71062CE4BF01042AEA5F5B9B86B783E6CF15E8D3A4A619FEE69415947FFF08",
    bytes: "1506985",
    source_period_min: "2015",
    source_period_max: "2026",
    used_period_min: "2015",
    used_period_max: "2025",
    notes:
      "Consistent one-decimal weighted-average interest rate history for total Government Debt.",
  },
  mof_debt_strategy_2019_2021: {
    dataset_title: "General Government Debt Management Strategy 2019-2021",
    roles: "canonical_interest_rate",
    document_date: "2019-02",
    source_page_url: STRATEGY_PAGE,
    retrieved_file_url:
      "https://mof.ge/files/download/DMSENG19213May2019Web.pdf/924681c3-c2cd-4455-8043-531d6ded8b5e",
    local_file: "official/debt-management-strategy-2019-2021.pdf",
    sha256: "140D7D9BA29747773603829533060D27E7F729E0AC575319C0385E25EC489399",
    bytes: "814323",
    source_period_min: "2018",
    source_period_max: "2021",
    used_period_min: "2018",
    used_period_max: "2018",
    notes:
      "Domestic Government Debt portfolio rate for 2018; the external figure is excluded because it does not cover the same full portfolio.",
  },
  mof_debt_strategy_2022_2025: {
    dataset_title: "General Government Debt Management Strategy 2022-2025",
    roles: "canonical_interest_rate",
    document_date: "2021-12",
    source_page_url: STRATEGY_PAGE,
    retrieved_file_url:
      "https://mof.ge/files/download/General%20Government%20Debt%20Management%20Strategy%20for%2020222025.pdf/7ebce43c-ea3f-42d8-bd79-4538e5290afe",
    local_file: "official/debt-management-strategy-2022-2025.pdf",
    sha256: "3CBB9CB715DBBC7D7F5FA7324F78B2C72801AF296533194BE7CD2911C093572C",
    bytes: "354156",
    source_period_min: "2019",
    source_period_max: "2025",
    used_period_min: "2019",
    used_period_max: "2020",
    notes:
      "Domestic Government Debt portfolio rates for 2019-2020; external rates explicitly exclude the Eurobond and are not normalized.",
  },
  mof_debt_strategy_2023_2026: {
    dataset_title: "General Government Debt Management Strategy 2023-2026",
    roles: "canonical_interest_rate",
    document_date: "2023",
    source_page_url: STRATEGY_PAGE,
    retrieved_file_url:
      "https://mof.ge/files/download/Government%20Debt%20Management%20Strategy%2020232026.pdf/b27d2e53-de14-417e-aa90-6c99794ad573",
    local_file: "official/debt-management-strategy-2023-2026.pdf",
    sha256: "4E1FD16FB2C63289E572B38D44CAE867FF07E6100F8871E1DC9A38429F926EBB",
    bytes: "722887",
    source_period_min: "2021",
    source_period_max: "2026",
    used_period_min: "2021",
    used_period_max: "2022",
    notes:
      "Full domestic and external Government Debt portfolio rates for 2021-2022.",
  },
  mof_debt_strategy_2025_2029: {
    dataset_title: "General Government Debt Management Strategy 2025-2029",
    roles: "canonical_interest_rate",
    document_date: "2025",
    source_page_url: STRATEGY_PAGE,
    retrieved_file_url:
      "https://mof.ge/files/download/DMS%2020252029%20ENG.pdf/43e57bc8-01e2-4b71-bf3f-57f3516115f1",
    local_file: "official/debt-management-strategy-2025-2029.pdf",
    sha256: "FEDC578DA24DD7A49219216A1369FBD7F237F23B89866C036B0F6B69F83D133A",
    bytes: "624909",
    source_period_min: "2023",
    source_period_max: "2029",
    used_period_min: "2023",
    used_period_max: "2024",
    notes:
      "Full domestic and external Government Debt portfolio rates for 2023-2024.",
  },
  mof_central_government_liabilities_control: {
    dataset_title:
      "Central Government Debt Liabilities by Maturity, Residency, and Instrument with reference to GFSM 2001",
    roles: "control_only",
    document_date: "2026-Q2",
    source_page_url: CONTROL_PAGE,
    retrieved_file_url:
      "https://www.mof.ge/files/download/centraluri%20xelisuflebis%20valebi%20da%20valdebulebebi.xls%20%20eng%20IIQ.xlsx/dc8cf5f0-82df-4b13-812e-25b53821df8b",
    local_file: "official/central-government-debt-liabilities-control.xlsx",
    sha256: "F326A4ECA0ECBA67CEFDE22A07FF6AD47E2FDD19B31B93FEF686332A585D0EDC",
    bytes: "25317",
    source_period_min: "2008",
    source_period_max: "2026",
    used_period_min: "2019",
    used_period_max: "2022",
    notes:
      "Control only: fourth-quarter 2019 and 2022 GFSM liability totals are compared but never used as normalized Government Debt values.",
  },
};

function packageDirectory(): string {
  return path.resolve(
    process.cwd(),
    "../../docs/Raw Data/Debt/government-debt-annual",
  );
}

function assertExactHeaders(row: CsvRow): void {
  if (Object.keys(row).join(",") !== SOURCE_MANIFEST_HEADERS.join(",")) {
    throw new Error("Source manifest headers do not match the approved schema");
  }
}

function assertValidUrl(value: string, field: string): void {
  const url = new URL(value);
  if (url.protocol !== "https:" || !["mof.ge", "www.mof.ge"].includes(url.hostname)) {
    throw new Error(`Invalid source-manifest ${field}: ${value}`);
  }
}

export async function validateGovernmentDebtSourceManifest(
  inputRows: CsvRow[],
): Promise<true> {
  if (inputRows.length !== GOVERNMENT_DEBT_SOURCE_IDS.length) {
    throw new Error(
      `Expected ${GOVERNMENT_DEBT_SOURCE_IDS.length} source-manifest rows`,
    );
  }

  const seenIds = new Set<string>();
  const packageDir = packageDirectory();

  for (const row of inputRows) {
    assertExactHeaders(row);
    const sourceId = row.source_id as GovernmentDebtSourceId;
    if (!GOVERNMENT_DEBT_SOURCE_IDS.includes(sourceId)) {
      throw new Error(`Unapproved source-manifest ID: ${row.source_id}`);
    }
    if (seenIds.has(sourceId)) {
      throw new Error(`Duplicate source-manifest ID: ${sourceId}`);
    }
    seenIds.add(sourceId);

    if (row.publisher !== "Ministry of Finance of Georgia") {
      throw new Error(`Unexpected source-manifest publisher for ${sourceId}`);
    }
    if (!row.dataset_title.trim() || !row.notes.trim()) {
      throw new Error(`Missing source-manifest description for ${sourceId}`);
    }
    if (!/^\d{4}(?:-(?:\d{2}|Q[1-4])(?:-\d{2})?)?$/.test(row.document_date)) {
      throw new Error(`Invalid source-manifest document_date for ${sourceId}`);
    }
    if (row.retrieved_at !== "2026-09-01") {
      throw new Error(`Unexpected source-manifest retrieved_at for ${sourceId}`);
    }
    assertValidUrl(row.source_page_url, "source_page_url");
    assertValidUrl(row.retrieved_file_url, "retrieved_file_url");

    const contract = SOURCE_CONTRACTS[sourceId];
    for (const field of Object.keys(contract) as Array<keyof SourceContract>) {
      if (row[field] !== contract[field]) {
        throw new Error(`Unexpected source-manifest ${field} for ${sourceId}`);
      }
    }

    const sourceMin = Number(row.source_period_min);
    const sourceMax = Number(row.source_period_max);
    const usedMin = Number(row.used_period_min);
    const usedMax = Number(row.used_period_max);
    if (
      ![sourceMin, sourceMax, usedMin, usedMax].every(Number.isInteger) ||
      sourceMin > usedMin ||
      usedMin > usedMax ||
      usedMax > sourceMax
    ) {
      throw new Error(`Invalid source-manifest period bounds for ${sourceId}`);
    }

    const bytes = await readPackageFile(packageDir, row.local_file);
    const hash = createHash("sha256").update(bytes).digest("hex").toUpperCase();
    if (hash !== row.sha256) {
      throw new Error(`Unexpected source-manifest sha256 for ${sourceId}`);
    }
    if (String(bytes.length) !== row.bytes) {
      throw new Error(`Unexpected source-manifest bytes for ${sourceId}`);
    }
  }

  return true;
}
