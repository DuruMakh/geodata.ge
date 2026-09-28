import { pageHref } from "../i18n/routes";
import type { Locale } from "../i18n/types";

/** A page-specific description. Product facts have no standalone public CSV distribution. */
export function inflationProductDatasetJsonLd(input: {
  locale: Locale;
  origin: string;
  firstPeriod: string;
  lastPeriod: string;
  reviewedAt: string;
  sourceUrls: string[];
}) {
  const { locale, origin, firstPeriod, lastPeriod, reviewedAt, sourceUrls } = input;
  const en = locale === "en";
  return {
    "@context": "https://schema.org",
    "@type": "Dataset",
    "@id": `${origin}/explorer/inflation/products#dataset`,
    name: en ? "Individual-product inflation in Georgia" : "ცალკეული პროდუქტების ინფლაცია საქართველოში",
    description: en ?
      "Geostat's published annual and previous-month price indices for every current consumer-basket product, with a cumulative change derived by Fiscal.ge from complete monthly histories." :
      "საქსტატის გამოქვეყნებული წლიური და წინა თვესთან შედარებული ფასების ინდექსები მოქმედი სამომხმარებლო კალათის ყველა პროდუქტისთვის; დაგროვილ ცვლილებას Fiscal.ge ითვლის სრული თვიური ისტორიიდან.",
    url: new URL(pageHref("/explorer/inflation/products", locale), origin).href,
    inLanguage: locale,
    temporalCoverage: `${firstPeriod}/${lastPeriod}`,
    dateModified: reviewedAt,
    spatialCoverage: { "@type": "Place", name: en ? "Georgia" : "საქართველო" },
    provider: { "@type": "Organization", name: en ? "National Statistics Office of Georgia (Geostat)" : "საქართველოს სტატისტიკის ეროვნული სამსახური (საქსტატი)" },
    publisher: { "@id": `${origin}/#organization` },
    measurementTechnique: en ?
      "Annual change is Geostat's same-month-of-prior-year index minus 100. Cumulative change is compounded by Fiscal.ge from every published previous-month index since December before the selected first year; missing months leave the full span unavailable." :
      "წლიური ცვლილება არის საქსტატის წინა წლის იმავე თვესთან შედარებული ინდექსი გამოკლებული 100. დაგროვილ ცვლილებას Fiscal.ge ითვლის თითოეული გამოქვეყნებული თვიური ინდექსის გამრავლებით არჩეული საწყისი წლის წინა დეკემბრიდან; გამოტოვებული თვე სრულ პერიოდს მიუწვდომელს ხდის.",
    variableMeasured: [
      { "@type": "PropertyValue", name: en ? "Published annual product price index" : "გამოქვეყნებული წლიური პროდუქტის ფასის ინდექსი", unitText: "index, prior-year month = 100" },
      { "@type": "PropertyValue", name: en ? "Cumulative product price change calculated by Fiscal.ge" : "Fiscal.ge-ზე გამოთვლილი პროდუქტის ფასის დაგროვილი ცვლილება", unitText: "%" },
    ],
    isBasedOn: sourceUrls,
  };
}
