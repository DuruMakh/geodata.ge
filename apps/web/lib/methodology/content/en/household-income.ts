import type { MethodologyContent, MethodologyDecision } from "../../types";

const sections: MethodologyContent["sections"] = [
  {
    "id": "scope",
    "kind": "scope",
    "title": "What do the pages cover?",
    "paragraphs": [
      "Annual figures from Geostat on the average monthly income and spending of households in Georgia: for Georgia as a whole in 2002–2025, for towns and villages from 2006 and for 11 regions from 2011. The pages show 12 income lines and 15 spending lines, each in two ways: per household and per person.",
      "Not shown are the whole-population totals in million lari (Geostat publishes them too, and they are available in the original sources), shares of spending, inflation-adjusted amounts, households split by size or by income, and quarterly data."
    ]
  },
  {
    "id": "survey",
    "kind": "sources",
    "title": "Where do the figures come from?",
    "paragraphs": [
      "All figures come from Geostat’s Household Incomes and Expenditures Survey. According to Geostat’s metadata, its purpose is to produce data on income, expenditure, consumption and the living conditions of the population. It covers all private households in Georgia except the occupied territories (Abkhazian Autonomous Republic and Tskhinvali region). A household is a group of persons who live in a single dwelling, share a budget (or part of one) and are connected by relative or non-relative relationships; it may consist of one person.",
      "In 2025, 17,280 households were sampled and 13,341 were interviewed (a response rate of 77.2%). Data are collected monthly. The survey was the Integrated Household Survey before 2017 and the Households Incomes and Expenditures Survey from 2017, with a sampling frame based on the 2014 census instead of the 2002 census. Geostat’s metadata states that the data are comparable over time, so the charts draw no break."
    ]
  },
  {
    "id": "measures",
    "kind": "classification",
    "title": "Per household and per person",
    "paragraphs": [
      "Every line is shown in two ways. “Per household” is the income or spending of one average household; “per person” is the amount for one person on average. A household can have several people, so the per-person amount is smaller than the per-household amount, and the two should not be compared with each other.",
      "Every value is an average monthly figure published by Geostat. A year’s value is that year’s average month, in current lari and not adjusted for inflation, so comparing amounts from different years does not account for price changes. Fiscal.ge calculates nothing: it does not add, divide or work out shares. Values are shown as they are in Geostat’s files, to one decimal."
    ]
  },
  {
    "id": "income",
    "kind": "classification",
    "title": "Sources of income",
    "paragraphs": [
      "According to Geostat’s metadata, household income includes all the income of the household and its members during the reference period. Total income is cash income and transfers plus non-cash income. Cash income and transfers consist of seven sources; non-cash income is a separate line.",
      "From wages and salaries: wage or other remuneration in cash or in kind, bonuses, gifts, one-time assistances.",
      "From self-employment: pure income; self-employment is a proprietor’s activity whose income depends on the final results of the work, on profit.",
      "From selling agricultural production: selling agricultural production produced on the household’s own land.",
      "Property income (leasing, interest on deposit): share dividends, interest on bonds or deposits, rent on property leasing.",
      "Pensions, scholarships, assistances: retirement, disability, loss of bread-winner, disabled veterans, participants in a war, persons equal to them and other special pensions, scholarship, temporary disability benefits (due to illness, childbirth), income from insurance, assistance for socially vulnerable families, single pensioners and disabled persons, IDPs, alimony and grants.",
      "Remittances from abroad: money received from abroad or the value of goods received as a gift from abroad.",
      "Money received as gift: money received from members of other households as a gift or assistance.",
      "Non-cash income: goods produced for self-consumption or received free of charge from relatives or through humanitarian assistance, valued at the average prices of the reference period."
    ]
  },
  {
    "id": "spending",
    "kind": "classification",
    "title": "Spending categories",
    "paragraphs": [
      "According to Geostat’s metadata, household expenditure includes all the spending of the household and its members during the reference period. The main figure on the pages is consumption spending: cash consumption spending plus non-cash spending. Cash consumption spending is split into eight categories.",
      "Food, beverages, tobacco: spending on food products (bread and bread products, meat products, fish, milk and dairy products, fruits, vegetables, pastries and others), non-alcoholic and alcoholic beverages and tobacco products.",
      "Clothes and footwear: spending on women’s, men’s and children’s clothing and footwear, including their repair, sewing, dry cleaning, dyeing and purchase; it also includes the value of clothing and footwear received free of charge from relatives or as humanitarian aid.",
      "Household goods: spending on furniture, textiles, utensils, household appliances and equipment, work tools, cleanliness items, housekeeping and home care; it also includes the value of items received free of charge.",
      "Healthcare: spending on pharmaceuticals, therapeutic equipment and devices, medical services, dentistry, surgical services and childbirth; it also includes the value of services received free of charge from relatives.",
      "Housing, water, electricity, gas and other fuels: rent for the primary rented accommodation, maintenance and repair services for housing, water supply, electricity and natural gas bills, purchase and repair of meters for these utilities, liquefied gas and solid fuel, central heating and others; it also includes the value of services received free of charge.",
      "Transport: spending on cars, motorcycles, bicycles, animal transport, spare parts and equipment, fuel, lubricants, maintenance, and passenger transport by railway, road, air and sea; it also includes the value of services received free of charge from relatives.",
      "Education: spending on preschool, elementary, secondary and higher education, and on training and qualification courses; it also includes the value of services received free of charge.",
      "Other consumption expenditure: consumption spending that does not fall in the categories above; Geostat’s metadata does not describe it in more detail.",
      "Non-cash expenditure: the value of self-produced goods and of products received free of charge from relatives or through humanitarian assistance, calculated at the average prices of the reference period.",
      "Cash non-consumption expenditure is a separate group and is not part of consumption spending. It has four categories: agriculture (land taxes and rents, fertilizer and pesticides, seed, equipment hire, land cultivation, veterinary services, livestock and poultry feed and others); transfers (gifts, money donated, inheritance or the cost of a gifted flat, cottage, car, gems, furniture and others); saving and lending (money borrowed, savings made by the household, amount deposited in a bank account, debt repaid, hidden credit and fees, unearned income for a specified period); and property acquirement (relatively expensive goods such as bonds, capital, land, a flat, a cottage and gems, building materials, doors and windows, an electric system, a minibus or lorry, a tractor, joiner’s tools, and productive or breeding domestic animals and poultry)."
    ]
  },
  {
    "id": "borrowing",
    "kind": "classification",
    "title": "Why is borrowing kept apart from income?",
    "paragraphs": [
      "Borrowing money and selling property bring money in, but they are not income: Geostat does not count them in total income and publishes them on a separate line, “Other cash inflows”. Borrowing or using savings means taking on debt or using up savings that already exist, and selling property turns something already owned into cash; neither creates new income. So on the pages these two lines are not placed under total income but form their own group, and they are never added to total income.",
      "Borrowing or dissaving: money borrowed from another household or institution, or savings used to pay for consumption spending. Property disposal: money received from selling an apartment, house, summer cottage, other buildings, household appliances, furniture, clothes, land and others. Spending works the same way: cash non-consumption expenditure is not part of consumption spending."
    ]
  },
  {
    "id": "regions",
    "kind": "classification",
    "title": "Notes on regions",
    "paragraphs": [
      "Geostat’s footnote says the data of 2011–2018 for Imereti includes Racha-Lechkhumi and Kvemo Svaneti, so Imereti’s line steps down in 2019 for that reason; the chart draws no marker for it. Racha-Lechkhumi and Kvemo Svaneti appears separately only from 2019.",
      "Guria, Mtskheta-Mtianeti and Samtskhe-Javakheti are also shown only from 2019: according to Geostat, the survey sample was too small for these regions earlier and has been increased since 2019. Earlier years are blank for these regions and are not filled in with anything.",
      "Geostat’s files also have an “Other regions” column, which adds Guria, Samtskhe-Javakheti and Mtskheta-Mtianeti together in 2011–2018 and has no value from 2019; it is not shown on the pages. Data for towns and villages exist from 2006."
    ]
  },
  {
    "id": "limitations",
    "kind": "limitations",
    "title": "Survey estimates",
    "paragraphs": [
      "All values are estimates from a sample of households, so small differences between regions and short-term changes may not be meaningful. For example, for 2025 income per household, total, Geostat gives a 95% confidence interval of 1981.7–2069.9 lari.",
      "A missing value is blank on the pages — a gap in the chart, a dash in the table, an empty cell in Excel — and is never zero. The pages describe the figures and do not explain their causes."
    ]
  },
  {
    "id": "validation",
    "kind": "validation",
    "title": "How are the figures checked?",
    "paragraphs": [
      "10,638 values are published. Each is read again from the cell of Geostat’s original file by two independent programs, and the original files are checked against their recorded digital fingerprints. The checks require the parts to match the total Geostat prints for every area and year (5,280 checks), Georgia’s value to lie between the values of towns and villages and between those of the regions, no value to be negative, and Georgia’s 2025 total income per household to be 2025.8 lari and its consumption spending 1438.7 lari."
    ]
  },
  {
    "id": "archive",
    "kind": "archive",
    "title": "Original sources",
    "paragraphs": [
      "21 Geostat originals retrieved in October 2026 are available: 18 files (nine on income and nine on spending, including six whole-population total files that the pages do not show), the two source pages for income and spending, and the current metadata document. HTML pages download as text files. Excel follows the selected tab, area, measure, series and years and lists their source files."
    ]
  }
];

