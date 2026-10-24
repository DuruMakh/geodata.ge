import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { MethodologyArticle } from "../../components/methodology/methodology-article";
import { SourceArchive, type PublicSourceManifestRow } from "../../components/methodology/source-archive";
import { METHODOLOGY_CONTENT } from "../../lib/methodology/catalog";
import { resolveSiteUrl } from "../../lib/siteUrl";
import { getMessages } from "../../lib/i18n/messages.server";
import { I18nProvider } from "../../lib/i18n/provider";
import common from "../../lib/i18n/messages/ka/common.json";
import methodology from "../../lib/i18n/messages/ka/methodology.json";

// Counting the served loader is the only way to see which articles need debt
// data: every article renders the same component, and the memo hides a second
// call behind the first.
vi.mock("../../lib/data/governmentDebt/importGovernmentDebtFacts", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("../../lib/data/governmentDebt/importGovernmentDebtFacts")
  >();
  return { ...actual, loadServedGovernmentDebtData: vi.fn(actual.loadServedGovernmentDebtData) };
});

// Rendering a methodology page reads the archive report that only `prebuild` writes; see the helper.
vi.mock("../../lib/methodology/prepareArchives", async (importOriginal) =>
  (await import("../helpers/archive-summaries")).withValidatedArchiveSummaries(importOriginal));

const archiveSummary = {
  fileCount: 1,
  totalBytes: 1,
  latestRetrievedAt: "2026-09-01",
  validated: true,
};

it.each([
  ["ka", "საქსტატის მომსახურებით ვაჭრობის გვერდი"],
  ["en", "Geostat services trade source page"],
] as const)("renders the Services publisher link in the %s Trade methodology", async (locale, label) => {
  const { renderMethodologyArticle } = await import("../../lib/pages/methodology-article");
  const markup = renderToStaticMarkup(await renderMethodologyArticle(locale, { params: Promise.resolve({ dataset: "trade" }) }));
  const services = markup.match(/<section[^>]*id="services"[\s\S]*?<\/section>/)?.[0] ?? "";
  expect(services).toContain('href="https://www.geostat.ge/en/modules/categories/766/international-trade-in-services"');
  expect(services).toMatch(new RegExp(`<a[^>]*>${label}</a>`));
});

it("omits processed-data links for an article without a public dataset publication", () => {
  const markup = renderToStaticMarkup(createElement(MethodologyArticle, {
    locale: "ka", messages: { ...common, ...methodology }, content: METHODOLOGY_CONTENT.debt,
    coverage: { firstYear: 2013, lastYear: 2030 }, rows: [], archiveSummary,
    processedDataHref: null, processedDataJsonLinks: [], breadcrumbItems: [],
  }));
  expect(markup).not.toContain('data-testid="processed-dataset-download"');
  expect(markup).not.toContain("CC BY 4.0");
  expect(markup).toContain('id="source-archive"');
});

function renderArticle(dataset: "debt" | "expenditure") {
  return renderToStaticMarkup(createElement(MethodologyArticle, {
    locale: "ka",
    messages: { ...common, ...methodology },
    content: METHODOLOGY_CONTENT[dataset],
    coverage: dataset === "debt" ? { firstYear: 2013, lastYear: 2030 } : { firstYear: 2004, lastYear: 2025 },
    rows: [],
    archiveSummary,
    processedDataHref: dataset === "debt"
      ? "/downloads/data/government-debt.csv"
      : "/downloads/data/national-expenditure.csv",
    // Debt has no JSON publication; expenditure has two.
    processedDataJsonLinks:
      dataset === "debt"
        ? []
        : [
            { href: "/downloads/data/national-expenditure.json", label: "სახელმწიფო ხარჯები" },
            { href: "/downloads/data/ministries.json", label: "უწყებები და პროგრამები" },
          ],
    breadcrumbItems: [],
  }));
}

