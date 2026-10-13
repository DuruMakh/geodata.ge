import type { Metadata } from "next";
import { resolveSiteUrl } from "../siteUrl";
import { DEBT_EXPLORER_PATH, DEFICIT_EXPLORER_PATH } from "./internalLinks";
import type { Locale } from "../i18n/types";
import { pageHref } from "../i18n/routes";
import { seoMessage } from "./strings";
import { message } from "../i18n/messages";
import kaDebt from "../i18n/messages/ka/debt.json";
import enDebt from "../i18n/messages/en/debt.json";
import kaDeficit from "../i18n/messages/ka/deficit.json";
import enDeficit from "../i18n/messages/en/deficit.json";

// The debt and deficit titles quote actual-only coverage; both languages read
// their text from the page's own message file.
const DEBT_MESSAGES = { ka: kaDebt, en: enDebt };
const DEFICIT_MESSAGES = { ka: kaDeficit, en: enDeficit };

const BRAND = "Fiscal.ge";

type FiscalMetadataInput = {
  locale: Locale;
  /** The page's own title; the brand is appended here when the title does not already end with it. */
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
  locale,
  title: pageTitle,
  description,
  path,
  type = "website",
}: FiscalMetadataInput): Metadata {
  const title = pageTitle.endsWith(BRAND) ? pageTitle : `${pageTitle} | ${BRAND}`;
  const origin = resolveSiteUrl();
  const ka = new URL(pageHref(path, "ka"), origin).href;
  const en = new URL(pageHref(path, "en"), origin).href;
  const absolute = locale === "en" ? en : ka;
  const socialImage = {
    url: `${origin}${locale === "en" ? "/en" : ""}/opengraph-image`,
    width: 1200, height: 630, alt: seoMessage(locale, "seo.socialAlt"),
  };
  return {
    metadataBase: new URL(origin),
    title,
    description,
    alternates: { canonical: absolute, languages: { ka, en, "x-default": ka } },
    openGraph: {
      type,
      siteName: "Fiscal.ge",
      locale: locale === "en" ? "en_GB" : "ka_GE",
      alternateLocale: [locale === "en" ? "ka_GE" : "en_GB"],
      url: absolute,
      title,
      description,
      images: [socialImage],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [socialImage],
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
  locale: Locale = "ka",
): Metadata {
  const { firstYear, lastYear } = coverageFromYears(
    facts.filter((fact) => fact.family === "stock" && fact.status === "actual"),
  );
  const years = { first: firstYear, last: lastYear };
  return fiscalMetadata({
    locale,
    title: message(DEBT_MESSAGES[locale], "debt.metaTitle", years),
    description: message(DEBT_MESSAGES[locale], "debt.description", years),
    path: DEBT_EXPLORER_PATH,
  });
}

export function generalGovernmentDeficitMetadata(
  facts: readonly { year: number; status: string }[],
  locale: Locale = "ka",
): Metadata {
  const { firstYear, lastYear } = coverageFromYears(
    facts.filter((fact) => fact.status === "actual"),
  );
  const years = { first: firstYear, last: lastYear };
  return fiscalMetadata({
    locale,
    title: message(DEFICIT_MESSAGES[locale], "deficit.metaTitle", years),
    description: message(DEFICIT_MESSAGES[locale], "deficit.description", years),
    path: DEFICIT_EXPLORER_PATH,
  });
}