const decision = (
  id: string, sectionId: string, statusLabel: MethodologyDecision["statusLabel"],
): MethodologyDecision => {
  const section = sections.find((item) => item.id === sectionId)!;
  return {
    id: `household-income.${id}`,
    group: "household-income",
    title: section.title,
    statusLabel,
    summary: section.paragraphs.join(" "),
    detail: [],
    canonicalDecisionIds: [`household-income.${id}`],
  };
};

export const HOUSEHOLD_INCOME_METHODOLOGY_CONTENT: MethodologyContent = {
  "id": "household-income",
  "slug": "household-income",
  "title": "Household income and spending",
  "summary": "The average monthly income and spending of households in Georgia, per household and per person, for towns, villages and regions, from Geostat’s Households Incomes and Expenditures Survey.",
  "reviewedAt": "2026-10-11",
  "archiveManifestId": "household-income",
  "coverageSource": {
    "kind": "archive"
  },
  "canonicalDocuments": [
    "docs/data-methodology/household-income-spending-annual.md"
  ],
  "disclosure": "All values are survey estimates and average monthly figures published by Geostat. Inflation-adjusted amounts, shares of spending, households split by size or by income, and quarterly data are outside these pages.",
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
      "value": "₾ a month, per household or per person"
    }
  ],
  sections,
  "decisions": [
    decision("scope", "scope", "Fiscal.ge decision"),
    decision("survey", "survey", "Official fact"),
    decision("measures", "measures", "Fiscal.ge decision"),
    decision("income", "income", "Official fact"),
    decision("spending", "spending", "Official fact"),
    decision("borrowing", "borrowing", "Fiscal.ge decision"),
    decision("regions", "regions", "Official fact"),
    decision("limitations", "limitations", "Limitation")
  ],
  "technicalAppendix": [],
  "showTechnicalAppendix": false
};