describe("the basis key fact of a budget side whose latest year is a plan", () => {
  const basisOf = (markup: string, label: string) => markup.match(new RegExp(`<dt[^>]*>${label}</dt><dd[^>]*>([^<]*)</dd>`))?.[1];

  it.each([
    ["ka", "საფუძველი", "12-თვიანი ფაქტობრივი შესრულება, 2004–2025; 2026 — დამტკიცებული გეგმა"],
    ["en", "Basis", "Actual execution for the full 12 months, 2004–2025; 2026: approved plan"],
  ] as const)("names the plan year apart from the actual years: %s", async (locale, label, basis) => {
    const { renderMethodologyArticle } = await import("../../lib/pages/methodology-article");
    const markup = renderToStaticMarkup(await renderMethodologyArticle(locale, { params: Promise.resolve({ dataset: "expenditure" }) }));
    expect(basisOf(markup, label)).toBe(basis);
  });

  it("leaves an all-actual side's basis as written", async () => {
    const { renderMethodologyArticle } = await import("../../lib/pages/methodology-article");
    const markup = renderToStaticMarkup(await renderMethodologyArticle("ka", { params: Promise.resolve({ dataset: "revenue" }) }));
    expect(basisOf(markup, "საფუძველი")).toBe(METHODOLOGY_CONTENT.revenue.keyFacts.find((fact) => fact.valueKind === "basis")?.value);
  });
});

describe("methodology processed-download caption", () => {
  // Debt describes its CSV with neutral status metadata rather than fact/plan metadata; every category keeps
  // its existing download link and the shared format/licence caption.
  it.each([
    ["debt", "/downloads/data/government-debt.csv"],
    ["expenditure", "/downloads/data/national-expenditure.csv"],
  ] as const)("the %s caption links %s with status metadata and the shared format/licence line", (dataset, href) => {
    const markup = renderArticle(dataset);

    expect(markup).toContain(`href="${href}"`);
    expect(markup).toContain("UTF-8 / Excel თავსებადი · CC BY 4.0");
    expect(markup).toContain("სტატუსის მეტამონაცემებით");
    if (dataset === "debt") expect(markup).not.toContain("ფაქტი/გეგმის მეტამონაცემებით");
  });
});

describe("methodology article data loading", () => {
  it("loads debt facts only for the debt article", async () => {
    const { renderMethodologyArticle } = await import("../../lib/pages/methodology-article");
    const { loadServedGovernmentDebtData } = await import(
      "../../lib/data/governmentDebt/importGovernmentDebtFacts"
    );

    await renderMethodologyArticle("ka", { params: Promise.resolve({ dataset: "revenue" }) });
    expect(loadServedGovernmentDebtData).not.toHaveBeenCalled();

    await renderMethodologyArticle("ka", { params: Promise.resolve({ dataset: "debt" }) });
    expect(loadServedGovernmentDebtData).toHaveBeenCalledTimes(1);

    // English articles come from a separate content record, but
    // deriveMethodologyCoverage always reads the Georgian one. The guard has to
    // agree in both locales, or the English debt build throws for want of years.
    await renderMethodologyArticle("en", { params: Promise.resolve({ dataset: "debt" }) });
    expect(loadServedGovernmentDebtData).toHaveBeenCalledTimes(2);

    await renderMethodologyArticle("en", { params: Promise.resolve({ dataset: "revenue" }) });
    expect(loadServedGovernmentDebtData).toHaveBeenCalledTimes(2);
  });
});

describe("methodology footer attribution", () => {
  it.each([
    ["inflation", "Geostat and the National Bank of Georgia"],
    ["gdp", "World Bank and Geostat"],
    ["economic-sectors", "Geostat"],
    ["regional-economies", "Geostat"],
    ["demography", "Geostat"],
    ["household-income", "Geostat"],
    ["business", "Geostat"],
    ["housing", "Geostat"],
    ["transport", "Geostat"],
    ["health", "Geostat"],
    ["crime", "Geostat"],
    ["environment", "Geostat"],
    ["internet", "Geostat"],
    ["education", "Geostat"],
    ["social-protection", "Social Service Agency and Geostat"],
    ["science-culture", "Geostat"],
  ])("uses %s sources and leaves the review date with the article", async (dataset, source) => {
    const { renderMethodologyArticle } = await import("../../lib/pages/methodology-article");
    const markup = renderToStaticMarkup(await renderMethodologyArticle("en", { params: Promise.resolve({ dataset }) }));
    const footer = markup.match(/<footer[\s\S]*?<\/footer>/)?.[0] ?? "";
    expect(footer).toContain(source);
    expect(footer).not.toContain("Ministry of Finance");
    expect(footer).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    const header = markup.match(/<header[\s\S]*?<\/header>/)?.[0] ?? "";
    expect(header).toContain(`Last methodology review · ${METHODOLOGY_CONTENT[dataset as keyof typeof METHODOLOGY_CONTENT].reviewedAt}`);
  });
});

