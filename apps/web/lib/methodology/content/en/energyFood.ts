import type { MethodologyContent } from "../../types";

export const ENERGY_FOOD_METHODOLOGY_CONTENT: MethodologyContent = {
  "id": "energy-food",
  "slug": "energy-food",
  "title": "Energy and food",
  "summary": "Georgia’s energy supply, electricity and final energy use from Geostat’s annual energy balance, and the share of twelve main foods that the country produces itself, from Geostat’s food balance sheets, and Georgia’s farm output, harvests, livestock and farm-gate prices from Geostat’s agriculture statistics.",
  "metaDescription": "Georgia’s energy balance, electricity and energy use, self-sufficiency in twelve main foods, and farm output, harvests, livestock and farm prices, from Geostat.",
  "reviewedAt": "2026-10-20",
  "archiveManifestId": "energy-food",
  "coverageSource": {
    "kind": "archive"
  },
  "canonicalDocuments": [
    "docs/data-methodology/energy-food-annual.md"
  ],
  "disclosure": "All values are figures published by Geostat. The pages describe them and give no reasons; monthly and quarterly data, energy prices and 2025 energy figures are not included.",
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
      "value": "Thousand tonnes of oil equivalent; GWh; self-sufficiency %; million ₾; thousand tonnes; thousand head; million litres; million eggs; ₾ per kg"
    }
  ],
  "sections": [
    {
      "id": "scope",
      "kind": "scope",
      "title": "What do the pages cover?",
      "paragraphs": [
        "Annual figures for Georgia from Geostat: the Energy Balance of Georgia for 2013–2024, the food balance sheets for 2014–2025 and the agriculture statistics for 2006–2025. Energy supply: domestic supply by fuel, production, imports and exports, in thousand tonnes of oil equivalent. Electricity: production by plant type, imports, exports, final consumption by user and network losses, in GWh. Energy use: final energy consumption by user and by fuel, in thousand tonnes of oil equivalent. Food: the self-sufficiency ratio, in percent, for twelve foods — wheat, maize, potatoes, vegetables, grapes, meat (with beef, pork, sheep and goat meat and poultry), milk and milk products, and eggs. Farming: farm output in million ₾ (2010–2025), harvests of thirteen crops in thousand tonnes, livestock in thousand head, meat, milk and eggs (2006–2025), and twelve farm-gate prices in ₾ (2014–2025). Monthly data, energy prices and 2025 energy figures are not shown."
      ]
    },
    {
      "id": "sources",
      "kind": "sources",
      "title": "Where do the figures come from?",
      "paragraphs": [
        "All figures are Geostat’s own. Energy data come from Geostat’s annual publication “Energy Balance of Georgia”, issued separately for each year from 2013 to 2024. Each edition contains an aggregated energy balance workbook and an electricity and heat workbook; Fiscal.ge uses the oil-equivalent sheet of the first and the electricity (GWh) column of the second. The 2025 balance has not been published, so the energy pages end in 2024. Food data come from Geostat’s food balance sheets and cover 2014–2025. Farming data come from six workbooks on Geostat’s Agriculture page: general agricultural statistics (farm output), production of annual crops, production of permanent crops, livestock numbers, livestock products and agricultural production prices. Geostat also publishes monthly electricity and fuel figures from 2018 and energy prices every half year. They are not used: the pages show yearly data only, and adding up months would be Fiscal.ge’s own calculation. Every value is shown as Geostat published it: Fiscal.ge adds no shares, differences, sums or per-person figures."
      ]
    },
    {
      "id": "balance",
      "kind": "classification",
      "title": "The energy balance and the oil-equivalent unit",
      "paragraphs": [
        "An energy balance is Geostat’s yearly account of where a country’s energy comes from and where it goes: what is produced, what comes in and goes out of the country, and how the rest is used. Fuels are measured in different units, so Geostat states them in one: tonnes of oil equivalent. One tonne of oil equivalent is the energy in one tonne of crude oil, so natural gas, coal, oil products, hydro power and electricity can be added together. The pages show thousand tonnes of oil equivalent from the matching Geostat sheet; the terajoule sheet is not used. Electricity is also shown in gigawatt-hours (GWh), as Geostat publishes it in its electricity workbook."
      ]
    },
    {
      "id": "supply-use",
      "kind": "classification",
      "title": "Domestic supply, final consumption and non-energy use",
      "paragraphs": [
        "Domestic supply is the energy available inside the country. In Geostat’s balance it builds on production plus imports, minus exports, minus fuel supplied to international ships and aircraft (bunkers), plus or minus changes in stocks. The pages show the Total column and the fuels as Geostat publishes them. Electricity’s domestic supply is imports minus exports as Geostat publishes it, so it can be negative when more was exported than imported; it is negative in 2016 and 2023. Final consumption is the energy used by end users: industry, transport, commercial and public services, households, agriculture, forestry and fishing, and other uses that Geostat does not specify. Non-energy use is fuel that is not burned for energy but used as a raw material, for example natural gas used to make fertiliser; Geostat counts it inside final consumption, and the pages show it as one of the users."
      ]
    },
    {
      "id": "electricity",
      "kind": "classification",
      "title": "What the electricity rows mean",
      "paragraphs": [
        "Electricity production is shown in total and by plant type: hydro, thermal and wind plants. Geostat’s balance has no wind column before 2016, so wind plants have no value for 2013–2015; this is a gap, not zero. Imports and exports are electricity bought and sold abroad. Final consumption is shown by user. Its “Other (not specified)” row is large — 1,605 GWh in 2013 and 2,553 GWh in 2024 — and Geostat does not break it down; Fiscal.ge offers no explanation of its own. Network losses are the row that Geostat’s English workbooks label “Losses”, and in 2016, 2017 and 2018 “Distribution Losses”. The balance adds up in the same way in those years too (supply minus the energy sector’s own use and minus losses equals final consumption), so Fiscal.ge shows all twelve years as one series."
      ]
    },
    {
      "id": "food",
      "kind": "classification",
      "title": "The food self-sufficiency ratio",
      "paragraphs": [
        "Geostat publishes the self-sufficiency ratio for each food and year, in percent. It compares what Georgia produces itself with what it has available to use: domestic production divided by production plus imports minus exports, multiplied by 100. A ratio of 100% means Georgia produces as much as it uses. Below 100% it imports the rest. Above 100% it produces more than it uses and the rest leaves the country. Geostat’s sheets list production, imports, exports and the change in stocks, with the ratio printed below them. Fiscal.ge does not recalculate the ratio: the pages show Geostat’s published numbers as whole percents, as in Geostat’s file. Geostat’s published ratios mostly match this formula and a few differ: for sheep and goat meat in 2017, for example, 299 is published and the formula gives 291. According to Geostat’s footnotes, the wheat and maize balances include products made from them, converted into wheat and maize, and the grape balance counts wine converted into grapes. Sheep and goat meat reached 345% in 2018 and is shown as published."
      ]
    },
    {
      "id": "dashes",
      "kind": "classification",
      "title": "Dashes and gaps",
      "paragraphs": [
        "In the balances Geostat writes “-” where a flow did not occur. Fiscal.ge stores and shows such a value as 0, marks it “No flow” in the Data sheet of the Excel download and lists it in the validation report; three values are affected: crude oil imports in 2013 and 2021, and crude oil supply in 2013. Cells that Geostat marks “…” (not published) would be gaps rather than zero. They appear only in a non-ferrous metals industry sub-row of several 2013–2020 workbooks, which the pages do not use; no shown series contains one, and validation fails if one ever does. Nothing is estimated, interpolated or derived."
      ]
    },
    {
      "id": "farming",
      "kind": "classification",
      "title": "Farming: output, harvests, livestock and farm-gate prices",
      "paragraphs": [
        "The Farming page shows Geostat’s agriculture statistics. Farm output is the value of everything farms produce in a year, in million lari at current prices, not adjusted for inflation; Geostat splits it into crops, livestock and agricultural services, and the series starts in 2010. Harvests are thousand tonnes of thirteen crops. Livestock is the number of animals at the end of each year, in thousand head. Meat is in thousand tonnes, milk in million litres and eggs in millions. Farm-gate prices are the average prices farmers receive when they sell, in lari per kilogram (milk per litre, eggs per piece), from 2014. Geostat enlarged its farm survey in 2016 and revised 2006–2015 so the years can be compared; rows that Geostat publishes only from 2016, such as winter and spring wheat, white and red grapes or chicken, are not shown. Geostat marks 2025 farm output as preliminary, and the Data sheet of the Excel download marks those four values “Preliminary”. In Geostat’s farming tables a dash means a figure is not available; no shown series contains one, and validation fails if one ever does. Quarterly livestock tables are not used: the page shows yearly data only. Quantities show one decimal and prices two, as Geostat prints them. The page describes the figures and gives no reasons for their changes."
      ]
    },
    {
      "id": "limitations",
      "kind": "limitations",
      "title": "What the pages leave out",
      "paragraphs": [
        "The pages describe the figures and do not explain why they changed. Fiscal.ge creates no shares, changes, sums, per-person figures or forecasts. The lack of wind data before 2016 and the large undivided “Other (not specified)” electricity row are features of Geostat’s balance. The 2025 energy balance, monthly data, energy prices, sown area and yields, quarterly livestock figures, food consumption per person and regional breakdowns are not included."
      ]
    },
    {
      "id": "validation",
      "kind": "validation",
      "title": "How are the figures checked?",
      "paragraphs": [
        "1,389 values are published: 681 for energy and food and 708 for farming. Each is read again from a cell of Geostat’s original workbook and compared with the cell’s stored value, sheet, printed row and column label and number format; the original files are checked against their recorded fingerprints. For every year the checks also require that: the balance adds up (production plus imports, minus exports and bunkers, plus stock changes equals domestic supply within 0.2); the Total column equals the sum of the fuel columns within 0.5 for supply, imports and final consumption; final consumption equals the sum of its users within 0.5, and electricity production equals thermal plus hydro plus wind plants within 0.5 GWh; total supply and final consumption match Geostat’s separate energy efficiency workbook in all twelve years; and every food ratio lies within 10 percentage points of the value calculated from production, imports and exports on the same sheet. For farming they require that farm output equals crops plus livestock plus services within 0.5; meat equals its kinds plus other meat, and milk its two kinds, within 0.2; dairy cows never exceed cattle; and the production that the food balance sheets print in whole thousand tonnes matches the farming tables within 0.6, with one difference, grapes in 2014 (165 against 172.6), listed in the validation report. Energy supply in 2024 (5,914.5), imports in 2024 (5,099.0), electricity production in 2024 (14,234.1 GWh), the wheat ratio in 2025 (19%) and farm output in 2025 (8,384.9 million ₾) are compared with fixed values. The pages show values at Geostat’s precision: energy and electricity to one decimal, food ratios as whole numbers, farming quantities to one decimal and farm-gate prices to two."
      ]
    },
    {
      "id": "archive",
      "kind": "archive",
      "title": "Original sources",
      "paragraphs": [
        "55 originals from Geostat, retrieved on 11 and 20 October 2026, are available: 24 energy balance workbooks (the aggregated balance and the electricity and heat workbook for each year, 2013–2024), the energy efficiency workbook (used only for cross-checking), the food balance sheets, six agriculture workbooks (retrieved on 20 October 2026), Georgian-language editions of the 2024 aggregated balance, of the food balance sheets and of the six agriculture workbooks (kept for reference labels) and 15 captures of source pages. HTML pages download as text files. Excel follows the selected series and years and lists their source files."
      ]
    }
  ],
  "decisions": [
    {
      "id": "energy-food.scope",
      "group": "energy-food",
      "title": "What do the pages cover?",
      "statusLabel": "Fiscal.ge decision",
      "summary": "Annual figures for Georgia from Geostat: the Energy Balance of Georgia for 2013–2024, the food balance sheets for 2014–2025 and the agriculture statistics for 2006–2025. Energy supply: domestic supply by fuel, production, imports and exports, in thousand tonnes of oil equivalent. Electricity: production by plant type, imports, exports, final consumption by user and network losses, in GWh. Energy use: final energy consumption by user and by fuel, in thousand tonnes of oil equivalent. Food: the self-sufficiency ratio, in percent, for twelve foods — wheat, maize, potatoes, vegetables, grapes, meat (with beef, pork, sheep and goat meat and poultry), milk and milk products, and eggs. Farming: farm output in million ₾ (2010–2025), harvests of thirteen crops in thousand tonnes, livestock in thousand head, meat, milk and eggs (2006–2025), and twelve farm-gate prices in ₾ (2014–2025). Monthly data, energy prices and 2025 energy figures are not shown.",
      "detail": [],
      "canonicalDecisionIds": [
        "energy-food.scope"
      ]
    },
    {
      "id": "energy-food.sources",
      "group": "energy-food",
      "title": "Where do the figures come from?",
      "statusLabel": "Fiscal.ge decision",
      "summary": "All figures are Geostat’s own. Energy data come from Geostat’s annual publication “Energy Balance of Georgia”, issued separately for each year from 2013 to 2024. Each edition contains an aggregated energy balance workbook and an electricity and heat workbook; Fiscal.ge uses the oil-equivalent sheet of the first and the electricity (GWh) column of the second. The 2025 balance has not been published, so the energy pages end in 2024. Food data come from Geostat’s food balance sheets and cover 2014–2025. Farming data come from six workbooks on Geostat’s Agriculture page: general agricultural statistics (farm output), production of annual crops, production of permanent crops, livestock numbers, livestock products and agricultural production prices. Geostat also publishes monthly electricity and fuel figures from 2018 and energy prices every half year. They are not used: the pages show yearly data only, and adding up months would be Fiscal.ge’s own calculation. Every value is shown as Geostat published it: Fiscal.ge adds no shares, differences, sums or per-person figures.",
      "detail": [],
      "canonicalDecisionIds": [
        "energy-food.sources"
      ]
    },
    {
      "id": "energy-food.balance",
      "group": "energy-food",
      "title": "The energy balance and the oil-equivalent unit",
      "statusLabel": "Official fact",
      "summary": "An energy balance is Geostat’s yearly account of where a country’s energy comes from and where it goes: what is produced, what comes in and goes out of the country, and how the rest is used. Fuels are measured in different units, so Geostat states them in one: tonnes of oil equivalent. One tonne of oil equivalent is the energy in one tonne of crude oil, so natural gas, coal, oil products, hydro power and electricity can be added together. The pages show thousand tonnes of oil equivalent from the matching Geostat sheet; the terajoule sheet is not used. Electricity is also shown in gigawatt-hours (GWh), as Geostat publishes it in its electricity workbook.",
      "detail": [],
      "canonicalDecisionIds": [
        "energy-food.balance"
      ]
    },
    {
      "id": "energy-food.supply_use",
      "group": "energy-food",
      "title": "Domestic supply, final consumption and non-energy use",
      "statusLabel": "Official fact",
      "summary": "Domestic supply is the energy available inside the country. In Geostat’s balance it builds on production plus imports, minus exports, minus fuel supplied to international ships and aircraft (bunkers), plus or minus changes in stocks. The pages show the Total column and the fuels as Geostat publishes them. Electricity’s domestic supply is imports minus exports as Geostat publishes it, so it can be negative when more was exported than imported; it is negative in 2016 and 2023. Final consumption is the energy used by end users: industry, transport, commercial and public services, households, agriculture, forestry and fishing, and other uses that Geostat does not specify. Non-energy use is fuel that is not burned for energy but used as a raw material, for example natural gas used to make fertiliser; Geostat counts it inside final consumption, and the pages show it as one of the users.",
      "detail": [],
      "canonicalDecisionIds": [
        "energy-food.supply_use"
      ]
    },
    {
      "id": "energy-food.electricity",
      "group": "energy-food",
      "title": "What the electricity rows mean",
      "statusLabel": "Fiscal.ge decision",
      "summary": "Electricity production is shown in total and by plant type: hydro, thermal and wind plants. Geostat’s balance has no wind column before 2016, so wind plants have no value for 2013–2015; this is a gap, not zero. Imports and exports are electricity bought and sold abroad. Final consumption is shown by user. Its “Other (not specified)” row is large — 1,605 GWh in 2013 and 2,553 GWh in 2024 — and Geostat does not break it down; Fiscal.ge offers no explanation of its own. Network losses are the row that Geostat’s English workbooks label “Losses”, and in 2016, 2017 and 2018 “Distribution Losses”. The balance adds up in the same way in those years too (supply minus the energy sector’s own use and minus losses equals final consumption), so Fiscal.ge shows all twelve years as one series.",
      "detail": [],
      "canonicalDecisionIds": [
        "energy-food.electricity"
      ]
    },
    {
      "id": "energy-food.food",
      "group": "energy-food",
      "title": "The food self-sufficiency ratio",
      "statusLabel": "Official fact",
      "summary": "Geostat publishes the self-sufficiency ratio for each food and year, in percent. It compares what Georgia produces itself with what it has available to use: domestic production divided by production plus imports minus exports, multiplied by 100. A ratio of 100% means Georgia produces as much as it uses. Below 100% it imports the rest. Above 100% it produces more than it uses and the rest leaves the country. Geostat’s sheets list production, imports, exports and the change in stocks, with the ratio printed below them. Fiscal.ge does not recalculate the ratio: the pages show Geostat’s published numbers as whole percents, as in Geostat’s file. Geostat’s published ratios mostly match this formula and a few differ: for sheep and goat meat in 2017, for example, 299 is published and the formula gives 291. According to Geostat’s footnotes, the wheat and maize balances include products made from them, converted into wheat and maize, and the grape balance counts wine converted into grapes. Sheep and goat meat reached 345% in 2018 and is shown as published.",
      "detail": [],
      "canonicalDecisionIds": [
        "energy-food.food"
      ]
    },
    {
      "id": "energy-food.dashes",
      "group": "energy-food",
      "title": "Dashes and gaps",
      "statusLabel": "Fiscal.ge decision",
      "summary": "In the balances Geostat writes “-” where a flow did not occur. Fiscal.ge stores and shows such a value as 0, marks it “No flow” in the Data sheet of the Excel download and lists it in the validation report; three values are affected: crude oil imports in 2013 and 2021, and crude oil supply in 2013. Cells that Geostat marks “…” (not published) would be gaps rather than zero. They appear only in a non-ferrous metals industry sub-row of several 2013–2020 workbooks, which the pages do not use; no shown series contains one, and validation fails if one ever does. Nothing is estimated, interpolated or derived.",
      "detail": [],
      "canonicalDecisionIds": [
        "energy-food.dashes"
      ]
    },
    {
      "id": "energy-food.farming",
      "group": "energy-food",
      "title": "Farming: output, harvests, livestock and farm-gate prices",
      "statusLabel": "Fiscal.ge decision",
      "summary": "The Farming page shows Geostat’s agriculture statistics. Farm output is the value of everything farms produce in a year, in million lari at current prices, not adjusted for inflation; Geostat splits it into crops, livestock and agricultural services, and the series starts in 2010. Harvests are thousand tonnes of thirteen crops. Livestock is the number of animals at the end of each year, in thousand head. Meat is in thousand tonnes, milk in million litres and eggs in millions. Farm-gate prices are the average prices farmers receive when they sell, in lari per kilogram (milk per litre, eggs per piece), from 2014. Geostat enlarged its farm survey in 2016 and revised 2006–2015 so the years can be compared; rows that Geostat publishes only from 2016, such as winter and spring wheat, white and red grapes or chicken, are not shown. Geostat marks 2025 farm output as preliminary, and the Data sheet of the Excel download marks those four values “Preliminary”. In Geostat’s farming tables a dash means a figure is not available; no shown series contains one, and validation fails if one ever does. Quarterly livestock tables are not used: the page shows yearly data only. Quantities show one decimal and prices two, as Geostat prints them. The page describes the figures and gives no reasons for their changes.",
      "detail": [],
      "canonicalDecisionIds": [
        "energy-food.farming"
      ]
    }
  ],
  "technicalAppendix": [],
  "showTechnicalAppendix": false
};
