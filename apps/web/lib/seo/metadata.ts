import type { Metadata } from "next";
import { resolveSiteUrl } from "../siteUrl";
import { DEBT_EXPLORER_PATH } from "./internalLinks";

const SOCIAL_IMAGE = {
  url: "/opengraph-image",
  width: 1200,
  height: 630,
  alt: "Fiscal.ge — საქართველოს ბიუჯეტის მონაცემები",
};

type FiscalMetadataInput = {
  title: string;
  description: string;
  path: `/${string}` | "/";
  type?: "website" | "article";
};

export function coverageFromYears(rows: readonly { year: number }[]): {
  firstYear: number;
  lastYear: number;
} {
  if (rows.length === 0) {
    throw new Error("SEO coverage requires at least one served year");
  }
  const years = rows.map((row) => row.year);
  return { firstYear: Math.min(...years), lastYear: Math.max(...years) };
}

export function fiscalMetadata({
  title,
  description,
  path,
  type = "website",
}: FiscalMetadataInput): Metadata {
  const absolute = new URL(path, `${resolveSiteUrl()}/`).href;
  return {
    title,
    description,
    alternates: { canonical: absolute },
    openGraph: {
      type,
      siteName: "Fiscal.ge",
      locale: "ka_GE",
      url: absolute,
      title,
      description,
      images: [SOCIAL_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [SOCIAL_IMAGE.url],
    },
  };
}

export function municipalityBudgetTitleKa(
  nameKa: string,
  firstYear: number,
  lastYear: number,
): string {
  if (!nameKa.endsWith("მუნიციპალიტეტი")) {
    throw new Error(`Official municipality name must end in მუნიციპალიტეტი: ${nameKa}`);
  }
  return `${nameKa}ს ბიუჯეტი ${firstYear}–${lastYear} | Fiscal.ge`;
}

export function governmentDebtMetadata(
  facts: readonly { year: number; family: string; status: string }[],
): Metadata {
  const { firstYear, lastYear } = coverageFromYears(
    facts.filter((fact) => fact.family === "stock" && fact.status === "actual"),
  );
  return fiscalMetadata({
    title: `საქართველოს მთავრობის ვალი ${firstYear}–${lastYear} | Fiscal.ge`,
    description: `საქართველოს მთავრობის ვალის მოცულობა, ვალის მომსახურება და საპროცენტო განაკვეთები, ${firstYear}–${lastYear}.`,
    path: DEBT_EXPLORER_PATH,
  });
}