describe("household income and spending methodology", () => {
  it.each([["ka", "შინამეურნეობების შემოსავლები და ხარჯები"], ["en", "Household income and spending"]] as const)("renders the %s article with its 21 archived originals and Dataset markup", async (locale, title) => {
    const { renderMethodologyArticle } = await import("../../lib/pages/methodology-article");
    const markup = renderToStaticMarkup(await renderMethodologyArticle(locale, { params: Promise.resolve({ dataset: "household-income" }) }));
    expect(markup).toContain(title);
    expect(markup).toContain("2002–2025");
    expect(markup).toContain('"@type":"Dataset"');
    expect(markup).toContain("/downloads/methodology/household-income/files/104-income-per-household.xlsx");
    expect(markup).toContain("/downloads/methodology/household-income/files/income-page-2026-10-11.html.txt");
    expect(markup).not.toContain("/official/ka/");
  });
});

describe("health methodology", () => {
  it.each([
    ["ka", "ჯანდაცვა და სიკვდილის მიზეზები", "24 შემთხვევა დაკავშირებულია COVID-19-თან"],
    ["en", "Healthcare and causes of death", "In 2021, 24 cases of maternal deaths are related to COVID-19"],
  ] as const)("renders the %s article with its 36 archived originals, Geostat's notes and Dataset markup", async (locale, title, maternalNote) => {
    const { renderMethodologyArticle } = await import("../../lib/pages/methodology-article");
    const markup = renderToStaticMarkup(await renderMethodologyArticle(locale, { params: Promise.resolve({ dataset: "health" }) }));
    expect(markup).toContain(title);
    expect(markup).toContain("2002–2025");
    expect(markup).toContain('"@type":"Dataset"');
    expect(markup).toContain(maternalNote);
    expect(markup).toContain("/downloads/methodology/health/files/number-of-physicians-by-occupations.xlsx");
    expect(markup).toContain("/downloads/methodology/health/files/23-2-deaths-by-chapters-regions.xlsx");
    expect(markup).toContain("/downloads/methodology/health/files/deaths-page.html.txt");
    expect(markup).not.toContain("geostat.ge/media");
  });
});

describe("crime methodology", () => {
  it.each([
    ["ka", "დანაშაული და მართლმსაჯულება", "შესაბამისად 2025 წლის მონაცემები შესადარისი არ არის 2001-2024 წლების მონაცემებთან.", "მოიცავს ყველა საგამოძიებო უწყების მონაცემებს."],
    ["en", "Crime and justice", "Accordingly, the 2025 data is not comparable with data from previous years.", "Note: Includes all investigative agencies of Georgia."],
  ] as const)("renders the %s article with its 22 archived originals, Geostat's notes, the Unified Report link and Dataset markup", async (locale, title, drunkDrivingNote, recordedNote) => {
    const { renderMethodologyArticle } = await import("../../lib/pages/methodology-article");
    const markup = renderToStaticMarkup(await renderMethodologyArticle(locale, { params: Promise.resolve({ dataset: "crime" }) }));
    expect(markup).toContain(title);
    expect(markup).toContain("2001–2025");
    expect(markup).toContain('"@type":"Dataset"');
    expect(markup).toContain(drunkDrivingNote);
    expect(markup).toContain(recordedNote);
    expect(markup).toContain("/downloads/methodology/crime/files/number-of-recorded-crimes.xlsx");
    expect(markup).toContain("/downloads/methodology/crime/files/prison-population.xls");
    expect(markup).toContain("/downloads/methodology/crime/files/registrirebuli-danasaulis-raodenoba.xlsx");
    expect(markup).toContain("/downloads/methodology/crime/files/crime-page.html.txt");
    // The Unified Report is linked on geostat.ge, not archived; the workbooks link only to their archive copies.
    expect(markup).toContain("https://geostat.ge/media/76844/Unified-Report-on-Criminal-Justice-Statistics-%28Dec%2C-2025%29.pdf");
    expect(markup).not.toContain("/downloads/methodology/crime/files/unified-report");
    expect(markup).not.toContain("geostat.ge/media/81890");
  });
});

