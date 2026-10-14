import type { MethodologyContent } from "../../types";

export const POVERTY_METHODOLOGY_CONTENT: MethodologyContent = {
  "id": "poverty",
  "slug": "poverty",
  "title": "Poverty and inequality",
  "summary": "The share of Georgia’s population below the absolute, relative and international poverty lines, by settlement type, age and sex, and Gini coefficients of income and expenditure, from Geostat’s household survey.",
  "metaDescription": "Georgia’s population below the absolute, relative and international poverty lines by settlement, age and sex, and Gini coefficients, from Geostat.",
  "reviewedAt": "2026-10-10",
  "archiveManifestId": "poverty",
  "coverageSource": {
    "kind": "archive"
  },
  "canonicalDocuments": [
    "docs/data-methodology/poverty-annual.md"
  ],
  "disclosure": "All values are survey estimates. Household income and spending, poverty by region, the subsistence minimum and quarterly data are outside these pages.",
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
      "value": "% of population; Gini coefficient (0–1)"
    }
  ],
  "sections": [
    {
      "id": "scope",
      "kind": "scope",
      "title": "What do the pages cover?",
      "paragraphs": [
        "Annual figures for Georgia from Geostat: the share of the population below the absolute poverty line since 2004, for towns and villages, children (0–17), working age (18–64), people aged 65 and older, women and men; the share below 60% and 40% of median consumption since 2004, for Georgia, towns and villages; the share below the World Bank’s international poverty lines of $3.00, $4.20 and $8.30 a day since 2004; and six Gini coefficients since 2006. Household income and spending, poverty by region, the subsistence minimum, the lari value of the international lines and quarterly data are not shown."
      ]
    },
    {
      "id": "survey",
      "kind": "sources",
      "title": "Where do the figures come from?",
      "paragraphs": [
        "All figures come from Geostat’s household survey, which covers all private households in Georgia except the occupied territories (Abkhazian Autonomous Republic and Tskhinvali region). In 2025, 13,341 households were interviewed. The survey was the Integrated Household Survey before 2017 and the Households Incomes and Expenditures Survey from 2017, with a sampling frame based on the 2014 census instead of the 2002 census. Geostat’s metadata states that the data are comparable over time, so the charts draw no break."
      ]
    },
    {
      "id": "lines",
      "kind": "classification",
      "title": "Poverty lines",
      "paragraphs": [
        "The poverty-line rate is the share of the poor in the total population, measured against Geostat’s absolute poverty line; Geostat’s workbook notes that 2015 is the base year of calculating the poverty line. Relative poverty is the share of people whose consumption is below 60% or 40% of the median consumption, the level that half of the population consumes less than and half more than. The international lines are the World Bank’s $3.00, $4.20 and $8.30 a day at 2021 purchasing power parity, as republished by Geostat; Geostat’s file ends in 2024."
      ]
    },
    {
      "id": "gini",
      "kind": "classification",
      "title": "Gini coefficients",
      "paragraphs": [
        "The Gini coefficient shows how far the actual distribution of income or expenditure is from an equal one: 0 means everyone has the same and 1 means one person has everything. Geostat publishes six measures, defined in its workbook: total incomes include transfers, cash and non-cash incomes; total cash inflows include transfers, cash incomes and other cash inflows; total inflows include cash inflows and non-cash incomes; total consumption expenditures include cash and non-cash consumption expenditures; total cash expenditures include cash consumption and cash non-consumption expenditures; and total expenditures include cash and non-cash expenditures. Geostat’s metadata says Gini coefficients exist from 1997, but its published workbook starts in 2006, so the pages start in 2006 and add no earlier year from another source."
      ]
    },
    {
      "id": "limitations",
      "kind": "limitations",
      "title": "Survey estimates",
      "paragraphs": [
        "Every value is an estimate from a sample of households, so small differences between years or groups should not be treated as significant. For example, Geostat gives a 95% confidence interval of 6.3–7.9% for the 2025 poverty-line rate of 7.1%. The pages describe the figures and do not explain their causes. Fiscal.ge creates no changes in percentage points, counts of poor people or other derived figures."
      ]
    },
    {
      "id": "validation",
      "kind": "validation",
      "title": "How are the figures checked?",
      "paragraphs": [
        "491 published values are served. Each is re-read from its original Geostat workbook cell, and the original files are checked against their recorded fingerprints. The checks require every rate to lie within 0–100% and every Gini coefficient within 0–1, Georgia’s rate to lie between its groups’ rates, the 40% line never to exceed the 60% line, the international lines to stay in order, and the 2016–2025 poverty-line rates and the 2025 Gini coefficient to match Geostat’s page. Pages show the values at Geostat’s published precision: one decimal for percents and two for Gini coefficients."
      ]
    },
    {
      "id": "archive",
      "kind": "archive",
      "title": "Original sources",
      "paragraphs": [
        "Seven Geostat originals retrieved on 10 October 2026 are available: the four poverty and Gini workbooks, the Poverty and Gini Coefficients page and the two current metadata documents. The HTML page downloads as a plain-text attachment. Excel follows the chosen tab, series and years, and lists the workbooks behind them."
      ]
    }
  ],
  "decisions": [
    {
      "id": "poverty.scope",
      "group": "poverty",
      "title": "What do the pages cover?",
      "statusLabel": "Fiscal.ge decision",
      "summary": "Annual figures for Georgia from Geostat: the share of the population below the absolute poverty line since 2004, for towns and villages, children (0–17), working age (18–64), people aged 65 and older, women and men; the share below 60% and 40% of median consumption since 2004, for Georgia, towns and villages; the share below the World Bank’s international poverty lines of $3.00, $4.20 and $8.30 a day since 2004; and six Gini coefficients since 2006. Household income and spending, poverty by region, the subsistence minimum, the lari value of the international lines and quarterly data are not shown.",
      "detail": [],
      "canonicalDecisionIds": [
        "poverty.scope"
      ]
    },
    {
      "id": "poverty.survey",
      "group": "poverty",
      "title": "Where do the figures come from?",
      "statusLabel": "Fiscal.ge decision",
      "summary": "All figures come from Geostat’s household survey, which covers all private households in Georgia except the occupied territories (Abkhazian Autonomous Republic and Tskhinvali region). In 2025, 13,341 households were interviewed. The survey was the Integrated Household Survey before 2017 and the Households Incomes and Expenditures Survey from 2017, with a sampling frame based on the 2014 census instead of the 2002 census. Geostat’s metadata states that the data are comparable over time, so the charts draw no break.",
      "detail": [],
      "canonicalDecisionIds": [
        "poverty.survey"
      ]
    },
    {
      "id": "poverty.lines",
      "group": "poverty",
      "title": "Poverty lines",
      "statusLabel": "Fiscal.ge decision",
      "summary": "The poverty-line rate is the share of the poor in the total population, measured against Geostat’s absolute poverty line; Geostat’s workbook notes that 2015 is the base year of calculating the poverty line. Relative poverty is the share of people whose consumption is below 60% or 40% of the median consumption, the level that half of the population consumes less than and half more than. The international lines are the World Bank’s $3.00, $4.20 and $8.30 a day at 2021 purchasing power parity, as republished by Geostat; Geostat’s file ends in 2024.",
      "detail": [],
      "canonicalDecisionIds": [
        "poverty.lines"
      ]
    },
    {
      "id": "poverty.gini",
      "group": "poverty",
      "title": "Gini coefficients",
      "statusLabel": "Fiscal.ge decision",
      "summary": "The Gini coefficient shows how far the actual distribution of income or expenditure is from an equal one: 0 means everyone has the same and 1 means one person has everything. Geostat publishes six measures, defined in its workbook: total incomes include transfers, cash and non-cash incomes; total cash inflows include transfers, cash incomes and other cash inflows; total inflows include cash inflows and non-cash incomes; total consumption expenditures include cash and non-cash consumption expenditures; total cash expenditures include cash consumption and cash non-consumption expenditures; and total expenditures include cash and non-cash expenditures. Geostat’s metadata says Gini coefficients exist from 1997, but its published workbook starts in 2006, so the pages start in 2006 and add no earlier year from another source.",
      "detail": [],
      "canonicalDecisionIds": [
        "poverty.gini"
      ]
    }
  ],
  "technicalAppendix": [],
  "showTechnicalAppendix": false
};
