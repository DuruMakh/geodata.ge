import type { MethodologyContent } from "../../types";

export const WAGES_METHODOLOGY_CONTENT: MethodologyContent = {
  "id": "wages",
  "slug": "wages",
  "title": "Wages",
  "summary": "Georgia’s annual average and median gross monthly wages nationally, by sex, employer type, economic activity and region, in nominal lari.",
  "reviewedAt": "2026-10-10",
  "archiveManifestId": "wages",
  "coverageSource": {
    "kind": "archive"
  },
  "canonicalDocuments": [
    "docs/data-methodology/wages-annual.md"
  ],
  "disclosure": "Values are nominal and not adjusted for inflation. Quarterly data, real wages, occupation, labour cost and the gender pay gap are outside these pages.",
  "keyFacts": [
    {
      "label": "Coverage",
      "valueKind": "coverage"
    },
    {
      "label": "Frequency",
      "valueKind": "frequency",
      "value": "Annual"
    },
    {
      "label": "Basis",
      "valueKind": "basis",
      "value": "Actual"
    },
    {
      "label": "Units",
      "valueKind": "unit",
      "value": "Nominal GEL per month"
    }
  ],
  "sections": [
    {
      "id": "scope",
      "kind": "scope",
      "title": "Which wages are covered?",
      "paragraphs": [
        "Annual gross monthly wages of employees in Georgia, from Geostat: the average wage nationally since 1995, by sex since 1999, for public and non-public employers since 2000, for business and non-business employers since 2006, by region since 2010 and by 19 economic activities since 2014, and the median wage since 2018. Self-employed people are not employees and are not covered. Quarterly data, occupation, labour cost and the gender pay gap are not shown."
      ]
    },
    {
      "id": "measures",
      "kind": "classification",
      "title": "Average and median wages",
      "paragraphs": [
        "The average wage is gross earnings accrued to paid employees in the year, divided by the average number of employees (part-time work counted as full-time equivalents) and by 12. It comes from Geostat’s enterprise surveys. The median is the middle value of individual employees’ gross earnings, which Geostat calculates from Revenue Service records; it does not assume a full-time basis. Gross earnings are before personal income tax and include wages and salaries, allowances, bonuses, pay for time not worked and payments in kind."
      ]
    },
    {
      "id": "nominal",
      "kind": "limitations",
      "title": "Current lari, not purchasing power",
      "paragraphs": [
        "All values are nominal lari per month. They are not adjusted for inflation, so a rising wage does not by itself mean higher purchasing power. The series starts in 1995, when the lari was introduced; earlier rouble and coupon values are not shown. Fiscal.ge creates no real-wage, growth or pay-gap figures."
      ]
    },
    {
      "id": "groups",
      "kind": "classification",
      "title": "Employers, industries and regions",
      "paragraphs": [
        "Economic activities follow NACE Rev.2 sections A–S from 2014; older NACE Rev.1.1 tables are not joined to them. Not every group publishes every activity: business-sector tables omit financial activities and public administration, which belong to the non-business and financial sector, and public-sector mining is never published, so it shows dashes. Some enterprises are counted at their head-office location, so a region’s figure can reflect where firms are registered rather than exactly where people work."
      ]
    },
    {
      "id": "validation",
      "kind": "validation",
      "title": "How are the figures checked?",
      "paragraphs": [
        "1,917 published values and 12 unpublished cells are served. Each value is re-read from its original Geostat workbook cell, and the original files are checked against their recorded fingerprints. The research package passes 686 reconciliation checks, including repeated totals, single-sector identities and figures in Geostat’s 2025 releases. Pages show the values at Geostat’s published precision: one decimal for averages and whole lari for the median. Survey estimates have sampling error, so small differences and close rankings should not be treated as significant."
      ]
    },
    {
      "id": "archive",
      "kind": "archive",
      "title": "Original sources",
      "paragraphs": [
        "12 Geostat originals retrieved on 9 October 2026 are available: seven annual wage workbooks, the Wages page, the two 2025 news releases and the two current metadata documents. The HTML page downloads as a plain-text attachment. Excel follows the chosen view, series and years, and lists the workbooks behind them."
      ]
    }
  ],
  "decisions": [
    {
      "id": "wages.scope",
      "group": "wages",
      "title": "Which wages are covered?",
      "statusLabel": "Fiscal.ge decision",
      "summary": "Annual gross monthly wages of employees in Georgia, from Geostat: the average wage nationally since 1995, by sex since 1999, for public and non-public employers since 2000, for business and non-business employers since 2006, by region since 2010 and by 19 economic activities since 2014, and the median wage since 2018. Self-employed people are not employees and are not covered. Quarterly data, occupation, labour cost and the gender pay gap are not shown.",
      "detail": [],
      "canonicalDecisionIds": [
        "wages.scope"
      ]
    },
    {
      "id": "wages.measures",
      "group": "wages",
      "title": "Average and median wages",
      "statusLabel": "Fiscal.ge decision",
      "summary": "The average wage is gross earnings accrued to paid employees in the year, divided by the average number of employees (part-time work counted as full-time equivalents) and by 12. It comes from Geostat’s enterprise surveys. The median is the middle value of individual employees’ gross earnings, which Geostat calculates from Revenue Service records; it does not assume a full-time basis. Gross earnings are before personal income tax and include wages and salaries, allowances, bonuses, pay for time not worked and payments in kind.",
      "detail": [],
      "canonicalDecisionIds": [
        "wages.measures"
      ]
    },
    {
      "id": "wages.nominal",
      "group": "wages",
      "title": "Current lari, not purchasing power",
      "statusLabel": "Fiscal.ge decision",
      "summary": "All values are nominal lari per month. They are not adjusted for inflation, so a rising wage does not by itself mean higher purchasing power. The series starts in 1995, when the lari was introduced; earlier rouble and coupon values are not shown. Fiscal.ge creates no real-wage, growth or pay-gap figures.",
      "detail": [],
      "canonicalDecisionIds": [
        "wages.nominal"
      ]
    },
    {
      "id": "wages.groups",
      "group": "wages",
      "title": "Employers, industries and regions",
      "statusLabel": "Fiscal.ge decision",
      "summary": "Economic activities follow NACE Rev.2 sections A–S from 2014; older NACE Rev.1.1 tables are not joined to them. Not every group publishes every activity: business-sector tables omit financial activities and public administration, which belong to the non-business and financial sector, and public-sector mining is never published, so it shows dashes. Some enterprises are counted at their head-office location, so a region’s figure can reflect where firms are registered rather than exactly where people work.",
      "detail": [],
      "canonicalDecisionIds": [
        "wages.groups"
      ]
    }
  ],
  "technicalAppendix": [],
  "showTechnicalAppendix": false
};