describe("internet methodology", () => {
  it.each([
    ["ka", "ინტერნეტი და ტექნოლოგიები", ["2020 წლიდან გაიზარდა გამოკვლევის შერჩევის ზომა.", "2016-2019 წლები მოიცავს იმერეთის, რაჭა-ლეჩხუმისა და ქვემო სვანეთის რეგიონებს.", "ივნისში ან ივლისში", "მიზეზებს არ ასახელებს"]],
    ["en", "Internet and technology", ["Survey sample size has been increased since 2020.", "The data of 2016-2019 includes Imereti, Racha-Lechkhumi and Kvemo Svaneti regions.", "in June or July", "state no causes"]],
  ] as const)("renders the %s article with its 36 archived originals, the survey, sample and Imereti notes and Dataset markup", async (locale, title, statements) => {
    const { renderMethodologyArticle } = await import("../../lib/pages/methodology-article");
    const markup = renderToStaticMarkup(await renderMethodologyArticle(locale, { params: Promise.resolve({ dataset: "internet" }) }));
    expect(markup).toContain(title);
    expect(markup).toContain("2016–2026");
    expect(markup).toContain('"@type":"Dataset"');
    for (const statement of statements) expect(markup).toContain(statement);
    for (const file of ["01_share_of_households_with_internet_access.xlsx", "01_internetit_uzrunvelyopili_shinameurneobebi.xlsx", "17_ict_skills.xlsx", "geostat-category-106-2026-10-20.html.txt", "geostat-category-106-ka-2026-10-20.html.txt"]) {
      expect(markup).toContain(`/downloads/methodology/internet/files/${file}`);
    }
  });
});

describe("environment methodology", () => {
  it.each([
    ["ka", "გარემო და კლიმატი", "ზესტაფონის არაავტომატურ სადგურზე სინჯების აღების მეთოდოლოგიას არ იძლევა საშუალებას", "სადგური ამოქმედდა 2019 წლის მაისიდან"],
    ["en", "Environment and climate", "Sampling methodology at Zestaponi non-automatic station can provide neigther daily avarage concentrations", "The station has been operational since May 2019"],
  ] as const)("renders the %s article with its 46 archived originals, Geostat's notes and Dataset markup", async (locale, title, zestaponiNote, stationNote) => {
    const { renderMethodologyArticle } = await import("../../lib/pages/methodology-article");
    const markup = renderToStaticMarkup(await renderMethodologyArticle(locale, { params: Promise.resolve({ dataset: "environment" }) }));
    expect(markup).toContain(title);
    expect(markup).toContain("1990–2025");
    expect(markup).toContain('"@type":"Dataset"');
    expect(markup).toContain(zestaponiNote);
    expect(markup).toContain(stationNote);
    expect(markup).toContain("/downloads/methodology/environment/files/b-3.-greenhouse-gas-emissions-eng.xlsx");
    expect(markup).toContain("/downloads/methodology/environment/files/volume-of-felled-timber.xls");
    expect(markup).toContain("/downloads/methodology/environment/files/b-3.-greenhouse-gas-emissions-geo.xlsx");
    expect(markup).toContain("/downloads/methodology/environment/files/page-565-en.html.txt");
    expect(markup).not.toContain("geostat.ge/media");
  });
});

describe("science and culture methodology", () => {
  it.each([
    ["ka", "მეცნიერება და კულტურა", "*2006-2020 წლების მონაცემები მოიცავს მხოლოდ სპექტაკლებს.", "13, 19 და 30 დამთვალიერებლით", "სასარგებლო მოდელი პატენტის უფრო მოკლე და მარტივი სახეა მცირე გამოგონებებისთვის."],
    ["en", "Science and culture", "*2006-2020 data includes only performances.", "13, 19 and 30 visitors", "A utility model is a shorter, simpler kind of patent for smaller inventions."],
  ] as const)("renders the %s article with its 33 archived originals, Geostat's notes, the visitor differences, the utility model and Dataset markup", async (locale, title, audienceNote, visitorDifferences, utilityModel) => {
    const { renderMethodologyArticle } = await import("../../lib/pages/methodology-article");
    const markup = renderToStaticMarkup(await renderMethodologyArticle(locale, { params: Promise.resolve({ dataset: "science-culture" }) }));
    expect(markup).toContain(title);
    expect(markup).toContain("2005–2025");
    expect(markup).not.toContain("2001–2025");
    expect(markup).toContain(utilityModel);
    expect(markup).toContain('"@type":"Dataset"');
    expect(markup).toContain(audienceNote);
    expect(markup).toContain(visitorDifferences);
    expect(markup).toContain("1,012");
    expect(markup).toContain("/downloads/methodology/science-culture/files/researchers.xlsx");
    expect(markup).toContain("/downloads/methodology/science-culture/files/r-d-personal.xlsx");
    expect(markup).toContain("/downloads/methodology/science-culture/files/events.xls");
    expect(markup).toContain("/downloads/methodology/science-culture/files/mkvlevarebi.xlsx");
    expect(markup).toContain("/downloads/methodology/science-culture/files/geostat-category-615-2026-10-20.html.txt");
    expect(markup).not.toContain("geostat.ge/media");
  });
});

