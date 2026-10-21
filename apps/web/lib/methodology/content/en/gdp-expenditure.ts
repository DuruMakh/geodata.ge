import type { MethodologyContent } from "../../types";
export const GDP_EXPENDITURE_METHODOLOGY: MethodologyContent = {
  id:"gdp-expenditure",slug:"gdp-expenditure",title:"GDP by expenditure",
  summary:"What Georgia’s GDP is spent on: household and government consumption, investment, exports and imports.",
  reviewedAt:"2026-10-20",archiveManifestId:"gdp-expenditure",coverageSource:{kind:"archive"},
  canonicalDocuments:["docs/data-methodology/gdp-expenditure.md"],
  disclosure:"Official annual Geostat observations. Fiscal.ge calculates GDP shares and converts published growth indices to percentage changes.",
  keyFacts:[{label:"Coverage",valueKind:"coverage"},{label:"Frequency",valueKind:"frequency",value:"Annual"},{label:"Unit",valueKind:"unit",value:"GEL / %"}],
  sections:[
    {id:"scope",kind:"scope",title:"Coverage",paragraphs:["GDP and its uses: consumption (households, non-profit organisations serving households, and government with its individual and collective services), investment (buildings and equipment, and the change in inventories), exports and imports (goods and services). Amounts and GDP shares cover 2010–2025; real growth covers 2011–2025. Annual data only."]},
    {id:"sources",kind:"sources",title:"Sources and calculations",paragraphs:["Source: Geostat, SNA 2008, current market prices. GDP = consumption + investment + exports − imports. Imports are shown as positive amounts, as Geostat publishes them, so the shares do not add up to 100%.","GDP share = amount / same-year GDP × 100. GDP is the same as on the Sectors page.","Real growth measures changes in volume, excluding price effects: subtract 100 from Geostat’s index (previous year = 100). Geostat publishes real growth for households and non-profits only together, so that view shows them as one line. The change in inventories has no growth rate because it can be negative."]},
    {id:"limitations",kind:"limitations",title:"Limitations",paragraphs:["2025 data are preliminary; Geostat will revise them on 13 November 2026. Geostat publishes no values for net acquisition of valuables. Fiscal.ge adds nothing up and does not estimate missing values."]},
    {id:"archive",kind:"archive",title:"Original sources",paragraphs:["Untouched Geostat workbooks: current prices, real-growth indices and constant prices for independent validation."]},
  ],decisions:[],technicalAppendix:[],showTechnicalAppendix:false,
};
