import type { MethodologyContent } from "../../types";

export const BUSINESS_METHODOLOGY_CONTENT: MethodologyContent = {
  "id": "business",
  "slug": "business",
  "title": "Business",
  "summary": "Georgian firms’ sales, jobs, investment, profit and loss by industry, size and region, and the number of firms opened and closed, year by year, from Geostat data.",
  "metaDescription": "Georgian firms’ sales, jobs, investment, profit and loss, and the firms opened and closed, year by year, from Geostat’s annual data.",
  "reviewedAt": "2026-10-15",
  "archiveManifestId": "business",
  "coverageSource": {
    "kind": "archive"
  },
  "canonicalDocuments": [
    "docs/data-methodology/business-annual.md"
  ],
  "disclosure": "Each year shows one value. Quarterly figures, 2026 and the survey’s other tables are outside these pages.",
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
      "value": "million GEL; persons; firms; %"
    }
  ],
  "sections": [
    {
      "id": "scope",
      "kind": "scope",
      "title": "What do the pages cover?",
      "paragraphs": [
        "Annual figures from Geostat on Georgia’s business sector, on five pages. Sales and Jobs: firms’ turnover and the number of persons employed since 1999. Investment and profit: investment in fixed assets, profit and loss since 2006. Each is shown in total, for large, medium and small firms and for 14 industries. Regions: sales, jobs, investment, profit and loss for the 11 regions since 2006, and a page for Georgia and for each region. Firms opened and closed: active, new and closed firms in total, by section of economic activity and by region, and the rates of new and closed firms, 2014–2024. Quarterly figures, 2026, ownership and legal form, industries within a region and the survey’s other tables (production value, value added, earnings, costs and others) are not shown."
      ]
    },
    {
      "id": "sources",
      "kind": "sources",
      "title": "Where do the figures come from?",
      "paragraphs": [
        "Sales, jobs, investment, profit and loss come from four workbooks of Geostat’s annual Statistical Survey of Enterprises: turnover (0502EN0101), number of persons employed (0502EN0103), investments in fixed assets (0502EN0111) and profit and loss (0502EN0114). Geostat’s metadata says the survey covers the business sector (non-financial corporations), except financial corporations (banks, microfinance organisations and others) and retail sellers via stalls and markets. Geostat’s remarks list what is left out: financial and insurance activities (from 2006), public administration and defence, households as employers and extraterritorial organisations, retail sale via stalls and markets (group 47.8), and, from 2006, non-commercial legal persons and entities of public law. The respondents are limited liability and joint liability companies, limited partnerships, joint stock companies, cooperatives and individual enterprises, classified by their principal activity and actual address.",
        "The survey is a sample: Geostat selects firms by stratified random sampling and weights their answers. It gives the sampling error as at most 0.5% for the country, 1–2% for a region and 2–3% for an economic activity.",
        "The firms opened and closed come from Geostat’s business demography workbook “Main results”, which Geostat compiles from the business register, not from the survey. According to Geostat’s metadata, a firm is active in a year if it shows turnover, employment or paid salaries, profit or loss, or taxes other than only property tax at any time in that year. These figures cover the whole business sector except public administration and defence, households as employers and extraterritorial organisations, so unlike the survey they include financial firms."
      ]
    },
    {
      "id": "measures",
      "kind": "classification",
      "title": "What do the measures mean?",
      "paragraphs": [
        "Geostat’s metadata defines sales (turnover) as “income received from sales of goods or services (excluding VAT and excise tax)”.",
        "Geostat’s note under the turnover table reads: “The turnover of section ‘Arts, entertainment and recreation’ includes turnover volume of enterprises engaged to betting activities where in turnover is comprised sum of each bet.” So the sales of arts, entertainment and recreation count every bet placed: 88,880.0 million GEL of all firms’ 253,725.5 million GEL in 2025.",
        "Jobs are what Geostat calls the number of persons employed: the “average number of employees (employed, employed founders and family members employed in the family enterprise) in an enterprise during the accounting period”.",
        "Investment is Geostat’s investment in fixed assets: the “acquisition and capital improvement of tangible fixed assets, excluding the sales and transfers of fixed assets”.",
        "Geostat publishes profit and loss as two separate tables, one of profit and one of loss, each as a positive amount in million GEL; its metadata gives no further definition. The pages show both as Geostat prints them. Fiscal.ge does not subtract one from the other and calculates no net profit."
      ]
    },
    {
      "id": "sizes",
      "kind": "classification",
      "title": "Firm size",
      "paragraphs": [
        "Geostat’s note under each size table reads: a large enterprise is one “where average annual number of employed exceeds 249 persons and/or volume of average annual turnover - 60 million GEL”; medium enterprises are those where it “ranges from 50 to 250 persons and average annual turnover – from 12 million to 60 million GEL”; small enterprises are those where it “does not exceed 50 persons and average annual turnover - 12 million GEL”. Geostat’s metadata words these thresholds slightly differently; the pages follow the note under the size tables. Geostat’s remarks add that the total and the sum of the parts can differ because of rounding."
      ]
    },
    {
      "id": "firms",
      "kind": "classification",
      "title": "Firms opened and closed",
      "paragraphs": [
        "A new firm is what Geostat calls an enterprise birth, and a closed firm an enterprise death. Geostat’s footnotes: “A birth amounts to the creation of a combination of production factors with the restriction that no other enterprises are involved in the event. Births do not include entries into the population due to mergers, break-ups, split off or restructuring of a set of enterprises. It does not include entries into a subpopulation resulting only from a change of activity.” “A death amounts to the dissolution of a combination of production factors with the restriction that no other enterprises are involved in the event. Deaths do not include exits from the population due to mergers, take-overs, break-ups or restructuring of a set of enterprises. It does not include exits from a sub-population resulting only from a change of activity.” Geostat’s metadata defines a birth as “a business demographic event, when the new production factors or reactivation of the enterprise are gathered after it has suspended economic activity for more than 2 years” and a death as a “business demographic event when existing combination of production factors is disassembled”. It adds that a death is confirmed only after two years of inactivity, and that a firm that resumes activity after more than two years counts as a birth.",
        "The rates are Geostat’s birth and death rates: new or closed firms as a percentage of active firms. Fiscal.ge does not calculate them. Geostat’s 2016 and 2019 tables by activity have no death-rate column, so the death rates of the sections are gaps in those two years; the death rate of all firms is published for every year. Geostat’s metadata says these figures are published on 15 November of the following year, and the latest year published is 2024.",
        "The sections follow Geostat’s business demography: its 18 sections of economic activity, in which mining, manufacturing, energy and water are separate and financial and insurance activities are included. They differ from the survey’s 14 industries, where Industry is one group."
      ]
    },
    {
      "id": "activity-unknown",
      "kind": "classification",
      "title": "Activity not known",
      "paragraphs": [
        "Each of Geostat’s tables by activity has a row it labels “activity unknown”: firms that are part of the total but of no section. The pages show it as “Activity not known”, last under active, new and closed firms, so that the sections and this row add up to the total. In 2024 it held 22,681 of 249,236 active firms and 21,615 of 56,259 new firms.",
        "Geostat also prints birth and death rates for this row, but the pages do not show them: they exceed 100% in some years (the death rate is 628.2% in 2020), so they cannot be read as a share of the row’s active firms, and the workbook does not explain them. The counts are shown."
      ]
    },
    {
      "id": "jobs-lfs",
      "kind": "classification",
      "title": "Jobs and the Labour Force Survey",
      "paragraphs": [
        "The Jobs page shows the persons employed that the surveyed firms report, as a yearly average, and only in the industries the survey covers. It is not the number of employed people on the Unemployment pages, which comes from a different Geostat survey, the Labour Force Survey, which asks households about each person’s work wherever it is done. The two figures measure different things and should not be compared or added."
      ]
    },
    {
      "id": "break-2006",
      "kind": "limitations",
      "title": "The change in coverage in 2006",
      "paragraphs": [
        "Geostat’s remarks say the survey leaves out financial and insurance activities from 2006, and from 2006 also non-commercial legal persons and entities of public law. Until 2005 the totals still include them. Sales and jobs are the only measures before 2006, so their lines cover slightly different sets of firms before and after that year. Financial and insurance activities have no industry row, so from 1999 to 2005 the 14 industries add up to less than the total: by 1.4 to 19.1 million GEL for sales and by 240 to 449 persons for jobs. Each series is drawn as one line, the change is recorded with the data, and Fiscal.ge computes no change across it."
      ]
    },
    {
      "id": "regions",
      "kind": "limitations",
      "title": "Regions",
      "paragraphs": [
        "Region figures for sales, jobs, investment, profit and loss start in 2006. Geostat’s remarks say that until 2006 some firms registered in one region but working in several were included only in the country total, and that from 2006 their data are given by the location of the main office. A firm that works in several regions is therefore counted in full in the region of its main office, so a region’s figures can include work done in other regions and Tbilisi’s figures can be overstated.",
        "The 11 regions do not add up to the Georgia total. In every year from 2006 they are short for sales (by 29.8 to 170.1 million GEL; 170.1 million GEL in 2025), for jobs (by 901 to 1,413 persons) and for investment (by 1.1 to 86.7 million GEL), and in most years for profit and loss. The workbooks print no other region and no note on the difference, and Fiscal.ge does not fill it. For firms opened and closed, Geostat’s regions also include Abkhazeti AR and an “Unknown” row; with them the regions add up to the total, and the two rows are not shown on the pages."
      ]
    },
    {
      "id": "values",
      "kind": "classification",
      "title": "Values as Geostat publishes them",
      "paragraphs": [
        "Fiscal.ge calculates nothing on these pages: no net profit, shares, growth rates, totals or filled gaps. Every value is Geostat’s, rounded as Geostat’s files display it: amounts in million GEL to one decimal, persons and firms as whole numbers and rates to one decimal. Amounts are in current lari and not adjusted for inflation, so comparing amounts from different years does not account for price changes. The charts, tables and series lists show amounts in million GEL and people in thousands, to one decimal; the line under a page’s heading shows an amount of 1 billion GEL or more in billion GEL, and the Regions map shows billion GEL. Excel keeps million GEL and whole persons and firms. A year without a value is a gap in the chart, a dash in the table and an empty Excel cell, never zero. The pages describe the figures and state no causes."
      ]
    },
    {
      "id": "validation",
      "kind": "validation",
      "title": "How are the figures checked?",
      "paragraphs": [
        "4,643 values are served. Each is re-read from its cell in Geostat’s original workbook by two independent programs, and the original files are checked against their recorded fingerprints. The checks require the firm sizes and, from 2006, the industries to add up to the total within rounding; the sections with “Activity not known” and the regions of the firms data to add up exactly to the total; every published birth and death rate to equal new or closed firms divided by active firms; and the values to match what Geostat shows, for example for 2025: sales of 253,725.5 million GEL, 899,026 persons employed, investment of 8,021.8 million GEL, profit of 27,936.1 million GEL and loss of 7,152.9 million GEL, and for 2024: 249,236 active firms, 56,259 new firms and 29,634 closed firms. Where Geostat’s printed parts differ from its total, the difference is recorded exactly as published: the industries before 2006 and the regions, as described above, and rounding differences of up to 0.2 million GEL in a few years."
      ]
    },
    {
      "id": "archive",
      "kind": "archive",
      "title": "Original sources",
      "paragraphs": [
        "26 Geostat originals retrieved on 15 October 2026 are available: the four survey workbooks and the business demography workbook behind the pages, the survey’s eleven other tables and three other business demography workbooks, which the pages do not show, Geostat’s remarks on the survey, its two metadata documents in English and in Georgian, and the two Geostat pages the files are linked from. HTML pages download as text files. Excel follows the chosen page, measure, series and years and lists the Geostat workbooks behind them."
      ]
    }
  ],
  "decisions": [
    {
      "id": "business.scope",
      "group": "business",
      "title": "What do the pages cover?",
      "statusLabel": "Fiscal.ge decision",
      "summary": "Annual figures from Geostat on Georgia’s business sector, on five pages. Sales and Jobs: firms’ turnover and the number of persons employed since 1999. Investment and profit: investment in fixed assets, profit and loss since 2006. Each is shown in total, for large, medium and small firms and for 14 industries. Regions: sales, jobs, investment, profit and loss for the 11 regions since 2006, and a page for Georgia and for each region. Firms opened and closed: active, new and closed firms in total, by section of economic activity and by region, and the rates of new and closed firms, 2014–2024. Quarterly figures, 2026, ownership and legal form, industries within a region and the survey’s other tables (production value, value added, earnings, costs and others) are not shown.",
      "detail": [],
      "canonicalDecisionIds": [
        "business.scope"
      ]
    },
    {
      "id": "business.survey_scope_2006",
      "group": "business",
      "title": "The change in coverage in 2006",
      "statusLabel": "Limitation",
      "summary": "Geostat’s remarks say the survey leaves out financial and insurance activities from 2006, and from 2006 also non-commercial legal persons and entities of public law. Until 2005 the totals still include them. Sales and jobs are the only measures before 2006, so their lines cover slightly different sets of firms before and after that year. Financial and insurance activities have no industry row, so from 1999 to 2005 the 14 industries add up to less than the total: by 1.4 to 19.1 million GEL for sales and by 240 to 449 persons for jobs. Each series is drawn as one line, the change is recorded with the data, and Fiscal.ge computes no change across it.",
      "detail": [],
      "canonicalDecisionIds": [
        "business.survey_scope_2006"
      ]
    },
    {
      "id": "business.regions",
      "group": "business",
      "title": "Regions",
      "statusLabel": "Limitation",
      "summary": "Region figures for sales, jobs, investment, profit and loss start in 2006. Geostat’s remarks say that until 2006 some firms registered in one region but working in several were included only in the country total, and that from 2006 their data are given by the location of the main office. A firm that works in several regions is therefore counted in full in the region of its main office, so a region’s figures can include work done in other regions and Tbilisi’s figures can be overstated. The 11 regions do not add up to the Georgia total. In every year from 2006 they are short for sales (by 29.8 to 170.1 million GEL; 170.1 million GEL in 2025), for jobs (by 901 to 1,413 persons) and for investment (by 1.1 to 86.7 million GEL), and in most years for profit and loss. The workbooks print no other region and no note on the difference, and Fiscal.ge does not fill it. For firms opened and closed, Geostat’s regions also include Abkhazeti AR and an “Unknown” row; with them the regions add up to the total, and the two rows are not shown on the pages.",
      "detail": [],
      "canonicalDecisionIds": [
        "business.regions"
      ]
    },
    {
      "id": "business.activity_unknown",
      "group": "business",
      "title": "Activity not known",
      "statusLabel": "Fiscal.ge decision",
      "summary": "Each of Geostat’s tables by activity has a row it labels “activity unknown”: firms that are part of the total but of no section. The pages show it as “Activity not known”, last under active, new and closed firms, so that the sections and this row add up to the total. In 2024 it held 22,681 of 249,236 active firms and 21,615 of 56,259 new firms. Geostat also prints birth and death rates for this row, but the pages do not show them: they exceed 100% in some years (the death rate is 628.2% in 2020), so they cannot be read as a share of the row’s active firms, and the workbook does not explain them. The counts are shown.",
      "detail": [],
      "canonicalDecisionIds": [
        "business.activity_unknown"
      ]
    },
    {
      "id": "business.values",
      "group": "business",
      "title": "Values as Geostat publishes them",
      "statusLabel": "Fiscal.ge decision",
      "summary": "Fiscal.ge calculates nothing on these pages: no net profit, shares, growth rates, totals or filled gaps. Every value is Geostat’s, rounded as Geostat’s files display it: amounts in million GEL to one decimal, persons and firms as whole numbers and rates to one decimal. Amounts are in current lari and not adjusted for inflation, so comparing amounts from different years does not account for price changes. The charts, tables and series lists show amounts in million GEL and people in thousands, to one decimal; the line under a page’s heading shows an amount of 1 billion GEL or more in billion GEL, and the Regions map shows billion GEL. Excel keeps million GEL and whole persons and firms. A year without a value is a gap in the chart, a dash in the table and an empty Excel cell, never zero. The pages describe the figures and state no causes.",
      "detail": [],
      "canonicalDecisionIds": [
        "business.values"
      ]
    }
  ],
  "technicalAppendix": [],
  "showTechnicalAppendix": false
};