describe("transport methodology", () => {
  it.each([
    ["ka", "ტრანსპორტი", ["შსს-ის", "2008 წლიდან", "კუმულაციური", "ერთი მგზავრის ერთი კილომეტრით", "არ უნდა შეიკრიბოს", "ტრანზიტი", "აფხაზეთის", "საავტომობილო გზების დეპარტამენტის", "მგზავრთა გადაყვანის საქმიანობის საწარმოებს", "უმნიშვნელო სიდიდე"]],
    ["en", "Transport", ["Ministry of Internal Affairs", "end of each year", "agricultural machinery from 2008", "cumulative", "one passenger carried one kilometre", "should not be added together", "Transit is goods carried across Georgia", "Abkhazia", "Roads Department of Georgia manages", "state no causes", "Table covers enterprises of passenger transport activities in Georgia.", "Table covers data on enterprises of transport activities in Georgia.", "Negligible magnitude"]],
  ] as const)("renders the %s article with its 25 archived originals, the spec's notes and Dataset markup", async (locale, title, statements) => {
    const { renderMethodologyArticle } = await import("../../lib/pages/methodology-article");
    const markup = renderToStaticMarkup(await renderMethodologyArticle(locale, { params: Promise.resolve({ dataset: "transport" }) }));
    expect(markup).toContain(title);
    expect(markup).toContain("2000–2025");
    expect(markup).toContain('"@type":"Dataset"');
    for (const statement of statements) expect(markup).toContain(statement);
    // Geostat's railway, air and sea metadata are linked, not archived.
    for (const pdf of ["79116/0527_200526_EN.PDF", "79115/0526_200526_EN.PDF", "79117/0532_200526_EN.PDF"]) expect(markup).toContain(`https://www.geostat.ge/media/${pdf}`);
    for (const file of ["h-1-passenger-transport-demand_eng.xlsx", "number-of-registered-vehicles.xlsx", "length-of-road-eng-2024.xls", "geostat-category-565-2026-10-20.html.txt"]) {
      expect(markup).toContain(`/downloads/methodology/transport/files/${file}`);
    }
  });
});

describe("housing methodology", () => {
  it.each([
    ["ka", "საცხოვრებელი და მშენებლობა", ["შეთავაზების ფასებია და არა გაყიდვის ფასები", "IV კვარტლის მნიშვნელობა და არა წლის ოთხი კვარტლის საშუალო", "69 ნებართვა"]],
    ["en", "Housing and construction", ["asking prices, not sale prices", "fourth-quarter value, not an average of the year’s four quarters", "has issued 69 permits for construction and reconstruction of special significance buildings in 2025"]],
  ] as const)("renders the %s article with its 21 archived originals, the asking-price and fourth-quarter notes and Dataset markup", async (locale, title, statements) => {
    const { renderMethodologyArticle } = await import("../../lib/pages/methodology-article");
    const markup = renderToStaticMarkup(await renderMethodologyArticle(locale, { params: Promise.resolve({ dataset: "housing" }) }));
    expect(markup).toContain(title);
    expect(markup).toContain("2006–2025");
    expect(markup).toContain('"@type":"Dataset"');
    for (const statement of statements) expect(markup).toContain(statement);
    // Geostat's own metadata is linked, in the page's language, because it is not one of the archived originals.
    // Both language editions of Geostat's metadata are linked on both pages, so the two translations keep one link structure.
    expect(markup).toContain("https://www.geostat.ge/media/78697/0509_300426_GE.PDF");
    expect(markup).toContain("https://www.geostat.ge/media/78698/0509_300426_EN.PDF");
    for (const file of ["0503en020101_permissions.xls", "permissions_eng.zip", "0503en020102c_permissions-by-type_2006-2025-eng.xls", "residential-property-prices-in-tbilisi-by-district.xlsx", "geostat-category-698-2026-10-16.html.txt"]) {
      expect(markup).toContain(`/downloads/methodology/housing/files/${file}`);
    }
  });
});

describe("education methodology", () => {
  it.each([
    ["ka", "განათლება", "9,836", "14,490"],
    ["en", "Education", "9,836", "14,490"],
  ] as const)("renders the %s article with its 45 archived originals, Geostat's own sums and Dataset markup", async (locale, title, samegrelo, guria) => {
    const { renderMethodologyArticle } = await import("../../lib/pages/methodology-article");
    const markup = renderToStaticMarkup(await renderMethodologyArticle(locale, { params: Promise.resolve({ dataset: "education" }) }));
    expect(markup).toContain(title);
    expect(markup).toContain("2000–2025");
    expect(markup).toContain('"@type":"Dataset"');
    // The two published sums that do not add up are named with Geostat's printed figures.
    expect(markup).toContain(samegrelo);
    expect(markup).toContain(guria);
    expect(markup).toContain("/downloads/methodology/education/files/01number-of-students-admission-graduates-by-programmes-and-sex.xlsx");
    expect(markup).toContain("/downloads/methodology/education/files/indicators-on-public-preschool-education-and-care-pec-institutions.xlsx");
    expect(markup).toContain("/downloads/methodology/education/files/number-of-educational-institutions-that-conducted-admission-of-students-in-vocational-education-programs.xlsx");
    expect(markup).toContain("/downloads/methodology/education/files/geostat-category-61-2026-10-16.html.txt");
    expect(markup).not.toContain("geostat.ge/media");
  });
});

describe("social protection methodology", () => {
  it.each([
    ["ka", "სოციალური დაცვა", "სოციალური მომსახურების სააგენტო"],
    ["en", "Social protection", "Social Service Agency"],
  ] as const)("renders the %s article with SSA's page captures, Geostat's divisors and Dataset markup crediting SSA", async (locale, title, agency) => {
    const { renderMethodologyArticle } = await import("../../lib/pages/methodology-article");
    const markup = renderToStaticMarkup(await renderMethodologyArticle(locale, { params: Promise.resolve({ dataset: "social-protection" }) }));
    expect(markup).toContain(title);
    expect(markup).toContain("2013–2025");
    expect(markup).toContain('"@type":"Dataset"');
    const jsonLd = markup.match(/<script[^>]*data-testid="dataset-json-ld"[^>]*>([\s\S]*?)<\/script>/)?.[1] ?? "";
    expect(jsonLd).toContain(agency);
    expect(markup.match(/data-testid="source-archive-row"/g)).toHaveLength(17);
    expect(markup).toContain("/downloads/methodology/social-protection/files/ssa-page-pension.html.txt");
    expect(markup).toContain("/downloads/methodology/social-protection/files/ssa-links-other.json");
    expect(markup).toContain("/downloads/methodology/social-protection/files/01-population-by-self-governed-unit.xlsx");
    // The SSA workbooks are never published: only the topic pages that list them (the PR #170 rule).
    expect(markup).not.toContain("/workbooks/");
    // The recorded source difference and the partial years are named with their figures.
    expect(markup).toContain(locale === "ka" ? "56 ლარით" : "56 GEL");
    expect(markup).toMatch(/2020[^.]*2021/);
  });
});

describe("business methodology", () => {
  it.each([["ka", "ბიზნესი"], ["en", "Business"]] as const)("renders the %s article with its 26 archived originals and Dataset markup", async (locale, title) => {
    const { renderMethodologyArticle } = await import("../../lib/pages/methodology-article");
    const markup = renderToStaticMarkup(await renderMethodologyArticle(locale, { params: Promise.resolve({ dataset: "business" }) }));
    expect(markup).toContain(title);
    expect(markup).toContain("1999–2025");
    expect(markup).toContain('"@type":"Dataset"');
    expect(markup).toContain("/downloads/methodology/business/files/0502en0101_turnover.xlsx");
    expect(markup).toContain("/downloads/methodology/business/files/0502_011026_en.pdf");
    expect(markup).toContain("/downloads/methodology/business/files/0502_011026_ge.pdf");
    expect(markup).toContain("/downloads/methodology/business/files/0519_200225_ge.pdf");
    expect(markup).toContain("/downloads/methodology/business/files/geostat-category-326-2026-10-15.html.txt");
  });

  it("quotes Geostat's own Georgian definitions from its Georgian metadata", async () => {
    const { renderMethodologyArticle } = await import("../../lib/pages/methodology-article");
    const markup = renderToStaticMarkup(await renderMethodologyArticle("ka", { params: Promise.resolve({ dataset: "business" }) }));
    expect(markup).toContain("„საწარმოს მიერ პროდუქტის ან მომსახურების გაყიდვებიდან მიღებული შემოსავალი (დღგ-ის და აქციზის გადასახადის გარეშე)“");
    expect(markup).toContain("„მატერიალური ძირითადი საშუალებების შეძენას და კაპიტალის გაუმჯობესებას, საიდანაც გამოიქვითება ძირითადი საშუალებების გაყიდვები და გადაცემა“");
    expect(markup).toContain("ინვესტიციები ფიქსირებულ აქტივებში");
    expect(markup).not.toContain("ძირითად კაპიტალში");
  });
});

describe("methodology without bulk files", () => {
  it("renders the demography article with its breadcrumb and archived originals but no download or Dataset markup", async () => {
    const { renderMethodologyArticle } = await import("../../lib/pages/methodology-article");
    const markup = renderToStaticMarkup(await renderMethodologyArticle("en", { params: Promise.resolve({ dataset: "demography" }) }));
    expect(markup).not.toContain("processed-dataset-download");
    expect(markup).not.toContain('data-testid="dataset-json-ld"');
    expect(markup).not.toContain("/downloads/data/");
    expect(markup).toContain('data-testid="breadcrumb-json-ld"');
    expect(markup).toContain("/downloads/methodology/demography/files/");
  });

  it("lists demography on the hub but keeps it out of the data catalog, which names only Dataset nodes", async () => {
    const { renderMethodologyPage } = await import("../../lib/pages/methodology");
    // The hub's coming-next list is empty, so no client-side ComingSoonBadge renders now; the provider stays for the day a
    // future-dataset row returns, because the real locale layout supplies one.
    const messages = await getMessages("en", ["common", "methodology"]);
    const markup = renderToStaticMarkup(<I18nProvider locale="en" messages={messages}>{await renderMethodologyPage("en")}</I18nProvider>);
    const catalog = markup.match(/<script data-testid="catalog-json-ld"[^>]*>([\s\S]*?)<\/script>/)![1]!;
    expect(catalog).toContain('/methodology/inflation"');
    expect(catalog).not.toContain("/methodology/demography");
    expect(markup).toContain('href="/en/methodology/demography"');
  });
});

// U29-04: the debt data is government debt, not the wider state debt the page's own caveat rules out.
it.each([
  ["ka", "მთავრობის ვალი"],
  ["en", "Government debt"],
] as const)("names the %s debt JSON download government debt", async (locale, label) => {
  const { renderMethodologyArticle } = await import("../../lib/pages/methodology-article");
  const markup = renderToStaticMarkup(await renderMethodologyArticle(locale, { params: Promise.resolve({ dataset: "debt" }) }));
  expect(markup).toMatch(new RegExp(`<a href="/downloads/data/government-debt.json"[^>]*>${label}</a>`));
});

// U29-02: a year filter with more chips than files pushed a short table far down a phone screen.
describe("the source archive's year filter", () => {
  const sourceRow = (index: number): PublicSourceManifestRow => ({
    source_id: `source-${index}`, year: "1960–2025", years: Array.from({ length: 66 }, (_, offset) => 1960 + offset),
    official_filename: `file-${index}.xlsx`, byte_size: 1000, downloadHref: `/downloads/methodology/gdp/files/file-${index}.xlsx`,
    title: `ფაილი ${index}`, publisher: "საქსტატი", searchLabels: [], documentLanguage: "ka",
  });
  const render = (count: number) => renderToStaticMarkup(
    <I18nProvider locale="ka" messages={{ ...common, ...methodology }}>
      <SourceArchive datasetId="gdp" datasetLabel="მშპ" rows={Array.from({ length: count }, (_, index) => sourceRow(index))} summary={archiveSummary} />
    </I18nProvider>,
  );

  it("is hidden for twelve files or fewer, keeping the search box", () => {
    const markup = render(12);
    expect(markup).not.toContain('data-testid="archive-year-filter"');
    expect(markup).toContain('type="search"');
    expect(markup.match(/data-testid="source-archive-row"/g)).toHaveLength(12);
    expect(markup).toContain("1960–2025");
  });

  it("is shown for thirteen files", () => {
    const markup = render(13);
    expect(markup).toContain('data-testid="archive-year-filter"');
    expect(markup).toContain(">1960</button>");
  });

  // U29-16, U29-17: a row's title and publisher are readable at body size, and a year range takes one dash everywhere.
  it("prints a year range with an en dash and the title and publisher at body size", () => {
    const markup = renderToStaticMarkup(
      <I18nProvider locale="ka" messages={{ ...common, ...methodology }}>
        <SourceArchive datasetId="gdp" datasetLabel="მშპ" rows={[{ ...sourceRow(0), year: "2019-2024" }]} summary={archiveSummary} />
      </I18nProvider>,
    );
    expect(markup).toContain(">2019–2024</td>");
    expect(markup).not.toContain("2019-2024");
    expect(markup).toMatch(/<span class="block text-\[0.8125rem\] font-semibold[^"]*">ფაილი 0<\/span>/);
    expect(markup).toMatch(/<span class="mt-1 block text-\[0.75rem\][^"]*">საქსტატი<\/span>/);
  });
});

// Moved from inflation-overview.spec.ts: the methodology Dataset is the node the catalog references.
it("makes the inflation methodology Dataset the node the catalog references, in each language", async () => {
  const { renderMethodologyArticle } = await import("../../lib/pages/methodology-article");
  const { renderMethodologyPage } = await import("../../lib/pages/methodology");
  const dataset = async (locale: "ka" | "en") => {
    const markup = renderToStaticMarkup(await renderMethodologyArticle(locale, { params: Promise.resolve({ dataset: "inflation" }) }));
    return JSON.parse(markup.match(/<script data-testid="dataset-json-ld"[^>]*>([\s\S]*?)<\/script>/)![1]!);
  };
  const messages = await getMessages("ka", ["common", "methodology"]);
  const hub = renderToStaticMarkup(<I18nProvider locale="ka" messages={messages}>{await renderMethodologyPage("ka")}</I18nProvider>);
  const catalog = JSON.parse(hub.match(/<script data-testid="catalog-json-ld"[^>]*>([\s\S]*?)<\/script>/)![1]!);
  const origin = resolveSiteUrl();
  const id = `${origin}/methodology/inflation`;
  expect(catalog.dataset.map((entry: { "@id": string }) => entry["@id"])).toContain(id);
  const georgian = await dataset("ka");
  expect(georgian["@id"]).toBe(id);
  expect(georgian.includedInDataCatalog["@id"]).toBe(`${origin}/methodology#catalog`);
  expect(georgian.distribution[0].contentUrl).toBe(`${origin}/downloads/data/inflation-cpi-national.csv`);
  // The English page is the English node, in the English catalog.
  const english = await dataset("en");
  expect(english["@id"]).toBe(`${origin}/en/methodology/inflation`);
  expect(english.includedInDataCatalog["@id"]).toBe(`${origin}/en/methodology#catalog`);
});

// U29-13: the unused document-stack figure and the LINEAGE re-export are gone; only the open-document figure is drawn.
it("document visuals export only the figure a page draws", async () => {
  expect(Object.keys(await import("../../components/methodology/document-visuals"))).toEqual(["OpenDocumentVisual"]);
});

// U29-18: the English GDP archive named three World Bank files by their file name twice; they get reviewed titles.
it("titles every English GDP source document, not by its file name", async () => {
  const { renderMethodologyArticle } = await import("../../lib/pages/methodology-article");
  const messages = await getMessages("en", ["common", "methodology"]);
  const markup = renderToStaticMarkup(<I18nProvider locale="en" messages={messages}>{await renderMethodologyArticle("en", { params: Promise.resolve({ dataset: "gdp" }) })}</I18nProvider>);
  for (const title of ["World Bank · Real GDP", "World Bank · Annual GDP growth", "World Bank · GDP indicator metadata"]) expect(markup).toContain(`>${title}</span>`);
  expect(markup).not.toMatch(/font-semibold[^"]*">[^<]*\.json<\/span>/);
});
